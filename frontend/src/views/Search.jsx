import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, formatDuration } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import CatBadge from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'task', label: 'Tareas' },
  { value: 'event', label: 'Eventos' },
  { value: 'publication', label: 'Publicaciones' },
  { value: 'certification', label: 'Certificaciones' },
  { value: 'repo', label: 'Proyectos' },
  { value: 'pr', label: 'PRs' },
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

const TYPE_META = {
  task: { label: 'Tareas', icon: '✅' },
  event: { label: 'Eventos', icon: '🎪' },
  publication: { label: 'Publicaciones', icon: '✍️' },
  certification: { label: 'Certificaciones', icon: '🏆' },
  repo: { label: 'Proyectos', icon: '📦' },
  pr: { label: 'PRs', icon: '🔀' },
  reading: { label: 'Para Leer', icon: '📚' },
  document: { label: 'Documentos', icon: '📁' },
  objective: { label: 'Objetivos', icon: '🎯' },
  milestone: { label: 'Hitos', icon: '📍' },
};

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
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

export default function Search() {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('2026-04-01');
  const [to, setTo] = useState('2026-06-30');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [objFilter, setObjFilter] = useState('');
  const [typeFilters, setTypeFilters] = useState([]);
  const [results, setResults] = useState([]);
  const [collapsedKinds, setCollapsedKinds] = useState({});
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [editTask, setEditTask] = useState(null);
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

      const objMap = Object.fromEntries(allObjectives.map(o => [o.id, o]));

      const items = [
        ...tasks.map(t => ({
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
          kind: 'objective',
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
          const ad = a.date || '0000-00-00';
          const bd = b.date || '0000-00-00';
          if (ad !== bd) return bd.localeCompare(ad);
          return (a.title || '').localeCompare(b.title || '', 'es');
        });

      setResults(filtered);
      const nextCollapsed = {};
      filtered.forEach(item => {
        if (nextCollapsed[item.kind] === undefined) nextCollapsed[item.kind] = true;
      });
      setCollapsedKinds(nextCollapsed);
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

  const grouped = results.reduce((acc, it) => {
    if (!acc[it.kind]) acc[it.kind] = [];
    acc[it.kind].push(it);
    return acc;
  }, {});

  const orderedKinds = Object.keys(TYPE_META).filter(k => grouped[k]?.length);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Búsqueda global</div>
          <div className="page-subtitle">Busca en tareas, eventos, publicaciones, certs, repos, PRs, lectura, documentos, objetivos e hitos</div>
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
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{grouped[kind].length}</span>
          </div>
          {!collapsedKinds[kind] && (
            <div style={{ padding: '0 18px' }}>
              {grouped[kind].map(item => (
                <div key={`${item.kind}-${item.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  {item.kind === 'task' ? (
                    <div
                      className={`task-check ${item.status === 'completed' ? 'checked' : ''}`}
                      style={{ marginTop: 1, flexShrink: 0 }}
                      onClick={() => toggleTask(item)}
                      title={item.status === 'completed' ? 'Desmarcar' : 'Completar'}
                    >
                      {item.status === 'completed' ? '✓' : ''}
                    </div>
                  ) : (
                    <div style={{ width: 22, textAlign: 'center', flexShrink: 0, marginTop: 2 }}>{TYPE_META[item.kind].icon}</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0, cursor: item.kind === 'task' ? 'pointer' : 'default' }} onClick={() => item.kind === 'task' ? setEditTask(item.raw) : null}>
                    <div className={`task-title ${item.status === 'completed' ? 'done' : ''}`}>{item.title}</div>
                    <div className="task-meta">
                      {item.date && <span className="task-time">{fmtDate(item.date)}</span>}
                      {item.start_time && <span className="task-time">{item.start_time}–{item.end_time}</span>}
                      {item.duration_estimated > 0 && <span className="task-time">({formatDuration(item.duration_estimated)})</span>}
                      {item.status && <span className={`badge badge-${item.status}`}>{statusText(item.status)}</span>}
                    </div>
                    {item.category_ids.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        {item.category_ids.map(cid => <CatBadge key={`${item.id}-${cid}`} id={cid} />)}
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
    </div>
  );
}

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
