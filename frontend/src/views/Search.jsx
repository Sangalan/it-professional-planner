import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { fmtDate, formatDuration } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import CatBadge from '../components/CatBadge.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending',     label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed',   label: 'Completada' },
  { value: 'blocked',     label: 'Bloqueada' },
];

export default function Search() {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('2026-04-01');
  const [to, setTo]     = useState('2026-06-30');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [objFilter, setObjFilter] = useState('');
  const [results, setResults] = useState([]);
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
    const params = {
      q: overrides.q ?? q,
      from: overrides.from ?? from,
      to:   overrides.to   ?? to,
      ...((overrides.catFilter ?? catFilter) ? { category_id: overrides.catFilter ?? catFilter } : {}),
      ...((overrides.statusFilter ?? statusFilter) ? { status: overrides.statusFilter ?? statusFilter } : {}),
      ...((overrides.objFilter ?? objFilter) ? { objective_id: overrides.objFilter ?? objFilter } : {}),
    };
    // Remove empty params
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    setLoading(true);
    const data = await api.searchTasks(params);
    setResults(data);
    setSearched(true);
    setLoading(false);
  }

  function onQueryChange(val) {
    setQ(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch({ q: val }), 350);
  }

  async function toggleStatus(task) {
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns, percentage_completed: ns === 'completed' ? 100 : task.percentage_completed });
    doSearch();
  }

  const grouped = results.reduce((acc, t) => {
    const month = t.date.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(t);
    return acc;
  }, {});

  const monthLabels = { '2026-04': 'Abril 2026', '2026-05': 'Mayo 2026', '2026-06': 'Junio 2026' };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Búsqueda de tareas</div>
          <div className="page-subtitle">Filtra por nombre, fechas, categoría o estado</div>
        </div>
      </div>

      {/* Search panel */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        {/* Text search */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Buscar por nombre</label>
          <input
            type="text"
            value={q}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Escribe para buscar…"
            style={{ width: '100%', fontSize: 14 }}
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelSt}>Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={labelSt}>Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: '100%' }} />
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

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => doSearch()}>
            🔍 Buscar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            setQ(''); setFrom('2026-04-01'); setTo('2026-06-30');
            setCatFilter(''); setStatusFilter(''); setObjFilter('');
            setResults([]); setSearched(false);
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

      {/* Results */}
      {searched && results.length === 0 && !loading && (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔎</div>
          Sin resultados para esos filtros
        </div>
      )}

      {Object.entries(grouped).sort().map(([month, monthTasks]) => (
        <div key={month} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">{monthLabels[month] || month}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{monthTasks.length} tareas</span>
          </div>
          <div style={{ padding: '0 18px' }}>
            {monthTasks.map(task => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 0', borderBottom: '1px solid var(--border)',
                background: task.is_overdue && task.status !== 'completed' ? 'var(--danger-bg)' : 'transparent',
                margin: task.is_overdue ? '0 -18px' : 0,
                paddingLeft: task.is_overdue ? 18 : 0,
                paddingRight: task.is_overdue ? 18 : 0,
              }}>
                {/* Checkbox */}
                <div
                  className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
                  style={{ marginTop: 1, flexShrink: 0 }}
                  onClick={() => toggleStatus(task)}
                  title={task.status === 'completed' ? 'Desmarcar' : 'Completar'}
                >
                  {task.status === 'completed' ? '✓' : ''}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setEditTask(task)}>
                  <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`}>
                    {task.title}
                    {task.is_fixed === 1 && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--text-3)' }}>📌</span>}
                  </div>
                  <div className="task-meta">
                    <span className="task-time">{fmtDate(task.date)}</span>
                    {task.start_time && <span className="task-time">{task.start_time}–{task.end_time}</span>}
                    {task.duration_estimated > 0 && <span className="task-time">({formatDuration(task.duration_estimated)})</span>}
                    <CatBadge id={task.category_id} />
                    <span className={`badge badge-${task.status}`}>{statusLabel(task.status)}</span>
                    {task.priority === 1 && <span className="badge" style={{ background: '#fef9c3', color: '#92400e' }}>Alta ★</span>}
                    {task.is_overdue && task.status !== 'completed' && <span className="overdue-tag">Vencida</span>}
                  </div>
                  {task.notes && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontStyle: 'italic' }}>{task.notes}</div>}
                </div>

              </div>
            ))}
          </div>
        </div>
      ))}

      {editTask && (
        <TaskModal
          initial={editTask}
          onClose={() => setEditTask(null)}
          onSave={() => { setEditTask(null); doSearch(); }}
        />
      )}
    </div>
  );
}

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
