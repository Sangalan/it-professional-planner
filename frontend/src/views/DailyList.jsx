import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toDateStr, fmtDate, formatDuration, getGapHours } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import CatBadge from '../components/CatBadge.jsx';
import GapPickerDialog from '../components/GapPickerDialog.jsx';

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function TaskRow({ task, onUpdate }) {
  const [pct, setPct] = useState(task.percentage_completed || 0);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const isOverdue = task.is_overdue;
  const isActive = (() => {
    const now = new Date().toTimeString().slice(0, 5);
    return task.start_time && task.end_time && task.start_time <= now && task.end_time > now;
  })();

  async function toggle() {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const newPct    = newStatus === 'completed' ? 100 : task.percentage_completed;
    setSaving(true);
    await api.updateTask(task.id, { status: newStatus, percentage_completed: newPct });
    setSaving(false);
    onUpdate();
  }

  async function savePct(val) {
    setPct(val);
    await api.updateTask(task.id, {
      percentage_completed: val,
      status: val >= 100 ? 'completed' : val > 0 ? 'in_progress' : 'pending',
    });
    onUpdate();
  }

  const rowClass = [
    'task-row',
    isOverdue && task.status !== 'completed' ? 'overdue' : '',
    isActive ? 'active-now' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass}>
      <div
        className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
        onClick={toggle}
        title={task.status === 'completed' ? 'Desmarcar' : 'Completar'}
      >
        {task.status === 'completed' ? '✓' : ''}
      </div>
      <div className="task-info" style={{ cursor: 'pointer' }} onClick={() => setEditing(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`}>
            {isActive && <span title="Tarea activa ahora" style={{ marginRight: 4 }}>▶</span>}
            {task.title}
          </div>
          {task.is_fixed === 1 && <span title="Tarea fija" style={{ fontSize: 10, color: 'var(--text-3)' }}>📌</span>}
        </div>
        <div className="task-meta">
          {task.start_time && (
            <span className="task-time">{task.start_time}–{task.end_time}</span>
          )}
          {task.duration_estimated > 0 && (
            <span className="task-time">({formatDuration(task.duration_estimated)})</span>
          )}
          {parseCatIds(task.category_ids, task.category_id).map(cid => (
            <CatBadge key={cid} id={cid} />
          ))}
          {task.priority === 1 && <span className="badge" style={{ background: '#fef9c3', color: '#92400e' }}>Alta</span>}
          {isOverdue && task.status !== 'completed' && <span className="overdue-tag">Vencida</span>}
        </div>
        {/* Progress slider */}
        {task.status !== 'completed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input
              type="range" min="0" max="100" step="5"
              value={pct}
              style={{ flex: 1, maxWidth: 140 }}
              onChange={e => setPct(Number(e.target.value))}
              onMouseUp={e => savePct(Number(e.target.value))}
              onTouchEnd={e => savePct(Number(e.target.value))}
            />
            <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 28 }}>{pct}%</span>
          </div>
        )}
        {task.notes && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>{task.notes}</div>}
      </div>
      {editing && (
        <TaskModal
          initial={task}
          onClose={() => setEditing(false)}
          onSave={() => { setEditing(false); onUpdate(); }}
        />
      )}
    </div>
  );
}

export default function DailyList() {
  const [tasks, setTasks] = useState([]);
  const [dateStr, setDateStr] = useState(toDateStr(new Date()));
  const [filterCat, setFilterCat] = useState('');
  const [cats, setCats] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [gapDialog, setGapDialog] = useState(null); // { hour }

  async function load() {
    const data = await api.tasks({ date: dateStr, ...(filterCat ? { category_id: filterCat } : {}) });
    setTasks(data);
  }

  useEffect(() => { load(); }, [dateStr, filterCat]);
  useEffect(() => { api.categories().then(setCats); }, []);

  const isToday = dateStr === toDateStr(new Date());
  const pending   = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');
  const overdue   = tasks.filter(t => t.is_overdue && t.status !== 'completed');
  const nowHour   = new Date().getHours();
  const gapHours  = getGapHours(tasks).filter(h => !isToday || h >= nowHour);

  const dateLabel = isToday ? 'Hoy' : fmtDate(dateStr);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Lista diaria — {dateLabel}</div>
          <div className="page-subtitle">{pending.length} pendientes · {completed.length} completadas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => { const d = new Date(dateStr); d.setDate(d.getDate()-1); setDateStr(toDateStr(d)); }}>
            ← Anterior
          </button>
          <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} />
          <button className="btn btn-ghost btn-sm"
            onClick={() => { const d = new Date(dateStr); d.setDate(d.getDate()+1); setDateStr(toDateStr(d)); }}>
            Siguiente →
          </button>
          {!isToday && (
            <button className="btn btn-ghost btn-sm" onClick={() => setDateStr(toDateStr(new Date()))}>Hoy</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Nueva tarea</button>
        </div>
      </div>

      {showCreate && (
        <TaskModal
          initial={{ date: dateStr }}
          onClose={() => setShowCreate(false)}
          onSave={() => { setShowCreate(false); load(); }}
        />
      )}

      {/* Category filter */}
      <div className="filter-row">
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Filtrar:</span>
        <span className={`chip ${!filterCat ? 'active' : ''}`} onClick={() => setFilterCat('')}>Todas</span>
        {cats.map(c => (
          <span key={c.id}
            className={`chip ${filterCat === c.id ? 'active' : ''}`}
            style={{ borderColor: filterCat === c.id ? c.color : undefined }}
            onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}>
            {c.name}
          </span>
        ))}
      </div>

      {gapDialog && (
        <GapPickerDialog
          date={dateStr}
          hour={gapDialog.hour}
          onClose={() => setGapDialog(null)}
          onCreated={load}
        />
      )}

      {gapHours.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef9c3', borderRadius: 6, border: '1px solid #fde047' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
            ⚠ {gapHours.length} hueco{gapHours.length > 1 ? 's' : ''} libre{gapHours.length > 1 ? 's' : ''} (9:00–20:00)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {gapHours.map(h => (
              <span key={h}
                onClick={() => setGapDialog({ hour: h })}
                style={{
                  cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 10,
                  background: '#fef08a', color: '#92400e', border: '1px solid #fde047', fontWeight: 600,
                }}>
                {String(h).padStart(2,'0')}:00
              </span>
            ))}
          </div>
        </div>
      )}

      {overdue.length > 0 && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid #fecaca', fontSize: 12, color: 'var(--danger)' }}>
          ⚠ {overdue.length} tarea{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          Sin tareas para este día
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Pendientes ({pending.length})</span>
            </div>
            <div style={{ padding: '0 18px' }}>
              {pending.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>
                  ✅ Todo completado
                </div>
              ) : (
                pending.map(t => <TaskRow key={t.id} task={t} onUpdate={load} />)
              )}
            </div>
          </div>

          {completed.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--success)' }}>Completadas ({completed.length})</span>
              </div>
              <div style={{ padding: '0 18px' }}>
                {completed.map(t => <TaskRow key={t.id} task={t} onUpdate={load} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
