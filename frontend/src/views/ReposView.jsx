import ProjectTypeSelector from '../components/ProjectTypeSelector.jsx';
import ArchiveButton from '../components/ArchiveButton.jsx';
import ProjectTodoList from '../components/ProjectTodoList.jsx';
import IndependentVisibility from '../components/IndependentVisibility.jsx';
import ProjectDashboard from '../components/ProjectDashboard.jsx';
import ProjectNotebook, { parseNotebook } from '../components/ProjectNotebook.jsx';
import ProjectDocuments from '../components/ProjectDocuments.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../utils/dateUtils.js';
import { CategoryBadges, CategorySelector } from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import ContentSearchFilters from '../components/ContentSearchFilters.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';
import QuickTypeSearch, { matchesQuickQuery, useQuickTypeSearch } from '../components/QuickTypeSearch.jsx';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En desarrollo' },
  { value: 'completed', label: 'Completado' },
  { value: 'published', label: 'Publicado' },
  { value: 'postponed',   label: 'Postpuesto' },
  { value: 'discarded',   label: 'Descartado' },
];
const TYPE_OPTIONS = [
  { value: 'client', label: 'Cliente' },
  { value: 'sangalan', label: 'Sangalan' },
  { value: 'personal', label: 'Personal' },
  { value: 'notes', label: 'Proyecto con notas' },
];
const TYPE_ORDER = { client: 0, sangalan: 1, personal: 2, notes: 3 };

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function getRepoType(repo, objectiveById) {
  return repo.type || (repo.objective_id && objectiveById[repo.objective_id]?.type === 'client' ? 'client' : 'personal');
}

const NOTEBOOK_SECTIONS = [
  ['overview', 'Resumen'], ['notes', 'Notas'], ['photos', 'Fotos'],
  ['tables', 'Tablas'], ['todo', 'ToDo List'], ['widgets', 'Widgets'], ['details', 'Detalles'],
];

