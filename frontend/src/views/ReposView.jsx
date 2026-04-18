import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../utils/dateUtils.js';
import { CategoryBadges, CategoryOption, useCats } from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import ContentSearchFilters from '../components/ContentSearchFilters.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En desarrollo' },
  { value: 'completed',   label: 'Publicado ✓' },
];
const TYPE_OPTIONS = [
  { value: 'client', label: 'Cliente' },
  { value: 'sangalan', label: 'Sangalan' },
  { value: 'personal', label: 'Personal' },
];
const TYPE_ORDER = { client: 0, sangalan: 1, personal: 2 };

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const fieldW = { marginBottom: 14 };

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

function CategorySelector({ selected, onChange }) {
  const cats = useCats();
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {cats.map(cat => {
        const active = selected.includes(cat.id);
        return <CategoryOption key={cat.id} cat={cat} active={active} onClick={() => toggle(cat.id)} />;
      })}
    </div>
  );
}

export function DetailDialog({ repo, objectives, onClose, onSaved, onDeleted }) {
  useEscapeClose(onClose);
  const isNew = !repo;
  const initCatIds = parseCatIds(repo?.category_ids, repo?.category_id);
  const [form, setForm] = useState({
    title: repo?.title || '',
    target_date: repo?.target_date || '',
    type: repo?.type || 'personal',
    status: repo?.status || 'not_started',
    objective_id: repo?.objective_id || '',
    url: repo?.url || '',
    notes: repo?.notes || '',
  });
  const [catIds, setCatIds] = useState(initCatIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    if (isNew) {
      await api.createRepo({ ...form, objective_id: form.objective_id || null, url: form.url || null, category_ids: catIds, category_id: catIds[0] || null });
    } else {
      await api.updateRepo(repo.id, { ...form, objective_id: form.objective_id || null, url: form.url || null, category_ids: catIds, category_id: catIds[0] || null });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const days = repo?.days_remaining;
  const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 28,
        maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>📦 {isNew ? 'Nuevo proyecto' : 'Proyecto'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Título *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} autoFocus />
          </div>
          <div>
            <label style={labelSt}>Fecha objetivo</label>
            <SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Tipo</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%' }}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Objetivo</label>
            <select value={form.objective_id} onChange={e => set('objective_id', e.target.value)} style={{ width: '100%' }}>
              <option value="">Sin objetivo</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
        </div>

        <div style={fieldW}>
          <label style={labelSt}>URL GitHub</label>
          <input type="url" value={form.url} onChange={e => set('url', e.target.value)}
            placeholder="https://github.com/usuario/proyecto"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Categorías</label>
          <CategorySelector selected={catIds} onChange={setCatIds} />
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Notas</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!isNew ? (
            <button className="btn btn-ghost" onClick={async () => {
              if (!confirm('¿Eliminar este proyecto?')) return;
              setDeleting(true);
              const r = await api.deleteRepo(repo.id);
              setDeleting(false);
              if (r.error) { alert(r.error); return; }
              onDeleted(); onClose();
            }} disabled={deleting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
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
    .filter(r => dateMatches(r.target_date))
    .filter(r => filterCats.length === 0 || filterCats.some(fc => parseCatIds(r.category_ids, r.category_id).includes(fc)))
    .filter(r => filterTypes.length === 0 || filterTypes.includes(getRepoType(r, objectiveById)))
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
  const totalRepos = repos.length;
  const completedRepos = repos.filter(r => r.status === 'completed').length;
  const inProgressRepos = repos.filter(r => r.status === 'in_progress').length;
  const progressPct = totalRepos > 0 ? Math.round((completedRepos / totalRepos) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Proyectos</div>
          <div className="page-subtitle">{visible.length} proyectos</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nuevo</button>
      </div>

      {creating && (
        <DetailDialog repo={null} objectives={objectives} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} onDeleted={() => {}} />
      )}
      {selected && (
        <DetailDialog repo={selected} objectives={objectives} onClose={() => setSelected(null)} onSaved={load} onDeleted={() => { setSelected(null); load(); }} />
      )}

      <ContentMetricsSummary
        title="Resumen de proyectos"
        metrics={[
          { label: 'Proyectos', value: totalRepos, sub: 'registrados en total' },
          { label: 'Publicados', value: completedRepos, sub: `de ${totalRepos} total`, valueStyle: { color: 'var(--success)' } },
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
              const icon = effectiveType === 'client' ? '👤' : effectiveType === 'sangalan' ? '💼' : '🙂';
              const typeLabel = TYPE_OPTIONS.find(t => t.value === effectiveType)?.label || 'Personal';
              return (
                <div key={repo.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(repo)}>
                  <div className="task-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>{icon} {repo.title}</span>
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
                    background: repo.status === 'completed' ? '#dcfce7' : repo.status === 'in_progress' ? '#dbeafe' : 'var(--bg)',
                    color: repo.status === 'completed' ? '#16a34a' : repo.status === 'in_progress' ? '#2563eb' : 'var(--text-2)',
                  }}>
                    {STATUS_OPTIONS.find(s => s.value === repo.status)?.label || repo.status}
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
