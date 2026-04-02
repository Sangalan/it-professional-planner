import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, fmtShortDate } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import CatBadge from '../components/CatBadge.jsx';
import TaskModal from '../components/TaskModal.jsx';

const STATUS_ICONS = {
  not_started: '⚪',
  in_progress: '🔵',
  completed:   '✅',
  blocked:     '🔴',
};


function SinHitoRow({ objId, orphanCount, orphanDone, onUpdate, onTaskMoved, version }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  async function fetchTasks() {
    const data = await api.tasks({ objective_id: objId, no_milestone: '1' });
    setTasks(data.sort((a, b) => a.date.localeCompare(b.date)));
  }

  useEffect(() => {
    if (expanded) fetchTasks();
  }, [version]);

  async function toggle(e) {
    e.stopPropagation();
    if (!expanded) await fetchTasks();
    setExpanded(v => !v);
  }

  async function toggleTask(task) {
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns });
    await fetchTasks();
    onUpdate();
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    await api.updateTask(taskId, { milestone_id: null });
    onTaskMoved();
  }

  const pct = orphanCount > 0 ? Math.round((orphanDone / orphanCount) * 100) : 0;

  return (
    <>
      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer', flexWrap: 'wrap', gap: 6, opacity: 0.85 }} onClick={toggle}>
        <span style={{ fontSize: 13 }}>⚫</span>
        <div className="milestone-title" style={{ fontSize: 13 }}>
          <span style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>Sin Hito</span>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {orphanCount} tarea{orphanCount !== 1 ? 's' : ''} sin hito asignado
            {' '}{expanded ? '▲' : '▼'}
          </div>
          {orphanCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div className="progress-bar" style={{ flex: 1, maxWidth: 120, height: 4 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--text-3)' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{orphanDone}/{orphanCount} · {pct}%</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginLeft: 24, marginBottom: 6, paddingLeft: 12,
            borderLeft: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            background: dragOver ? 'var(--accent-bg, #eff6ff)' : 'transparent',
            borderRadius: dragOver ? 6 : 0,
            transition: 'background 0.15s, border-color 0.15s',
            minHeight: 32,
          }}
          onClick={e => e.stopPropagation()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={handleDrop}
        >
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Sin tareas</div>
          ) : tasks.map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={e => {
                e.stopPropagation();
                e.dataTransfer.setData('taskId', task.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'grab' }}
            >
              <div
                className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
                onClick={() => toggleTask(task)}
              >
                {task.status === 'completed' ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
                <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`} style={{ fontSize: 12 }}>
                  {task.title}
                </div>
                <div className="task-meta">
                  <span className="task-time" style={{ fontSize: 10 }}>{fmtShortDate(task.date)}</span>
                  {task.start_time && <span className="task-time" style={{ fontSize: 10 }}>{task.start_time}</span>}
                  <CatBadge id={task.category_id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const LINKED_STATUS_ICONS = {
  not_started: '⚪', in_progress: '🔵', completed: '✅', published: '✅',
  merged: '✅', closed: '🔴', failed: '🔴', review: '🟡', pending: '⚪', draft: '🔵',
  cancelled: '🔴',
};

const LINKED_STATUS_LABELS = {
  not_started: 'No iniciado', in_progress: 'En progreso', completed: 'Completado',
  published: 'Publicado', merged: 'Merged', closed: 'Cerrada',
  failed: 'Fallida', review: 'En review', pending: 'Pendiente', draft: 'Borrador',
  cancelled: 'Cancelado',
};

function daysLeft(dateStr) {
  if (!dateStr) return 9999;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(dateStr + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
}

// Unified row for both simple milestones and content items (pubs, certs, repos, prs, events)
function AnyMilestoneRow({ item, onUpdate, onAddTask, onTaskMoved, version }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const days = item.days_remaining ?? daysLeft(item.date);
  const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
  const dayLabel = days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d restantes`;
  const isSimple = item.type === 'milestone';

  async function fetchTasks() {
    const data = await api.tasks({ milestone_id: item.id });
    setTasks(data.sort((a, b) => a.date.localeCompare(b.date)));
  }

  useEffect(() => { if (expanded) fetchTasks(); }, [version]);

  async function toggleExpanded(e) {
    e.stopPropagation();
    if (!expanded) await fetchTasks();
    setExpanded(v => !v);
  }

  async function toggleTask(task) {
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns });
    await fetchTasks();
    onUpdate();
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    await api.updateTask(taskId, { milestone_id: item.id });
    onTaskMoved();
  }

  const pct = item.task_total > 0 ? Math.round((item.task_done / item.task_total) * 100) : null;

  return (
    <>
      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer', flexWrap: 'wrap', gap: 6 }} onClick={toggleExpanded}>
        <span style={{ fontSize: 13 }}>{isSimple ? (STATUS_ICONS[item.status] || '⚪') : (LINKED_STATUS_ICONS[item.status] || '⚪')}</span>
        <div className="milestone-title" style={{ fontSize: 13 }}>
          <span>{item.title}</span>
          {item.icon && <span style={{ marginLeft: 4 }}>{item.icon}</span>}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {fmtDate(item.date)}{' '}{expanded ? '▲' : '▼'}
          </div>
          {pct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div className="progress-bar" style={{ flex: 1, maxWidth: 120, height: 4 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.task_done}/{item.task_total} · {pct}%</span>
            </div>
          )}
        </div>
        <div>
          <div className="milestone-date">{fmtShortDate(item.date)}</div>
          <div className={`milestone-days ${cls}`}>{dayLabel}</div>
        </div>
        {!isSimple && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', background: 'var(--bg)', color: 'var(--text-2)' }}>
            {LINKED_STATUS_LABELS[item.status] || item.status}
          </span>
        )}
      </div>

      {expanded && (
        <div
          style={{
            marginLeft: 24, marginBottom: 6, paddingLeft: 12,
            borderLeft: `2px solid ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            background: dragOver ? 'var(--accent-bg, #eff6ff)' : 'transparent',
            borderRadius: dragOver ? 6 : 0,
            transition: 'background 0.15s, border-color 0.15s',
            minHeight: 32,
          }}
          onClick={e => e.stopPropagation()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={handleDrop}
        >
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>
              Sin tareas para este hito ·{' '}
              <span
                style={{ textDecoration: 'underline', cursor: 'pointer', color: 'var(--accent)' }}
                onClick={e => { e.stopPropagation(); onAddTask(item); }}
              >
                Añadir tarea
              </span>
            </div>
          ) : tasks.map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('taskId', task.id); e.dataTransfer.effectAllowed = 'move'; }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'grab' }}
            >
              <div className={`task-check ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(task)}>
                {task.status === 'completed' ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
                <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`} style={{ fontSize: 12 }}>{task.title}</div>
                <div className="task-meta">
                  <span className="task-time" style={{ fontSize: 10 }}>{fmtShortDate(task.date)}</span>
                  {task.start_time && <span className="task-time" style={{ fontSize: 10 }}>{task.start_time}</span>}
                  <CatBadge id={task.category_id} style={{ fontSize: 10 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ObjectiveCard({ obj, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [newTaskFor, setNewTaskFor] = useState(null); // milestone-like object
  const [mvVersion, setMvVersion] = useState(0);
  const [contentItems, setContentItems] = useState([]);
  const [contentLoaded, setContentLoaded] = useState(false);
  const color = obj.color || '#2563eb';

  useEffect(() => {
    if (!expanded || contentLoaded) return;
    Promise.all([
      api.certifications({ objective_id: obj.id }),
      api.repos({ objective_id: obj.id }),
      api.prs({ objective_id: obj.id }),
      api.publications({ objective_id: obj.id }),
      api.events({ objective_id: obj.id }),
    ]).then(([certs, repos, prs, pubs, evts]) => {
      setContentItems([
        ...certs.map(c => ({ ...c, type: 'certification', icon: '🏆', date: c.target_date })),
        ...repos.map(r => ({ ...r, type: 'repo',          icon: '📦', date: r.target_date })),
        ...prs.map(p =>   ({ ...p, type: 'pr',            icon: '🔀', date: p.end_date })),
        ...pubs.map(p =>  ({ ...p, type: 'publication',   icon: '✍️',  date: p.date })),
        ...evts.map(e =>  ({ ...e, type: 'event',         icon: '🎪', date: e.end_date || e.start_date })),
      ]);
      setContentLoaded(true);
    });
  }, [expanded]);

  function handleTaskMoved() {
    setMvVersion(v => v + 1);
    onUpdate();
  }

  // Merge simple milestones + content items, sorted by date ascending (nulls last), completed last
  const allMilestones = [
    ...(obj.milestones || []).map(m => ({ ...m, type: 'milestone', icon: null })),
    ...contentItems,
  ].sort((a, b) => {
    const aDone = ['completed', 'published', 'merged', 'closed', 'failed', 'cancelled'].includes(a.status) ? 1 : 0;
    const bDone = ['completed', 'published', 'merged', 'closed', 'failed', 'cancelled'].includes(b.status) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  const pct = Math.round(obj.percentage_completed || 0);
  const days = obj.days_remaining;

  return (
    <div className="obj-card" onClick={() => setExpanded(v => !v)}>
      <div className="obj-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {obj.target_value && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{obj.target_value}</div>
          )}
          <div className="obj-title">{obj.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className={`milestone-days ${days < 0 ? 'overdue' : days <= 14 ? 'soon' : 'ok'}`}>{days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}</span>
            {obj.end_date && <span className="task-time">{obj.end_date}</span>}
            <span className="task-time">{obj.task_count - obj.done_count} tareas restantes</span>
          </div>
          {(() => { const ids = obj.category_ids?.length ? obj.category_ids : (obj.category_id ? [obj.category_id] : []); return ids.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{ids.map(id => <CatBadge key={id} id={id} />)}</div>; })()}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div className="obj-pct" style={{ color }}>{pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {expanded ? '▲' : '▼'} {statusLabel(obj.status)}
          </div>
        </div>
      </div>

      <div className="progress-bar" style={{ marginBottom: 12 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>

      {newTaskFor && (
        <div onClick={e => e.stopPropagation()}>
          <TaskModal
            initial={{ objective_id: obj.id, milestone_id: newTaskFor.id }}
            onClose={() => setNewTaskFor(null)}
            onSave={() => { setNewTaskFor(null); onUpdate(); }}
          />
        </div>
      )}

      {/* All milestones (simple + content items) sorted by date */}
      {expanded && (
        <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
          {!contentLoaded && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 12px' }}>Cargando hitos…</div>
          )}
          {contentLoaded && allMilestones.length === 0 && obj.orphan_count === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 12px' }}>Sin hitos</div>
          )}
          {contentLoaded && allMilestones.map(item => (
            <AnyMilestoneRow
              key={item.id}
              item={item}
              onUpdate={onUpdate}
              onAddTask={setNewTaskFor}
              onTaskMoved={handleTaskMoved}
              version={mvVersion}
            />
          ))}
          {contentLoaded && obj.orphan_count > 0 && (
            <SinHitoRow
              objId={obj.id}
              orphanCount={obj.orphan_count}
              orphanDone={obj.orphan_done}
              onUpdate={onUpdate}
              onTaskMoved={handleTaskMoved}
              version={mvVersion}
            />
          )}
        </div>
      )}

    </div>
  );
}

export default function ObjectivesView() {
  const [objectives, setObjectives] = useState([]);

  async function loadAll() {
    api.objectives().then(setObjectives);
  }

  useEffect(() => { loadAll(); }, []);

  const totalTasks = objectives.reduce((s, o) => s + (o.task_count || 0), 0);
  const doneTasks  = objectives.reduce((s, o) => s + (o.done_count  || 0), 0);
  const globalPct  = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Objetivos e hitos</div>
          <div className="page-subtitle">Progreso global: {globalPct}% — Q2 2026</div>
        </div>
      </div>

      {/* Global progress */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>Progreso global del plan</span>
          <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 18 }}>{globalPct}%</span>
        </div>
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <div className="progress-bar" style={{ height: 10 }}>
            <div className="progress-fill" style={{ width: `${globalPct}%`, background: '#16a34a' }} />
          </div>
          <div style={{
            position: 'absolute',
            top: '10%',
            left: `${globalPct}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: 18,
            lineHeight: 1,
            transition: 'left 0.6s ease',
            pointerEvents: 'none',
          }}>🐌</div>
        </div>
      </div>

      {objectives.map(obj => <ObjectiveCard key={obj.id} obj={obj} onUpdate={loadAll} />)}
    </div>
  );
}
