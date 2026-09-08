import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, formatDuration, formatActualDuration } from '../utils/dateUtils.js';
import { CategoryBadges } from '../components/CatBadge.jsx';
import TaskModal from '../components/TaskModal.jsx';
import DeadlineModal, { DeadlineChip } from '../components/DeadlineModal.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';
import ContentSearchFilters from '../components/ContentSearchFilters.jsx';
import { canCompleteTask, isTodoTask } from '../utils/taskUtils.js';

const TASK_STATUS_OPTIONS = [
  { value: '', label: 'Estado: Todos' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Completada' },
  { value: 'blocked', label: 'Bloqueada' },
];

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function compareTasks(a, b) {
  const ad = a.date || '9999-12-31';
  const bd = b.date || '9999-12-31';
  if (ad !== bd) return ad.localeCompare(bd);
  const at = a.start_time || '99:99';
  const bt = b.start_time || '99:99';
  return at.localeCompare(bt);
}

export default function TasksView() {
  const [tasks, setTasks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    todo: false,
    overdue: true,
    pending: true,
    in_progress: true,
    blocked: true,
    completed: true,
    deadlines: false,
  });
  const [searchTitle, setSearchTitle] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterCats, setFilterCats] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    const [data, deadlineRows] = await Promise.all([api.tasks(), api.deadlines()]);
    setTasks(data.sort(compareTasks));
    setDeadlines(deadlineRows);
  }

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'completed').length;
    const pending = total - done;
    const overdue = tasks.filter(t => !!t.is_overdue && t.status !== 'completed').length;
    return { total, done, pending, overdue };
  }, [tasks]);

  const usedCatIds = useMemo(
    () => [...new Set(tasks.flatMap(t => parseCatIds(t.category_ids, t.category_id)))],
    [tasks]
  );

  const visible = useMemo(() => {
    const q = searchTitle.trim().toLowerCase();
    return tasks
      .filter(t => !q || (t.title || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))
      .filter(t => {
        const d = t.date || '';
        if (!d) return !fromDate && !toDate;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      })
      .filter(t => !statusFilter || t.status === statusFilter)
      .filter(t => filterCats.length === 0 || filterCats.some(fc => parseCatIds(t.category_ids, t.category_id).includes(fc)));
  }, [tasks, searchTitle, fromDate, toDate, filterCats, statusFilter]);

  async function toggleTask(task) {
    if (!canCompleteTask(task)) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: newStatus, percentage_completed: newStatus === 'completed' ? 100 : task.percentage_completed });
    load();
  }

  const overdueTasks = visible.filter(t => !isTodoTask(t) && !!t.is_overdue && t.status !== 'completed');
  const todoTasks = visible.filter(isTodoTask);
  const pendingTasks = visible.filter(t => !isTodoTask(t) && t.status === 'pending' && !t.is_overdue);
  const inProgressTasks = visible.filter(t => !isTodoTask(t) && t.status === 'in_progress' && !t.is_overdue);
  const blockedTasks = visible.filter(t => !isTodoTask(t) && t.status === 'blocked' && !t.is_overdue);
  const completedTasks = visible.filter(t => !isTodoTask(t) && t.status === 'completed');
  const visibleDeadlines = deadlines.filter(deadline => {
    if (searchTitle && !deadline.title.toLowerCase().includes(searchTitle.trim().toLowerCase())) return false;
    if (fromDate && deadline.date < fromDate) return false;
    if (toDate && deadline.date > toDate) return false;
    return !statusFilter && filterCats.length === 0;
  });

  function renderTaskRow(task) {
    const catIds = parseCatIds(task.category_ids, task.category_id);
    return (
      <div key={task.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setEditing(task)}>
        {canCompleteTask(task) ? (
          <div className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
            onClick={e => { e.stopPropagation(); toggleTask(task); }}
            title={task.status === 'completed' ? 'Desmarcar' : 'Completar'}>
            {task.status === 'completed' ? '✓' : ''}
          </div>
        ) : (
          <div style={{ width: 22, flexShrink: 0 }} />
        )}
        <div className="task-info">
          <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`}>{task.title}</div>
          <div className="task-meta">
            {isTodoTask(task) && <span className="badge badge-pending">ToDo</span>}
            {task.date && <span className="task-time">{fmtDate(task.date)}</span>}
            {task.start_time && <span className="task-time">{task.start_time}{task.end_time ? `-${task.end_time}` : ''}</span>}
            {task.duration_estimated > 0 && <span className="task-time">{formatDuration(task.duration_estimated)}</span>}
          </div>
          {catIds.length > 0 && (
            <div className="task-meta" style={{ marginTop: 3 }}>
              <CategoryBadges ids={catIds} />
            </div>
          )}
        </div>
        {task.status === 'completed' && (
          <span className="badge badge-completed">Completada{formatActualDuration(task.actual_seconds) && ` · ${formatActualDuration(task.actual_seconds)}`}</span>
        )}
      </div>
    );
  }

  function renderDeadlineRow(deadline) {
    return <div key={deadline.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setEditingDeadline(deadline)}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: deadline.color, flexShrink: 0, marginTop: 4 }} />
      <div className="task-info"><div className="task-title">{deadline.title}</div><div className="task-meta"><span className="task-time">{fmtDate(deadline.date)}</span></div></div>
      <DeadlineChip deadline={deadline} compact onClick={setEditingDeadline} />
    </div>;
  }

  function renderSection(key, label, list, emptyText, renderRow = renderTaskRow) {
    const collapsed = collapsedSections[key];
    return (
      <div key={key} className="card" style={{ marginBottom: 14 }}>
        <div
          className="card-header"
          onClick={() => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }))}
          style={{ cursor: 'pointer' }}
        >
          <span className="card-title">
            <span style={{ display: 'inline-block', width: 16 }}>{collapsed ? '▸' : '▾'}</span>{label} {list.length}
          </span>
        </div>
        {!collapsed && (
          <div style={{ padding: '0 18px' }}>
            {list.length === 0 ? (
              <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--text-3)' }}>{emptyText}</div>
            ) : list.map(renderRow)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tareas</div>
          <div className="page-subtitle">{visible.length} visibles · {summary.total} total</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nueva tarea</button>
      </div>

      {creating && (
        <TaskModal
          initial={{ date: new Date().toISOString().slice(0, 10) }}
          onClose={() => setCreating(false)}
          onSave={() => { setCreating(false); load(); }}
        />
      )}
      {editing && (
        <TaskModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={() => { setEditing(null); load(); }}
          onDeleted={() => { setEditing(null); load(); }}
        />
      )}
      {editingDeadline && <DeadlineModal initial={editingDeadline} onClose={() => setEditingDeadline(null)}
        onSave={() => { setEditingDeadline(null); load(); }} onDeleted={() => { setEditingDeadline(null); load(); }} />}

      <ContentMetricsSummary
        title="Resumen de tareas"
        metrics={[
          { label: 'Tareas totales', value: summary.total, sub: 'registradas en el sistema' },
          { label: 'Pendientes', value: summary.pending, sub: 'por completar', valueStyle: { color: '#2563eb' } },
          { label: 'Completadas', value: summary.done, sub: `de ${summary.total} total`, valueStyle: { color: 'var(--success)' } },
          { label: 'Vencidas', value: summary.overdue, sub: 'pendientes fuera de fecha', valueStyle: { color: '#dc2626' } },
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px)', gap: 8 }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%' }}>
              {TASK_STATUS_OPTIONS.map(option => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        }
      />

      {visible.length === 0 && visibleDeadlines.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          {searchTitle || fromDate || toDate || filterCats.length > 0 || statusFilter ? 'Sin resultados' : 'No hay tareas todavía'}
        </div>
      ) : (
        <>
          {renderSection('deadlines', 'Fechas límite', visibleDeadlines, 'Sin fechas límite', renderDeadlineRow)}
          {renderSection('todo', 'ToDo', todoTasks, 'Sin ToDo')}
          {renderSection('overdue', 'Vencidas', overdueTasks, 'Sin tareas vencidas')}
          {renderSection('pending', 'Pendientes', pendingTasks, 'Sin tareas pendientes')}
          {renderSection('in_progress', 'En curso', inProgressTasks, 'Sin tareas en curso')}
          {renderSection('blocked', 'Bloqueadas', blockedTasks, 'Sin tareas bloqueadas')}
          {renderSection('completed', 'Completadas', completedTasks, 'Sin tareas completadas')}
        </>
      )}
    </div>
  );
}
