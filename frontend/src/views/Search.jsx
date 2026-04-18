import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, formatDuration } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import { CategoryBadges } from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'task', label: 'Tareas' },
  { value: 'client', label: 'Clientes' },
  { value: 'event', label: 'Eventos' },
  { value: 'publication', label: 'Publicaciones' },
  { value: 'certification', label: 'Certificaciones' },
  { value: 'repo', label: 'Proyectos' },
  { value: 'pr', label: 'Pull Requests' },
  { value: 'reading', label: 'Para Leer' },
  { value: 'document', label: 'Documentos' },
  { value: 'objective', label: 'Objetivos' },
  { value: 'milestone', label: 'Hitos' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'review', label: 'En review' },
  { value: 'completed', label: 'Completado' },
  { value: 'failed', label: 'Fallido' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'read', label: 'Leído' },
];

const SORT_OPTIONS = [
  { value: 'alpha', label: 'Título (A-Z)' },
  { value: 'date_desc', label: 'Fecha (más reciente)' },
];

const TYPE_META = {
  task: { label: 'Tareas', icon: '✅' },
  client: { label: 'Clientes', icon: '👤' },
  event: { label: 'Eventos', icon: '🎪' },
  publication: { label: 'Publicaciones', icon: '✍️' },
  certification: { label: 'Certificaciones', icon: '🏆' },
  repo: { label: 'Proyectos', icon: '📦' },
  pr: { label: 'Pull Requests', icon: '🔀' },
  reading: { label: 'Para Leer', icon: '📚' },
  document: { label: 'Documentos', icon: '📁' },
  objective: { label: 'Objetivos', icon: '🎯' },
  milestone: { label: 'Hitos', icon: '🏁' },
};

const KIND_ORDER = ['task', 'client', 'publication', 'certification', 'repo', 'pr', 'event', 'reading', 'document', 'objective'];

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function collapseFixedTasks(taskRows) {
  const byId = new Map();
  for (const task of taskRows) {
    const prev = byId.get(task.id);
    if (!prev) {
      byId.set(task.id, { ...task });
      continue;
    }
    // /api/tasks expands fixed tasks as virtual daily instances.
    // Keep a single representative row (earliest date in the filtered range).
    const prevDate = prev.date || '9999-12-31';
    const currDate = task.date || '9999-12-31';
    if (currDate < prevDate) byId.set(task.id, { ...task });
  }
  return Array.from(byId.values());
}

function statusText(status) {
  if (!status) return '';
  const fromOptions = STATUS_OPTIONS.find(s => s.value === status);
  if (fromOptions) return fromOptions.label;
  return statusLabel(status);
}

function includesQuery(item, q) {
  if (!q) return true;
  const qq = q.toLowerCase();
  return (
    (item.title || '').toLowerCase().includes(qq) ||
    (item.notes || '').toLowerCase().includes(qq)
  );
}

function matchesDate(item, from, to) {
  if (!from && !to) return true;

  const date = item.date || null;
  const start = item.start_date || date;
  const end = item.end_date || date;
  if (!start && !end) return false;

  const s = start || end;
  const e = end || start;
  if (from && e < from) return false;
  if (to && s > to) return false;
  return true;
}