export function DetailDialog({ repo, objectives, onClose, onSaved, onDeleted }) {
  const [projectId, setProjectId] = useState(repo?.id || null);
  const isNew = !projectId;
  const [form, setForm] = useState({
    title: repo?.title || '', target_date: repo?.target_date || '',
    type: repo?.type || 'personal', status: repo?.status === 'finished' ? 'completed' : (repo?.status || 'not_started'),
    show_independent: Number(repo?.show_independent) === 1 ? 1 : 0,
    independent_color: repo?.independent_color || null,
    objective_id: repo?.objective_id || '', url: repo?.url || '', notes: repo?.notes || '',
  });
  const [section, setSection] = useState(repo?.type === 'notes' ? 'overview' : 'details');
  const [catIds, setCatIds] = useState(() => parseCatIds(repo?.category_ids, repo?.category_id));
  const [notebook, setNotebook] = useState(() => parseNotebook(repo?.notebook));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [readingPhotos, setReadingPhotos] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scrollArea = useRef(null);
  const panel = useRef(null);
  const baseline = useRef({ form, catIds, notebook });
  const isNotebook = form.type === 'notes';
  const busy = saving || deleting || readingPhotos;
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline.current.form)
    || JSON.stringify(catIds) !== JSON.stringify(baseline.current.catIds) || notebook !== baseline.current.notebook;

  function close() {
    if (busy || taskDialogOpen) return;
    if (dirty && !confirm('Hay cambios sin guardar. ¿Quieres salir y descartarlos?')) return;
    onClose();
  }
  useEscapeClose(close, !busy && !datePickerOpen && !taskDialogOpen);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const handleTab = event => {
      if (event.key !== 'Tab' || !panel.current?.contains(event.target)) return;
      const controls = Array.from(panel.current.querySelectorAll('button, input, textarea, select, summary, a[href]'))
        .filter(element => !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleTab);
    return () => { document.removeEventListener('keydown', handleTab); document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, []);

  function navigateSection(next) {
    setSection(next);
    setSavedMessage('');
    scrollArea.current?.scrollTo({ top: 0 });
  }
  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); setSavedMessage(''); }
  async function save() {
    if (busy || !form.title.trim() || notebook.error) return;
    if (notebook.tables.some(table => table.columns.some(column => !column.name.trim()))) {
      setError('Escribe el nombre de todas las columnas antes de guardar.');
      if (isNotebook) navigateSection('tables');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const nextForm = { ...form, title: form.title.trim() };
      const body = { ...nextForm, notebook, objective_id: form.objective_id || null, url: form.url || null, category_ids: catIds, category_id: catIds[0] || null };
      const result = isNew ? await api.createRepo(body) : await api.updateRepo(projectId, body);
      onSaved();
      if (isNotebook) {
        setProjectId(result.id);
        setForm(nextForm);
        baseline.current = { form: nextForm, catIds, notebook };
        setSavedMessage(isNew ? 'Proyecto creado' : 'Cambios guardados');
        if (isNew) { setSection('overview'); scrollArea.current?.scrollTo({ top: 0 }); }
      } else onClose();
    } catch (err) { setError(err.message || 'No se pudo guardar el proyecto.'); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!confirm(`¿Eliminar proyecto "${form.title}"?`)) return;
    setDeleting(true); setError('');
    try { await api.deleteRepo(projectId); onDeleted(); onClose(); }
    catch (err) { setError(err.message || 'No se pudo eliminar el proyecto.'); }
    finally { setDeleting(false); }
  }
  const details = <fieldset disabled={busy} className="project-details-fields">
    {isNotebook && <div className="project-section-heading"><div><h3>Detalles del proyecto</h3><p>El nombre, la descripción y los datos generales.</p></div></div>}
    <ProjectTypeSelector value={form.type} onChange={value => set('type', value)} />
    <div className="project-details-grid">
      <label className="project-field">Título *<input aria-label="Título del proyecto" placeholder="Nombre del proyecto" value={form.title} onChange={e => set('title', e.target.value)} /></label>
      <div className="project-field">Fecha objetivo<SpanishDateInput onOpenChange={setDatePickerOpen} value={form.target_date} onChange={value => set('target_date', value)} style={{ width: '100%' }} /></div>

      <label className="project-field">Estado<select aria-label="Estado del proyecto" value={form.status} onChange={e => set('status', e.target.value)}>{STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
    </div>
    <label className="project-field">{isNotebook ? 'Descripción' : 'Notas'}<textarea aria-label={isNotebook ? 'Descripción del proyecto' : 'Notas del proyecto'} placeholder={isNotebook ? '¿De qué trata este proyecto?' : ''} value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} /></label>
    <IndependentVisibility value={form.show_independent} onChange={value => set('show_independent', value)} color={form.independent_color} onColorChange={value => set('independent_color', value)} parentColor={objectives.find(objective => objective.id === form.objective_id)?.color} />
    <details className="project-extra-details">
      <summary>Más opciones <span>Objetivo, enlace y categorías</span></summary>
      <label className="project-field">Objetivo<select value={form.objective_id} onChange={e => set('objective_id', e.target.value)}><option value="">Sin objetivo</option>{objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
      <label className="project-field">{isNotebook ? 'Enlace' : 'URL GitHub'}<input type="url" value={form.url} onChange={e => set('url', e.target.value)} placeholder={isNotebook ? 'https://…' : 'https://github.com/usuario/proyecto'} /></label>
      <div className="project-field">Categorías<CategorySelector selected={catIds} onChange={setCatIds} /></div>
    </details>
  </fieldset>;

  return <div className={`modal-backdrop ${isNotebook ? 'notes-project-backdrop' : ''}`} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" tabIndex={-1} className={`modal-panel project-dialog ${isNotebook ? 'notes-project-dialog' : ''}`}>
      <header className="project-dialog-header">
        <div><span className="project-eyebrow">{isNotebook ? 'PROYECTO CON NOTAS' : 'PROYECTO'}</span><h2 id="project-dialog-title">{isNew ? 'Nuevo proyecto' : form.title || 'Proyecto'}</h2></div>
        <button className="project-icon-button" onClick={close} disabled={busy} aria-label="Cerrar proyecto">✕</button>
      </header>
      {isNotebook && <nav className="project-section-nav" aria-label="Secciones del proyecto">
        {NOTEBOOK_SECTIONS.map(([key, label]) => <button key={key} type="button" aria-current={section === key ? 'page' : undefined} disabled={busy} onClick={() => navigateSection(key)}>{label}</button>)}
      </nav>}
      {!isNotebook && !isNew && <nav className="project-section-nav" aria-label="Secciones del proyecto">
        {[['details', 'Info'], ['documents', 'Documentos']].map(([key, label]) => <button key={key} type="button" aria-current={section === key ? 'page' : undefined} disabled={busy} onClick={() => navigateSection(key)}>{label}</button>)}
      </nav>}
      <div ref={scrollArea} className="project-dialog-body">
        {section === 'details' && details}
        {!isNotebook && !isNew && section === 'documents' && <ProjectDocuments projectId={projectId} disabled={busy} />}
        {isNotebook && section === 'overview' && <ProjectDashboard project={form} notebook={notebook} statusLabel={form.status === 'finished' ? 'Completado' : STATUS_OPTIONS.find(s => s.value === form.status)?.label} onEdit={navigateSection} disabled={busy} />}
        {isNotebook && section === 'todo' && <ProjectTodoList projectId={projectId} objectiveId={baseline.current.form.objective_id} disabled={busy} allowNew={!['completed', 'published', 'finished'].includes(form.status)} onDialogChange={setTaskDialogOpen} onTasksChanged={onSaved} />}
        {isNotebook && !['overview', 'details', 'todo'].includes(section) && <ProjectNotebook section={section} value={notebook} onChange={setNotebook} disabled={busy} onBusyChange={setReadingPhotos} />}
      </div>
      {(error || notebook.error) && <p className="project-form-error" role="alert">{error || notebook.error}</p>}
      <footer className="project-dialog-footer">
        <span className={`project-save-status ${dirty ? 'is-dirty' : ''}`} role="status">{readingPhotos ? 'Reduciendo fotos…' : saving ? 'Guardando…' : !form.title.trim() ? (isNotebook ? 'Añade un título en Detalles' : 'Añade un título') : dirty ? 'Cambios sin guardar' : isNew ? 'Nuevo proyecto' : savedMessage || 'Todo guardado'}</span>
        <div>
          {!isNew && <button className="btn btn-ghost project-delete-button" onClick={remove} disabled={busy}>{deleting ? 'Eliminando…' : 'Eliminar proyecto'}</button>}
          {!isNew && <ArchiveButton kind="repo" id={projectId} onArchived={() => { onDeleted(); onClose(); }} disabled={busy} />}
          <button className="btn btn-ghost" disabled={busy} onClick={close}>Cerrar</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !!notebook.error || !form.title.trim() || (!isNew && !dirty)}>{saving ? 'Guardando…' : isNew ? 'Crear proyecto' : 'Guardar cambios'}</button>
        </div>
      </footer>
    </div>
  </div>;
}

