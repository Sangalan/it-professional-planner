import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, fmtShortDate } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import CatBadge from '../components/CatBadge.jsx';

const STATUS_ICONS = {
  not_started: '⚪',
  in_progress: '🔵',
  completed:   '✅',
  blocked:     '🔴',
};

function MilestoneRow({ m, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const days = m.days_remaining;
  const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
  const dayLabel = days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d restantes`;

  async function toggleTasks(e) {
    e.stopPropagation();
    if (!expanded) {
      const data = await api.tasks({ milestone_id: m.id });
      setTasks(data.sort((a, b) => a.date.localeCompare(b.date)));
    }
    setExpanded(v => !v);
  }

  async function toggleTask(task) {
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns, percentage_completed: ns === 'completed' ? 100 : task.percentage_completed });
    const fresh = await api.tasks({ milestone_id: m.id });
    setTasks(fresh.sort((a, b) => a.date.localeCompare(b.date)));
    onUpdate();
  }

  return (
    <>
      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer' }} onClick={toggleTasks}>
        <span style={{ fontSize: 13 }}>{STATUS_ICONS[m.status] || '⚪'}</span>
        <div className="milestone-title" style={{ fontSize: 13 }}>
          {m.title}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {fmtDate(m.target_date)}
            {m.weight_pct != null && (
              <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 600 }}>{m.weight_pct}%</span>
            )}
            {' '}{expanded ? '▲' : '▼'}
          </div>
        </div>
        <div>
          <div className="milestone-date">{fmtShortDate(m.target_date)}</div>
          <div className={`milestone-days ${cls}`}>{dayLabel}</div>
        </div>
        <select
          value={m.status}
          style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}
          onClick={e => e.stopPropagation()}
          onChange={async e => {
            await api.updateMilestone(m.id, { status: e.target.value, percentage_completed: e.target.value === 'completed' ? 100 : m.percentage_completed });
            onUpdate();
          }}
        >
          <option value="not_started">No iniciado</option>
          <option value="in_progress">En curso</option>
          <option value="completed">Completado</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </div>

      {expanded && (
        <div style={{ marginLeft: 24, marginBottom: 6, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}
          onClick={e => e.stopPropagation()}>
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Sin tareas para este hito</div>
          ) : tasks.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
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

function LinkedItemRow({ id, title, icon, status, date, days, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
  const dayLabel = days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d restantes`;

  async function toggleTasks(e) {
    e.stopPropagation();
    if (!expanded) {
      const data = await api.tasks({ milestone_id: id });
      setTasks(data.sort((a, b) => a.date.localeCompare(b.date)));
    }
    setExpanded(v => !v);
  }

  async function toggleTask(task) {
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns, percentage_completed: ns === 'completed' ? 100 : task.percentage_completed });
    const fresh = await api.tasks({ milestone_id: id });
    setTasks(fresh.sort((a, b) => a.date.localeCompare(b.date)));
    onUpdate();
  }

  return (
    <>
      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer' }} onClick={toggleTasks}>
        <span style={{ fontSize: 13 }}>{LINKED_STATUS_ICONS[status] || '⚪'}</span>
        <div className="milestone-title" style={{ fontSize: 13 }}>
          {title} {icon}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {fmtDate(date)}
            {' '}{expanded ? '▲' : '▼'}
          </div>
        </div>
        <div>
          <div className="milestone-date">{fmtShortDate(date)}</div>
          <div className={`milestone-days ${cls}`}>{dayLabel}</div>
        </div>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
          background: 'var(--bg)', color: 'var(--text-2)',
        }}>
          {LINKED_STATUS_LABELS[status] || status}
        </span>
      </div>

      {expanded && (
        <div style={{ marginLeft: 24, marginBottom: 6, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}
          onClick={e => e.stopPropagation()}>
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Sin tareas para este elemento</div>
          ) : tasks.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
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

// Sub-items linked to this objective (certs, repos, prs, pubs, events)
function LinkedItems({ objId, milestonesCount, onUpdate }) {
  const [certs, setCerts] = useState([]);
  const [repos, setRepos] = useState([]);
  const [prs, setPrs] = useState([]);
  const [pubs, setPubs] = useState([]);
  const [evts, setEvts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.certifications({ objective_id: objId }).then(setCerts),
      api.repos({ objective_id: objId }).then(setRepos),
      api.prs({ objective_id: objId }).then(setPrs),
      api.publications({ objective_id: objId }).then(setPubs),
      api.events({ objective_id: objId }).then(setEvts),
    ]).then(() => setLoaded(true));
  }, [objId]);

  const hasLinked = certs.length || repos.length || prs.length || pubs.length || evts.length;

  if (loaded && !hasLinked && milestonesCount === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 12px' }}>Sin hitos</div>;
  }
  if (!hasLinked) return null;

  return (
    <div style={{ marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 4 }}>
      {evts.map(e => (
        <LinkedItemRow key={e.id} id={e.id} title={e.title} icon="🎪" status={e.status} date={e.end_date || e.start_date} days={e.days_remaining ?? 0} onUpdate={onUpdate} />
      ))}
      {pubs.map(p => (
        <LinkedItemRow key={p.id} id={p.id} title={p.title} icon="✍️" status={p.status} date={p.date} days={p.days_remaining ?? 0} onUpdate={onUpdate} />
      ))}
      {certs.map(c => (
        <LinkedItemRow key={c.id} id={c.id} title={c.title} icon="🏆" status={c.status} date={c.target_date} days={c.days_remaining ?? 0} onUpdate={onUpdate} />
      ))}
      {repos.map(r => (
        <LinkedItemRow key={r.id} id={r.id} title={r.title} icon="📦" status={r.status} date={r.target_date} days={r.days_remaining ?? 0} onUpdate={onUpdate} />
      ))}
      {prs.map(p => (
        <LinkedItemRow key={p.id} id={p.id} title={p.title} icon="🔀" status={p.status} date={p.end_date} days={p.days_remaining ?? 0} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function ObjectiveCard({ obj, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const color = obj.color || '#2563eb';

  const pct = Math.round(obj.percentage_completed || 0);
  const days = obj.days_remaining;
  const daysLabel = days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d restantes`;
  const daysColor = days < 0 ? 'var(--danger)' : days <= 14 ? 'var(--warning)' : 'var(--text-3)';

  return (
    <div className="obj-card" onClick={() => setExpanded(v => !v)}>
      <div className="obj-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <CatBadge id={obj.category_id} />
            <span style={{ fontSize: 11, color: daysColor }}>{daysLabel}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{obj.done_count}/{obj.task_count} tareas</span>
          </div>
          <div className="obj-title">{obj.title}</div>
          {obj.target_value && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Meta: {obj.target_value}</div>
          )}
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

      {/* Milestones + linked items — shown when expanded */}
      {expanded && obj.milestones && (
        <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
          {obj.milestones.map(m => <MilestoneRow key={m.id} m={m} onUpdate={onUpdate} />)}
          <LinkedItems objId={obj.id} milestonesCount={obj.milestones.length} onUpdate={onUpdate} />
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

  const globalPct = objectives.length > 0
    ? Math.round(objectives.reduce((s, o) => s + (o.percentage_completed || 0), 0) / objectives.length)
    : 0;

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