function SearchEditModal({ item, objectives, onClose, onSaved }) {
  useEscapeClose(onClose);
  const raw = item?.raw || {};
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState(null);
  const [form, setForm] = useState({
    title: raw.title || raw.name || '',
    notes: raw.notes || '',
    status: raw.status || '',
    objective_id: raw.objective_id || '',
    date: raw.date || raw.target_date || '',
    start_date: raw.start_date || '',
    end_date: raw.end_date || '',
    percentage_completed: raw.percentage_completed ?? 0,
    type: raw.type || 'personal',
    url: raw.url || '',
    location: raw.location || '',
    format: raw.format || '',
    estimated_cost: raw.estimated_cost ?? 0,
    description: raw.description || '',
    target_value: raw.target_value || '',
    priority: raw.priority ?? 2,
    urls: Array.isArray(raw.urls) ? raw.urls.join('\n') : (typeof raw.urls === 'string' ? raw.urls : ''),
  });

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function save() {
    setDeleteWarning(null);
    setSaving(true);
    try {
      if (item.kind === 'publication') {
        await api.updatePublication(item.id, {
          title: form.title,
          date: form.date || null,
          status: form.status || null,
          notes: form.notes || null,
          objective_id: form.objective_id || null,
        });
      } else if (item.kind === 'certification') {
        await api.updateCertification(item.id, {
          status: form.status || null,
          notes: form.notes || null,
          objective_id: form.objective_id || null,
          percentage_completed: Number(form.percentage_completed) || 0,
        });
      } else if (item.kind === 'repo') {
        await api.updateRepo(item.id, {
          title: form.title,
          target_date: form.date || null,
          type: form.type || null,
          status: form.status || null,
          notes: form.notes || null,
          objective_id: form.objective_id || null,
          url: form.url || null,
        });
      } else if (item.kind === 'pr') {
        await api.updatePR(item.id, {
          status: form.status || null,
          notes: form.notes || null,
          objective_id: form.objective_id || null,
          percentage_completed: Number(form.percentage_completed) || 0,
        });
      } else if (item.kind === 'event') {
        await api.updateEvent(item.id, {
          title: form.title,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          location: form.location || null,
          format: form.format || null,
          estimated_cost: Number(form.estimated_cost) || 0,
          status: form.status || null,
          notes: form.notes || null,
          objective_id: form.objective_id || null,
          percentage_completed: Number(form.percentage_completed) || 0,
        });
      } else if (item.kind === 'reading') {
        const urls = form.urls.split('\n').map(u => u.trim()).filter(Boolean);
        await api.updateReadingItem(item.id, {
          title: form.title,
          notes: form.notes || null,
          status: form.status || null,
          urls,
        });
      } else if (item.kind === 'document') {
        await api.updateDocument(item.id, { name: form.title });
      } else if (item.kind === 'objective' || item.kind === 'client') {
        await api.updateObjective(item.id, {
          title: form.title,
          description: form.description || null,
          target_value: form.target_value || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          priority: Number(form.priority) || 2,
          status: form.status || null,
          notes: form.notes || null,
          type: item.kind === 'client' ? 'client' : 'objective',
        });
      } else if (item.kind === 'milestone') {
        await api.updateMilestone(item.id, {
          title: form.title,
          description: form.description || null,
          target_date: form.date || null,
          status: form.status || null,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      alert(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function removeMilestone() {
    if (item.kind !== 'milestone') return;
    if (!window.confirm(`¿Eliminar hito "${form.title || item.title}"?`)) return;
    setDeleting(true);
    setDeleteWarning(null);
    try {
      const r = await api.deleteMilestone(item.id);
      if (r?.error) {
        setDeleteWarning(r);
        return;
      }
      onSaved();
      onClose();
    } catch (e) {
      setDeleteWarning({ error: e?.message || 'No se pudo eliminar el hito' });
    } finally {
      setDeleting(false);
    }
  }

  const supportsObjective = ['publication', 'certification', 'repo', 'pr', 'event'].includes(item.kind);
  const supportsStatus = item.kind !== 'document';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>
            {item.kind === 'milestone' ? '🏁 Hito' : `Editar ${TYPE_META[item.kind]?.label || item.kind}`}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)' }}>✕</button>
        </div>

        {item.kind === 'event' || item.kind === 'pr' || item.kind === 'objective' || item.kind === 'client' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelSt}>Desde</label>
              <SpanishDateInput value={form.start_date} onChange={v => set('start_date', v)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelSt}>Hasta</label>
              <SpanishDateInput value={form.end_date} onChange={v => set('end_date', v)} style={{ width: '100%' }} />
            </div>
          </div>
        ) : item.kind !== 'document' && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>Fecha</label>
            <SpanishDateInput value={form.date} onChange={v => set('date', v)} style={{ width: '100%' }} />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>{item.kind === 'document' ? 'Nombre' : 'Título'}</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} style={inputSt} />
        </div>

        {item.kind === 'repo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelSt}>Tipo</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={selectSt}>
                <option value="client">Cliente</option>
                <option value="sangalan">Sangalan</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>URL</label>
              <input value={form.url} onChange={e => set('url', e.target.value)} style={inputSt} />
            </div>
          </div>
        )}

        {item.kind === 'event' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelSt}>Lugar</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Formato</label>
              <input value={form.format} onChange={e => set('format', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Coste</label>
              <input value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} style={inputSt} />
            </div>
          </div>
        )}

        {supportsObjective && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>Objetivo</label>
            <select value={form.objective_id} onChange={e => set('objective_id', e.target.value)} style={selectSt}>
              <option value="">Sin objetivo</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
        )}

        {(item.kind === 'objective' || item.kind === 'client') && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelSt}>Descripción</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} style={textareaSt} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelSt}>Meta</label>
                <input value={form.target_value} onChange={e => set('target_value', e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Prioridad</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)} style={selectSt}>
                  <option value={1}>Alta ★</option>
                  <option value={2}>Normal</option>
                  <option value={3}>Baja</option>
                </select>
              </div>
            </div>
          </>
        )}

        {item.kind === 'milestone' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelSt}>Descripción</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={textareaSt} />
            </div>
          </>
        )}

        {(item.kind === 'certification' || item.kind === 'pr' || item.kind === 'event') && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>% completado</label>
            <input type="range" min="0" max="100" step="5" value={form.percentage_completed} onChange={e => set('percentage_completed', Number(e.target.value))} style={{ width: '100%' }} />
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{form.percentage_completed}%</div>
          </div>
        )}

        {item.kind === 'reading' && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>URLs (una por línea)</label>
            <textarea value={form.urls} onChange={e => set('urls', e.target.value)} rows={3} style={textareaSt} />
          </div>
        )}

        {supportsStatus && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={selectSt}>
              <option value="">Sin cambio</option>
              {STATUS_OPTIONS.filter(s => s.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}

        {item.kind !== 'document' && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>Notas</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={textareaSt} />
          </div>
        )}

        {deleteWarning && (
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            background: '#fff1f2',
            color: '#7f1d1d',
            fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No se puede eliminar el hito</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{deleteWarning.error}</div>
            {Array.isArray(deleteWarning.usages) && deleteWarning.usages.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {deleteWarning.usages.map((u) => (
                  <div key={u.type} style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>{u.type} ({u.count})</div>
                    <div style={{ color: '#9f1239' }}>
                      {(u.items || []).slice(0, 8).map(it => {
                        const d = it.date ? ` (${it.date})` : '';
                        return `${it.title}${d}`;
                      }).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {item.kind === 'milestone' ? (
            <button className="btn btn-ghost" onClick={removeMilestone} disabled={deleting || saving} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || deleting}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Search() {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('2026-04-01');
  const [to, setTo] = useState('2026-06-30');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [objFilter, setObjFilter] = useState('');
  const [typeFilters, setTypeFilters] = useState([]);
  const [sortBy, setSortBy] = useState('alpha');
  const [results, setResults] = useState([]);
  const [collapsedKinds, setCollapsedKinds] = useState({});
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [editTask, setEditTask] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const debounce = useRef(null);

  useEffect(() => {
    api.categories().then(setCats);
    api.objectives().then(setObjectives);
  }, []);

  async function doSearch(overrides = {}) {
    const activeQ = overrides.q ?? q;
    const activeFrom = overrides.from ?? from;
    const activeTo = overrides.to ?? to;
    const activeCat = overrides.catFilter ?? catFilter;
    const activeStatus = overrides.statusFilter ?? statusFilter;
    const activeObj = overrides.objFilter ?? objFilter;
    const activeTypes = overrides.typeFilters ?? typeFilters;
    const activeSort = overrides.sortBy ?? sortBy;

    setLoading(true);
    try {
      const [tasks, events, publications, certifications, repos, prs, readingList, documents, allObjectives, milestones] = await Promise.all([
        api.tasks({ from: activeFrom, to: activeTo }),
        api.events({ from: activeFrom, to: activeTo }),
        api.publications({ from: activeFrom, to: activeTo }),
        api.certifications(),
        api.repos(),
        api.prs(),
        api.readingList(),
        api.documents(),
        api.objectives(),
        api.milestones(),
      ]);
      const uniqueTasks = collapseFixedTasks(tasks);

      const objMap = Object.fromEntries(allObjectives.map(o => [o.id, o]));

      const items = [
        ...uniqueTasks.map(t => ({
          kind: 'task',
          id: t.id,
          title: t.title,
          notes: t.notes || '',
          date: t.date || null,
          status: t.status || '',
          category_ids: parseCatIds(t.category_ids, t.category_id),
          objective_id: t.objective_id || '',
          duration_estimated: t.duration_estimated || 0,
          start_time: t.start_time || null,
          end_time: t.end_time || null,
          raw: t,
        })),
        ...events.map(e => ({
          kind: 'event',
          id: e.id,
          title: e.title,
          notes: e.notes || '',
          start_date: e.start_date || null,
          end_date: e.end_date || null,
          date: e.end_date || e.start_date || null,
          status: e.status || '',
          category_ids: parseCatIds(e.category_ids, e.category_id),
          objective_id: e.objective_id || '',
          raw: e,
        })),
        ...publications.map(p => ({
          kind: 'publication',
          id: p.id,
          title: p.title,
          notes: `${p.notes || ''} ${p.publication_text || ''}`.trim(),
          date: p.date || null,
          status: p.status || '',
          category_ids: parseCatIds(p.category_ids, p.category_id),
          objective_id: p.objective_id || '',
          raw: p,
        })),
        ...certifications.map(c => ({
          kind: 'certification',
          id: c.id,
          title: c.title,
          notes: c.notes || '',
          date: c.target_date || null,
          status: c.status || '',
          category_ids: parseCatIds(c.category_ids, c.category_id),
          objective_id: c.objective_id || '',
          raw: c,
        })),
        ...repos.map(r => ({
          kind: 'repo',
          id: r.id,
          title: r.title,
          notes: r.notes || '',
          date: r.target_date || null,
          status: r.status || '',
          category_ids: parseCatIds(r.category_ids, r.category_id),
          objective_id: r.objective_id || '',
          raw: r,
        })),
        ...prs.map(p => ({
          kind: 'pr',
          id: p.id,
          title: p.title,
          notes: p.notes || '',
          start_date: p.start_date || null,
          end_date: p.end_date || null,
          date: p.end_date || p.start_date || null,
          status: p.status || '',
          category_ids: parseCatIds(p.category_ids, p.category_id),
          objective_id: p.objective_id || '',
          raw: p,
        })),
        ...readingList.map(r => ({
          kind: 'reading',
          id: r.id,
          title: r.title,
          notes: r.notes || '',
          date: (r.created_at || '').slice(0, 10) || null,
          status: r.status || '',
          category_ids: parseCatIds(r.category_ids, r.category_id),
          objective_id: '',
          raw: r,
        })),
        ...documents.map(d => ({
          kind: 'document',
          id: d.id,
          title: d.name,
          notes: '',
          date: (d.created_at || '').slice(0, 10) || null,
          status: '',
          category_ids: Array.isArray(d.category_ids) ? d.category_ids : [],
          objective_id: '',
          raw: d,
        })),
        ...allObjectives.map(o => ({
          kind: o.type === 'client' ? 'client' : 'objective',
          id: o.id,
          title: o.title,
          notes: `${o.description || ''} ${o.notes || ''}`.trim(),
          start_date: o.start_date || null,
          end_date: o.end_date || null,
          date: o.end_date || o.start_date || null,
          status: o.status || '',
          category_ids: parseCatIds(o.category_ids, o.category_id),
          objective_id: o.id,
          raw: o,
        })),
        ...milestones.map(m => {
          const obj = objMap[m.objective_id];
          return {
            kind: 'milestone',
            id: m.id,
            title: m.title,
            notes: m.description || '',
            date: m.target_date || null,
            status: m.status || '',
            category_ids: obj ? parseCatIds(obj.category_ids, obj.category_id) : [],
            objective_id: m.objective_id || '',
            raw: m,
          };
        }),
      ];

      const filtered = items
        .filter(it => includesQuery(it, activeQ))
        .filter(it => matchesDate(it, activeFrom, activeTo))
        .filter(it => activeTypes.length === 0 || activeTypes.includes(it.kind))
        .filter(it => !activeStatus || it.status === activeStatus)
        .filter(it => !activeObj || it.objective_id === activeObj)
        .filter(it => !activeCat || it.category_ids.includes(activeCat))
        .sort((a, b) => {
          if (activeSort === 'date_desc') {
            const ad = a.date || '0000-00-00';
            const bd = b.date || '0000-00-00';
            if (ad !== bd) return bd.localeCompare(ad);
            return (a.title || '').localeCompare(b.title || '', 'es');
          }
          const titleCmp = (a.title || '').localeCompare(b.title || '', 'es');
          if (titleCmp !== 0) return titleCmp;
          const ad = a.date || '0000-00-00';
          const bd = b.date || '0000-00-00';
          return bd.localeCompare(ad);
        });

      setResults(filtered);
      setCollapsedKinds(prev => {
        const nextCollapsed = {};
        filtered.forEach(item => {
          if (nextCollapsed[item.kind] !== undefined) return;
          nextCollapsed[item.kind] = prev[item.kind] ?? true;
        });
        return nextCollapsed;
      });
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function onQueryChange(val) {
    setQ(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch({ q: val }), 350);
  }

  async function toggleTask(taskItem) {
    const task = taskItem.raw;
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns, percentage_completed: ns === 'completed' ? 100 : task.percentage_completed });
    doSearch();
  }

  function openItem(item) {
    if (item.kind === 'task') {
      setEditTask(item.raw);
      return;
    }
    setEditItem(item);
  }

  const grouped = results.reduce((acc, it) => {
    if (!acc[it.kind]) acc[it.kind] = [];
    acc[it.kind].push(it);
    return acc;
  }, {});

  const orderedKinds = [
    ...KIND_ORDER.filter(k => grouped[k]?.length),
    ...Object.keys(grouped).filter(k => !KIND_ORDER.includes(k)),
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Búsqueda global</div>
          <div className="page-subtitle">Busca en tareas, clientes, publicaciones, certs, proyectos, pull requests, eventos, lectura, documentos, objetivos e hitos</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Buscar por nombre o notas</label>
          <input
            type="text"
            value={q}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Escribe para buscar…"
            style={{ width: '100%', fontSize: 14 }}
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelSt}>Desde</label>
            <SpanishDateInput value={from} onChange={setFrom} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={labelSt}>Hasta</label>
            <SpanishDateInput value={to} onChange={setTo} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={labelSt}>Categoría</label>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todas</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Objetivo</label>
            <select value={objFilter} onChange={e => setObjFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todos</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Estado</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%' }}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Ordenar por</label>
            <select
              value={sortBy}
              onChange={e => {
                const nextSort = e.target.value;
                setSortBy(nextSort);
                if (searched) doSearch({ sortBy: nextSort });
              }}
              style={{ width: '100%' }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Tipo de elemento</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TYPE_OPTIONS.filter(o => o.value).map(o => (
              <button
                key={o.value}
                type="button"
                className={`chip ${typeFilters.includes(o.value) ? 'active' : ''}`}
                onClick={() => setTypeFilters(prev =>
                  prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => doSearch()}>
            🔍 Buscar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            setQ('');
            setFrom('2026-04-01');
            setTo('2026-06-30');
            setCatFilter('');
            setStatusFilter('');
            setObjFilter('');
            setTypeFilters([]);
            setSortBy('alpha');
            setResults([]);
            setSearched(false);
          }}>
            Limpiar
          </button>
          {searched && !loading && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </span>
          )}
          {loading && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Buscando…</span>}
        </div>
      </div>

      {searched && results.length === 0 && !loading && (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔎</div>
          Sin resultados para esos filtros
        </div>
      )}

      {orderedKinds.map(kind => (
        <div key={kind} className="card" style={{ marginBottom: 16 }}>
          <div
            className="card-header"
            onClick={() => setCollapsedKinds(prev => ({ ...prev, [kind]: !prev[kind] }))}
            style={{ cursor: 'pointer' }}
          >
            <span className="card-title">
              <span style={{ display: 'inline-block', width: 16 }}>{collapsedKinds[kind] ? '▸' : '▾'}</span>
              {TYPE_META[kind].icon} {TYPE_META[kind].label}
              <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                {grouped[kind].length}
              </span>
            </span>
          </div>
          {!collapsedKinds[kind] && (
            <div style={{ padding: '0 18px' }}>
              {grouped[kind].map(item => (
                <div
                  key={`${item.kind}-${item.id}`}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => openItem(item)}
                  title="Abrir para editar"
                >
                  {item.kind === 'task' ? (
                    <div
                      className={`task-check ${item.status === 'completed' ? 'checked' : ''}`}
                      style={{ marginTop: 1, flexShrink: 0 }}
                      onClick={(e) => { e.stopPropagation(); toggleTask(item); }}
                      title={item.status === 'completed' ? 'Desmarcar' : 'Completar'}
                    >
                      {item.status === 'completed' ? '✓' : ''}
                    </div>
                  ) : (
                    <div style={{ width: 22, textAlign: 'center', flexShrink: 0, marginTop: 2 }}>{TYPE_META[item.kind].icon}</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`task-title ${item.status === 'completed' ? 'done' : ''}`}>{item.title}</div>
                    <div className="task-meta">
                      {item.date && <span className="task-time">{fmtDate(item.date)}</span>}
                      {item.start_time && <span className="task-time">{item.start_time}–{item.end_time}</span>}
                      {item.duration_estimated > 0 && <span className="task-time">({formatDuration(item.duration_estimated)})</span>}
                      {item.status && <span className={`badge badge-${item.status}`}>{statusText(item.status)}</span>}
                    </div>
                    {item.category_ids.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        <CategoryBadges ids={item.category_ids} keyPrefix={`${item.id}-`} />
                      </div>
                    )}
                    {item.notes && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontStyle: 'italic' }}>{item.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {editTask && (
        <TaskModal
          initial={editTask}
          onClose={() => setEditTask(null)}
          onSave={() => { setEditTask(null); doSearch(); }}
          onDeleted={() => { setEditTask(null); doSearch(); }}
        />
      )}
      {editItem && (
        <SearchEditModal
          item={editItem}
          objectives={objectives}
          onClose={() => setEditItem(null)}
          onSaved={doSearch}
        />
      )}
    </div>
  );
}

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const inputSt = { width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 };
const selectSt = { width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 };
const textareaSt = { width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 };