export default function ReposView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterCats, setFilterCats] = useState([]);
  const [filterTypes, setFilterTypes] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [quickQuery, setQuickQuery] = useQuickTypeSearch(!selected && !creating);

  async function load() {
    api.repos().then(setRepos);
    api.objectives().then(setObjectives);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const intent = location.state;
    if (!intent?.fromSearch || intent.itemKind !== 'repo') return;
    const target = repos.find(r => String(r.id) === String(intent.itemId));
    if (!target) return;
    setSelected(target);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, repos]);

  const objectiveById = Object.fromEntries(objectives.map(o => [o.id, o]));

  // Categories used by at least one repo
  const usedCatIds = [...new Set(repos.flatMap(r => parseCatIds(r.category_ids, r.category_id)))];
  const normalizedSearch = searchTitle.trim().toLowerCase();
  const dateMatches = (value) => {
    if (!value) return !fromDate && !toDate;
    if (fromDate && value < fromDate) return false;
    if (toDate && value > toDate) return false;
    return true;
  };
  const visible = repos
    .filter(r => !normalizedSearch || (r.title || '').toLowerCase().includes(normalizedSearch))
    .filter(r => matchesQuickQuery(r.title, quickQuery))
    .filter(r => dateMatches(r.target_date))
    .filter(r => filterCats.length === 0 || filterCats.some(fc => parseCatIds(r.category_ids, r.category_id).includes(fc)))
    .filter(r => filterTypes.length === 0 || filterTypes.includes(getRepoType(r, objectiveById)))
    .filter(r => statusFilter === 'all' || (statusFilter === 'discarded' ? r.status === 'discarded' : r.status !== 'discarded'))
    .sort((a, b) => {
      const aType = getRepoType(a, objectiveById);
      const bType = getRepoType(b, objectiveById);
      const orderDiff = (TYPE_ORDER[aType] ?? 99) - (TYPE_ORDER[bType] ?? 99);
      if (orderDiff !== 0) return orderDiff;
      const ad = a.target_date || '9999-99-99';
      const bd = b.target_date || '9999-99-99';
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.title || '').localeCompare(b.title || '', 'es');
    });
  const countedRepos = repos.filter(r => !['postponed', 'discarded', 'failed'].includes(r.status));
  const totalRepos = countedRepos.length;
  const publishedRepos = countedRepos.filter(r => r.status === 'published').length;
  const completedRepos = countedRepos.filter(r => ['completed', 'published', 'finished'].includes(r.status)).length;
  const inProgressRepos = countedRepos.filter(r => r.status === 'in_progress').length;
  const progressPct = totalRepos > 0 ? Math.round((completedRepos / totalRepos) * 100) : 0;

  return (
    <div>
      <QuickTypeSearch query={quickQuery} onQueryChange={setQuickQuery} label="proyectos" />
      <div className="page-header">
        <div>
          <div className="page-title">Proyectos</div>
          <div className="page-subtitle">{visible.length} proyectos</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nuevo</button>
      </div>

      {creating && (
        <DetailDialog repo={null} objectives={objectives} onClose={() => setCreating(false)} onSaved={load} onDeleted={load} />
      )}
      {selected && (
        <DetailDialog repo={selected} objectives={objectives} onClose={() => setSelected(null)} onSaved={load} onDeleted={() => { setSelected(null); load(); }} />
      )}

      <ContentMetricsSummary
        title="Resumen de proyectos"
        metrics={[
          { label: 'Proyectos', value: totalRepos, sub: 'registrados en total' },
          { label: 'Publicados', value: publishedRepos, sub: `de ${totalRepos} total`, valueStyle: { color: 'var(--success)' } },
          { label: 'En desarrollo', value: inProgressRepos, sub: 'trabajo activo', valueStyle: { color: '#2563eb' } },
          { label: 'Progreso global', value: `${progressPct}%`, sub: `${completedRepos}/${totalRepos} completados`, valueStyle: { color: 'var(--accent)' } },
        ]}
      />

      <ContentSearchFilters
        title={searchTitle}
        onTitleChange={setSearchTitle}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        selectedCats={filterCats}
        onSelectedCatsChange={setFilterCats}
        availableCatIds={usedCatIds}
        extraFilters={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por estado">
              <option value="active">Activos</option>
              <option value="all">Todos</option>
              <option value="discarded">Descartado</option>
            </select>
            {TYPE_OPTIONS.map(type => {
              const active = filterTypes.includes(type.value);
              return (
                <span
                  key={type.value}
                  onClick={() => setFilterTypes(prev => prev.includes(type.value) ? prev.filter(t => t !== type.value) : [...prev, type.value])}
                  style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '3px 10px',
                    borderRadius: 10,
                    background: active ? 'var(--accent-light)' : 'var(--bg)',
                    color: active ? 'var(--accent)' : 'var(--text-3)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    fontWeight: active ? 600 : 400,
                    userSelect: 'none',
                  }}
                >
                  {type.label}
                </span>
              );
            })}
          </div>
        }
      />

      {visible.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          {filterCats.length > 0 || filterTypes.length > 0 || searchTitle || fromDate || toDate ? 'Sin resultados' : 'Sin proyectos'}
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {visible.map(repo => {
              const days = repo.days_remaining;
              const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
              const catIds = parseCatIds(repo.category_ids, repo.category_id);
              const effectiveType = getRepoType(repo, objectiveById);
              const icon = effectiveType === 'notes' ? '📝' : effectiveType === 'client' ? '👤' : effectiveType === 'sangalan' ? '💼' : '🙂';
              const typeLabel = TYPE_OPTIONS.find(t => t.value === effectiveType)?.label || 'Personal';
              return (
                <div key={repo.id} className="task-row project-list-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(repo)}>
                  <div className="task-info">
                    <div className="project-list-heading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="project-list-name" style={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>{icon} {repo.title}</span>
                      {repo.url && (
                        <a href={repo.url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace' }}>
                          ↗ GitHub
                        </a>
                      )}
                    </div>
                    <div className="task-meta">
                      <span className={`milestone-days ${cls}`}>
                        {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}
                      </span>
                      <span className="task-time">{fmtDate(repo.target_date)}</span>
                      <span className="task-time">Tipo: {typeLabel}</span>
                    </div>
                    {catIds.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        <CategoryBadges ids={catIds} />
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                    background: ['completed', 'published', 'finished'].includes(repo.status) ? '#dcfce7' : repo.status === 'in_progress' ? '#dbeafe' : 'var(--bg)',
                    color: ['completed', 'published', 'finished'].includes(repo.status) ? '#16a34a' : repo.status === 'in_progress' ? '#2563eb' : 'var(--text-2)',
                  }}>
                    {repo.status === 'finished' ? 'Completado' : STATUS_OPTIONS.find(s => s.value === repo.status)?.label || repo.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
