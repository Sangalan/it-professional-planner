import React, { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../api.js';
import { toDateStr, fmtDate, formatDuration, getGapHours, timeToMinutes } from '../utils/dateUtils.js';
import { getCatColor } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import { CategoryBadges } from '../components/CatBadge.jsx';
import GapPickerDialog from '../components/GapPickerDialog.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import CalendarContentSummary from '../components/CalendarContentSummary.jsx';
import { canCompleteTask } from '../utils/taskUtils.js';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00–22:00
const SLOT_H = 60; // px per hour
const WORK_START = 9 * 60;  // 09:00 in minutes
const WORK_END   = 20 * 60; // 20:00 in minutes
const WORK_WINDOW = (WORK_END - WORK_START) / 60; // 11h
const MIN_TASK_MINUTES = 15;
const MINUTE_STEP = 15;
const DAY_START_MIN = HOURS[0] * 60;
const DAY_END_MIN = (HOURS[HOURS.length - 1] + 1) * 60;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapMinutes(minutes) {
  return Math.round(minutes / MINUTE_STEP) * MINUTE_STEP;
}

function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getTaskWindow(task) {
  const start = task.start_time ? timeToMinutes(task.start_time) : DAY_START_MIN;
  const end = task.end_time ? timeToMinutes(task.end_time) : start + 60;
  return { start, end: Math.max(start + MIN_TASK_MINUTES, end) };
}

// Merge task intervals within 9:00–20:00 and return scheduled + free hours
function computeWindowStats(tasks) {
  const intervals = tasks
    .filter(t => t.start_time && t.end_time)
    .map(t => [
      Math.max(timeToMinutes(t.start_time), WORK_START),
      Math.min(timeToMinutes(t.end_time),   WORK_END),
    ])
    .filter(([s, e]) => s < e)
    .sort(([a], [b]) => a - b);

  let covered = 0;
  let cursor  = WORK_START;
  for (const [s, e] of intervals) {
    if (s > cursor) cursor = s;
    covered += Math.max(0, e - cursor);
    cursor   = Math.max(cursor, e);
  }
  const scheduledH = covered / 60;
  const freeH      = Math.max(0, WORK_WINDOW - scheduledH);
  return { scheduledH, freeH };
}

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

export default function DailyList() {
  const [tasks, setTasks]       = useState([]);
  const [dateStr, setDateStr]   = useState(toDateStr(new Date()));
  const [filterCat, setFilterCat] = useState('');
  const [cats, setCats]         = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [gapDialog, setGapDialog] = useState(null);
  const [calendarView, setCalendarView] = useState('current');
  const [currentTime, setCurrentTime] = useState(new Date().toTimeString().slice(0, 5));
  const [taskInteraction, setTaskInteraction] = useState(null);
  const [taskPreview, setTaskPreview] = useState(null);
  const suppressClickRef = useRef(false);

  async function load() {
    const data = await api.tasks({ date: dateStr });
    setTasks(data);
  }

  useEffect(() => { load(); }, [dateStr]);
  useEffect(() => { api.categories().then(setCats); }, []);
  useEffect(() => { api.objectives().then(setObjectives); }, []);
  useEffect(() => {
    const iv = setInterval(() => setCurrentTime(new Date().toTimeString().slice(0, 5)), 60000);
    return () => clearInterval(iv);
  }, []);

  const objMap = useMemo(() => {
    const m = {};
    for (const o of objectives) m[o.id] = o;
    return m;
  }, [objectives]);

  function getTaskColor(task) {
    const obj = task.objective_id ? objMap[task.objective_id] : null;
    if (obj?.color) return obj.color;
    if (obj?.category_id) return getCatColor(obj.category_id);
    return getCatColor(task.category_id);
  }

  async function toggleTask(task) {
    if (!canCompleteTask(task)) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: newStatus });
    load();
  }

  function startTaskInteraction(event, task, mode) {
    if (task.is_fixed || !task.start_time) return;
    event.preventDefault();
    event.stopPropagation();
    const { start, end } = getTaskWindow(task);
    setTaskInteraction({
      task,
      mode,
      pointerStartY: event.clientY,
      initialStart: start,
      initialEnd: end,
    });
    setTaskPreview({ id: task.id, start, end });
  }

  function handleTaskClick(task) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setEditTask(task);
  }

  useEffect(() => {
    if (!taskInteraction) return;

    function updatePreview(clientY) {
      const deltaMinutes = snapMinutes(((clientY - taskInteraction.pointerStartY) / SLOT_H) * 60);
      const originalDuration = taskInteraction.initialEnd - taskInteraction.initialStart;

      if (taskInteraction.mode === 'move') {
        const nextStart = clamp(taskInteraction.initialStart + deltaMinutes, DAY_START_MIN, DAY_END_MIN - originalDuration);
        const nextEnd = nextStart + originalDuration;
        setTaskPreview({ id: taskInteraction.task.id, start: nextStart, end: nextEnd });
        return;
      }

      const nextEnd = clamp(
        taskInteraction.initialEnd + deltaMinutes,
        taskInteraction.initialStart + MIN_TASK_MINUTES,
        DAY_END_MIN
      );
      setTaskPreview({ id: taskInteraction.task.id, start: taskInteraction.initialStart, end: nextEnd });
    }

    function handlePointerMove(event) {
      updatePreview(event.clientY);
    }

    async function handlePointerUp() {
      const preview = taskPreview;
      const changed = preview
        && (preview.start !== taskInteraction.initialStart || preview.end !== taskInteraction.initialEnd);

      if (changed) {
        suppressClickRef.current = true;
        await api.updateTask(taskInteraction.task.id, {
          date: dateStr,
          start_time: minutesToTimeString(preview.start),
          end_time: minutesToTimeString(preview.end),
          duration_estimated: preview.end - preview.start,
        });
        await load();
      }

      setTaskInteraction(null);
      setTaskPreview(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [taskInteraction, taskPreview, dateStr]);

  const isToday    = dateStr === toDateStr(new Date());
  const nowHour    = new Date().getHours();
  const currentMin = timeToMinutes(currentTime);
  const firstHourMin = HOURS[0] * 60;
  const totalHeight  = HOURS.length * SLOT_H;
  const nowOffset    = currentMin - firstHourMin;
  const showNowBar   = isToday && nowOffset >= 0 && nowOffset < HOURS.length * 60;

  // Filtered tasks
  const visible = filterCat
    ? tasks.filter(t => parseCatIds(t.category_ids, t.category_id).includes(filterCat))
    : tasks;

  const timedTasks   = visible.filter(t => t.start_time);
  const untimedTasks = visible.filter(t => !t.start_time);
  const overdue      = tasks.filter(t => t.is_overdue && t.status !== 'completed');
  const gapHours     = getGapHours(tasks).filter(h => !isToday || h >= nowHour);

  const pending   = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');

  const { scheduledH, freeH } = computeWindowStats(tasks);

  // Date label for header
  const dateObj  = new Date(dateStr + 'T12:00:00');
  const dayLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 12, alignItems: 'start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="page-title" style={{ textTransform: 'capitalize' }}>
            {isToday ? 'Hoy' : dayLabel}
          </div>
          <div className="page-subtitle" style={{ textTransform: 'capitalize' }}>
            {isToday ? dayLabel + ' · ' : ''}{pending.length} pendientes · {completed.length} completadas
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 99,
              background: '#dbeafe', color: '#1d4ed8', fontWeight: 600,
            }}>
              🕐 {scheduledH % 1 === 0 ? scheduledH : scheduledH.toFixed(1)}h programadas
            </span>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 99,
              background: freeH === 0 ? '#dcfce7' : '#fef9c3',
              color:      freeH === 0 ? '#15803d'  : '#92400e',
              fontWeight: 600,
            }}>
              ☀ {freeH % 1 === 0 ? freeH : freeH.toFixed(1)}h libres (9–20h)
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginRight: 4 }}>
            <button
              className={`btn btn-sm ${calendarView === 'current' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCalendarView('current')}
            >
              Vista actual
            </button>
            <button
              className={`btn btn-sm ${calendarView === 'content' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCalendarView('content')}
            >
              Vista contenido
            </button>
          </div>
          <button className="btn btn-ghost btn-sm"
            onClick={() => { const d = new Date(dateStr); d.setDate(d.getDate() - 1); setDateStr(toDateStr(d)); }}>
            ← Anterior
          </button>
          <SpanishDateInput value={dateStr} onChange={setDateStr} style={{ minWidth: 150 }} />
          <button className="btn btn-ghost btn-sm"
            onClick={() => { const d = new Date(dateStr); d.setDate(d.getDate() + 1); setDateStr(toDateStr(d)); }}>
            Siguiente →
          </button>
          <button
            className={`btn btn-sm ${isToday ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setDateStr(toDateStr(new Date()))}
          >
            Hoy
          </button>
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
      {editTask && (
        <TaskModal
          initial={editTask}
          onClose={() => setEditTask(null)}
          onSave={() => { setEditTask(null); load(); }}
          onDeleted={() => { setEditTask(null); load(); }}
        />
      )}
      {gapDialog && (
        <GapPickerDialog
          date={dateStr}
          hour={gapDialog.hour}
          onClose={() => setGapDialog(null)}
          onCreated={load}
        />
      )}

      {calendarView === 'content' ? (
        <CalendarContentSummary mode="day" date={dateStr} />
      ) : (
        <>
          {/* ── Category filter ── */}
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

          {/* ── Gap warning ── */}
          {gapHours.length > 0 && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef9c3', borderRadius: 6, border: '1px solid #fde047' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                ⚠ {gapHours.length} hueco{gapHours.length > 1 ? 's' : ''} libre{gapHours.length > 1 ? 's' : ''} (9:00–20:00)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {gapHours.map(h => (
                  <span key={h} onClick={() => setGapDialog({ hour: h })} style={{
                    cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 10,
                    background: '#fef08a', color: '#92400e', border: '1px solid #fde047', fontWeight: 600,
                  }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Overdue warning ── */}
          {overdue.length > 0 && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid #fecaca', fontSize: 12, color: 'var(--danger)' }}>
              ⚠ {overdue.length} tarea{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}
            </div>
          )}

          {/* ── Untimed tasks ── */}
          {untimedTasks.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-header">
                <span className="card-title">Sin horario ({untimedTasks.length})</span>
              </div>
              <div style={{ padding: '0 18px' }}>
                {untimedTasks.map(task => (
                  <UntimeRow
                    key={task.id}
                    task={task}
                    color={getTaskColor(task)}
                    onToggle={() => toggleTask(task)}
                    onEdit={() => setEditTask(task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {tasks.length === 0 ? (
            <div className="empty-state card" style={{ padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              Sin tareas para este día
            </div>
          ) : (
            /* ── Time grid ── */
            <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '52px 1fr',
            background: 'var(--border)',
            gap: 1,
          }}>
            {/* Hour labels column */}
            <div style={{ background: 'var(--surface)' }}>
              {HOURS.map(hour => (
                <div key={hour} style={{
                  height: SLOT_H,
                  borderTop: '1px solid var(--border)',
                  fontSize: 10,
                  color: 'var(--text-3)',
                  textAlign: 'right',
                  padding: '5px 6px 0',
                  lineHeight: 1,
                }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day column */}
            <div style={{ position: 'relative', height: totalHeight, background: 'var(--surface)' }}>

              {/* Hour grid lines */}
              {HOURS.map((hour, idx) => (
                <div key={hour} style={{
                  position: 'absolute',
                  top: idx * SLOT_H, left: 0, right: 0, height: SLOT_H,
                  borderTop: '1px solid var(--border)',
                  pointerEvents: 'none',
                }} />
              ))}

              {/* Current time bar */}
              {showNowBar && (
                <div style={{
                  position: 'absolute',
                  top: (nowOffset / 60) * SLOT_H,
                  left: 0, right: 0, height: 2,
                  background: 'var(--danger)',
                  zIndex: 10,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Gap indicators */}
              {gapHours.map(h => {
                const idx = h - HOURS[0];
                if (idx < 0 || idx >= HOURS.length) return null;
                return (
                  <div key={`gap-${h}`}
                    onClick={() => setGapDialog({ hour: h })}
                    title={`Hueco libre ${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`}
                    style={{
                      position: 'absolute',
                      top: idx * SLOT_H, left: 0, right: 0, height: SLOT_H,
                      background: '#fef08a44',
                      borderTop: '1px dashed #fde047',
                      cursor: 'pointer',
                      zIndex: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <span style={{ fontSize: 10, color: '#a16207', fontWeight: 600, pointerEvents: 'none' }}>
                      + tarea
                    </span>
                  </div>
                );
              })}

              {/* Task blocks */}
              {timedTasks.map(task => {
                const preview = taskPreview?.id === task.id ? taskPreview : null;
                const effectiveStart = preview?.start ?? timeToMinutes(task.start_time);
                const effectiveEnd = preview?.end ?? (task.end_time ? timeToMinutes(task.end_time) : effectiveStart + 60);
                const startMin = effectiveStart - firstHourMin;
                const endMin   = effectiveEnd - firstHourMin;
                const top    = Math.max(0, (startMin / 60) * SLOT_H);
                const height = Math.max(22, ((endMin - startMin) / 60) * SLOT_H - 2);
                const isNow  = isToday
                  && timeToMinutes(task.start_time) <= currentMin
                  && (task.end_time ? timeToMinutes(task.end_time) > currentMin : false);
                const color   = getTaskColor(task);
                const catIds  = parseCatIds(task.category_ids, task.category_id);
                const dur     = task.duration_estimated
                  || (task.end_time ? timeToMinutes(task.end_time) - timeToMinutes(task.start_time) : 0);

                // How much info fits
                const showMeta   = height >= 44;
                const showCats   = height >= 66;
                const showNotes  = height >= 90 && task.notes;

                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    onPointerDown={e => startTaskInteraction(e, task, 'move')}
                    style={{
                      position: 'absolute',
                      top, left: 6, right: 6, height,
                      background: isNow
                        ? color
                        : color + (task.status === 'completed' ? '55' : 'cc'),
                      borderRadius: 5,
                      borderLeft: `4px solid ${color}`,
                      padding: height < 44 ? '2px 8px' : '5px 10px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      zIndex: 5,
                      display: 'flex',
                      alignItems: height < 44 ? 'center' : 'flex-start',
                      gap: 7,
                      touchAction: 'none',
                    }}
                  >
                    {/* Checkbox */}
                    {canCompleteTask(task) ? (
                      <div
                        onClick={e => { e.stopPropagation(); toggleTask(task); }}
                        title={task.status === 'completed' ? 'Desmarcar' : 'Completar'}
                        style={{
                          width: 16, height: 16, flexShrink: 0,
                          borderRadius: 3,
                          border: `2px solid rgba(255,255,255,${task.status === 'completed' ? 1 : 0.65})`,
                          background: task.status === 'completed' ? 'white' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          color: color,
                          fontSize: 10, fontWeight: 900,
                          marginTop: height < 44 ? 0 : 1,
                        }}
                      >
                        {task.status === 'completed' ? '✓' : ''}
                      </div>
                    ) : (
                      <div style={{ width: 16, flexShrink: 0 }} />
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title */}
                      <div style={{
                        fontSize: 12, color: 'white', fontWeight: 600,
                        lineHeight: 1.25,
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        opacity: task.status === 'completed' ? 0.75 : 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {isNow && <span style={{ marginRight: 3 }}>▶</span>}
                        {task.is_fixed === 1 && <span style={{ marginRight: 3, fontSize: 10 }}>📌</span>}
                        {task.title}
                      </div>

                      {/* Time + duration */}
                      {showMeta && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.85)', fontVariantNumeric: 'tabular-nums' }}>
                            {minutesToTimeString(effectiveStart)}–{minutesToTimeString(effectiveEnd)}
                          </span>
                          {dur > 0 && (
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>
                              ({formatDuration(dur)})
                            </span>
                          )}
                          {task.priority === 1 && (
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.9)', fontWeight: 700 }}>★</span>
                          )}
                        </div>
                      )}

                      {/* Category badges */}
                      {showCats && catIds.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                          {[...catIds].sort((a, b) => {
                            const aName = cats.find(c => c.id === a)?.name || a;
                            const bName = cats.find(c => c.id === b)?.name || b;
                            return String(aName).localeCompare(String(bName), 'es');
                          }).map(cid => {
                            const cat = cats.find(c => c.id === cid);
                            return cat ? (
                              <span key={cid} style={{
                                fontSize: 9, padding: '1px 6px', borderRadius: 8,
                                background: 'rgba(255,255,255,.25)', color: 'white',
                                fontWeight: 600, whiteSpace: 'nowrap',
                              }}>
                                {cat.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}

                      {/* Notes */}
                      {showNotes && (
                        <div style={{
                          fontSize: 10, color: 'rgba(255,255,255,.7)',
                          marginTop: 3, fontStyle: 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {task.notes}
                        </div>
                      )}
                    </div>
                    {!task.is_fixed && (
                      <div
                        onPointerDown={e => startTaskInteraction(e, task, 'resize')}
                        title="Cambiar duración"
                        style={{
                          position: 'absolute',
                          left: 10,
                          right: 10,
                          bottom: 4,
                          height: 8,
                          borderRadius: 999,
                          background: 'rgba(255, 255, 255, 0.05)',
                          cursor: 'ns-resize',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UntimeRow({ task, color, onToggle, onEdit }) {
  const catIds = parseCatIds(task.category_ids, task.category_id);
  const isOverdue = !!task.is_overdue && task.status !== 'completed';
  return (
    <div
      className={`task-row${isOverdue ? ' overdue' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={onEdit}
    >
      {canCompleteTask(task) ? (
        <div
          className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(); }}
          title={task.status === 'completed' ? 'Desmarcar' : 'Completar'}
        >
          {task.status === 'completed' ? '✓' : ''}
        </div>
      ) : (
        <div style={{ width: 22, flexShrink: 0 }} />
      )}
      <div className="task-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
          <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`}>
            {task.title}
          </div>
          {task.is_fixed === 1 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>📌</span>}
        </div>
        <div className="task-meta">
          {task.duration_estimated > 0 && (
            <span className="task-time">({formatDuration(task.duration_estimated)})</span>
          )}
          <CategoryBadges ids={catIds} keyPrefix={`${task.id}-`} />
          {task.priority === 1 && (
            <span className="badge" style={{ background: '#fef9c3', color: '#92400e' }}>Alta</span>
          )}
          {isOverdue && <span className="overdue-tag">Vencida</span>}
        </div>
        {task.notes && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>
            {task.notes}
          </div>
        )}
      </div>
    </div>
  );
}
