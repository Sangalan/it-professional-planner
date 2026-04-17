import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import {
  getWeekDays, toDateStr, isToday, addDays, parseISO,
  timeToMinutes, fmtDayOfWeek, getGapHours
} from '../utils/dateUtils.js';
import { getCatColor, getCatLabel } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import GapPickerDialog from '../components/GapPickerDialog.jsx';
import CalendarContentSummary from '../components/CalendarContentSummary.jsx';

// Hours to display in the week view
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00–22:00
const SLOT_H = 56; // px per hour

export default function WeeklyCalendar() {
  const [weekStart, setWeekStart] = useState(() => {
    // Start from Monday of current week
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [workBlocks, setWorkBlocks] = useState([]);
  const [objectiveColors, setObjectiveColors] = useState({});
  const [milestoneTitles, setMilestoneTitles] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date().toTimeString().slice(0, 5));
  const [createFor, setCreateFor] = useState(null);   // date string
  const [editTask, setEditTask] = useState(null);      // task object
  const [gapDialog, setGapDialog] = useState(null);   // { date, hour }
  const [calendarView, setCalendarView] = useState('current');

  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  useEffect(() => {
    const from = toDateStr(days[0]);
    const to   = toDateStr(days[6]);
    api.tasks({ from, to }).then(setTasks);
    api.events({ from, to }).then(setEvents);
    api.workBlocks().then(setWorkBlocks);
  }, [weekStart]);

  useEffect(() => {
    const iv = setInterval(() => setCurrentTime(new Date().toTimeString().slice(0, 5)), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    Promise.all([
      api.objectives(),
      api.milestones(),
      api.publications(),
      api.certifications(),
      api.repos(),
      api.prs(),
      api.events(),
    ]).then(([objs, milestones, pubs, certs, repos, prs, evts]) => {
      const objectiveColorMap = {};
      for (const o of objs) objectiveColorMap[o.id] = o.color || null;
      setObjectiveColors(objectiveColorMap);

      const titleMap = {};
      for (const m of milestones) titleMap[m.id] = m.title;
      for (const p of pubs) titleMap[p.id] = p.title;
      for (const c of certs) titleMap[c.id] = c.title;
      for (const r of repos) titleMap[r.id] = r.name || r.title;
      for (const pr of prs) titleMap[pr.id] = pr.title;
      for (const e of evts) titleMap[e.id] = e.title;
      setMilestoneTitles(titleMap);
    }).catch(() => {});
  }, []);

  function getTaskColor(task) {
    if (task.objective_id && objectiveColors[task.objective_id]) return objectiveColors[task.objective_id];
    return getCatColor(task.category_id);
  }

  function getMilestoneLabel(task) {
    if (!task?.milestone_id) return 'Sin hito';
    return milestoneTitles[task.milestone_id] || 'Sin hito';
  }

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }
  function goToday()  {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    setWeekStart(monday);
  }

  // Map tasks and events by date
  const tasksByDate = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!m[t.date]) m[t.date] = [];
      m[t.date].push(t);
    }
    return m;
  }, [tasks]);

  const eventsByDate = useMemo(() => {
    const m = {};
    for (const ev of events) {
      // Expand multi-day events
      let d = ev.start_date;
      while (d <= ev.end_date) {
        if (!m[d]) m[d] = [];
        m[d].push(ev);
        const next = new Date(d + 'T12:00:00');
        next.setDate(next.getDate() + 1);
        d = toDateStr(next);
      }
    }
    return m;
  }, [events]);

  // Compute task blocks for a day
  function getDayItems(dateStr) {
    const dayTasks = (tasksByDate[dateStr] || []).filter(t => t.start_time);
    const dayEvents = (eventsByDate[dateStr] || []);
    return { tasks: dayTasks, events: dayEvents };
  }

  const currentMinutes = timeToMinutes(currentTime);
  const todayStr = toDateStr(new Date());

  const weekLabel = `${days[0].getDate()} ${days[0].toLocaleDateString('es-ES', { month: 'short' })} – ${days[6].getDate()} ${days[6].toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Semana del {weekLabel}</div>
          <div className="page-subtitle">Vista semanal por bloques horarios</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
          <button className="btn btn-ghost btn-sm" onClick={prevWeek}>← Anterior</button>
          <button className="btn btn-ghost btn-sm" onClick={goToday}>Esta semana</button>
          <button className="btn btn-ghost btn-sm" onClick={nextWeek}>Siguiente →</button>
          <button className="btn btn-primary btn-sm" onClick={() => setCreateFor(toDateStr(new Date()))}>+ Nueva tarea</button>
        </div>
      </div>

      {createFor && (
        <TaskModal
          initial={{ date: createFor }}
          onClose={() => setCreateFor(null)}
          onSave={() => {
            setCreateFor(null);
            const from = toDateStr(days[0]);
            const to   = toDateStr(days[6]);
            api.tasks({ from, to }).then(setTasks);
          }}
        />
      )}
      {editTask && (
        <TaskModal
          initial={editTask}
          onClose={() => setEditTask(null)}
          onSave={() => {
            setEditTask(null);
            const from = toDateStr(days[0]);
            const to   = toDateStr(days[6]);
            api.tasks({ from, to }).then(setTasks);
          }}
        />
      )}
      {gapDialog && (
        <GapPickerDialog
          date={gapDialog.date}
          hour={gapDialog.hour}
          onClose={() => setGapDialog(null)}
          onCreated={() => {
            const from = toDateStr(days[0]);
            const to   = toDateStr(days[6]);
            api.tasks({ from, to }).then(setTasks);
          }}
        />
      )}

      {calendarView === 'content' ? (
        <CalendarContentSummary mode="week" weekDays={days} />
      ) : (
        <>
          {/* Work blocks legend */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', fontSize: 11 }}>
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Bloques tipo:</span>
            {workBlocks.map(b => (
              <span key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: getCatColor(b.category_id), display: 'inline-block' }} />
                {b.start_time}–{b.end_time} {b.name}
              </span>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 700 }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `52px repeat(7, 1fr)`,
                background: 'var(--border)',
                gap: 1,
                borderRadius: '8px 8px 0 0',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                borderBottom: 'none',
              }}>
                <div style={{ background: 'var(--surface)', padding: '8px 4px' }} />
                {days.map(d => {
                  const ds = toDateStr(d);
                  const today = isToday(d);
                  return (
                    <div key={ds} style={{
                      background: today ? 'var(--accent-light)' : 'var(--surface)',
                      padding: '8px 6px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                        {fmtDayOfWeek(d)}
                      </div>
                      <div style={{
                        fontSize: 20, fontWeight: 700,
                        color: today ? 'var(--accent)' : 'var(--text-2)'
                      }}>
                        {d.getDate()}
                      </div>
                      {/* All-day events */}
                      {(eventsByDate[ds] || []).map(ev => (
                        <div key={ev.id} title={ev.title} style={{
                          fontSize: 9, padding: '1px 4px', borderRadius: 3,
                          background: getCatColor(ev.category_id) + 'cc',
                          color: 'white', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {ev.title}
                        </div>
                      ))}
                      {/* All-day tasks (no start_time) */}
                      {(tasksByDate[ds] || []).filter(t => !t.start_time).map(t => (
                        <div key={t.id} title={t.title} onClick={e => { e.stopPropagation(); setEditTask(t); }} style={{
                          fontSize: 9, padding: '1px 4px', borderRadius: 3,
                          background: getTaskColor(t) + (t.status === 'completed' ? '55' : 'aa'),
                          color: 'white', marginTop: 2,
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.title}{t.status === 'completed' ? ' ✓' : ''}
                          </div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.92 }}>
                            {getMilestoneLabel(t)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `52px repeat(7, 1fr)`,
                background: 'var(--border)',
                gap: 1,
                border: '1px solid var(--border)',
                borderRadius: '0 0 8px 8px',
                overflow: 'hidden',
              }}>
            {/* Time labels column */}
            <div style={{ background: 'var(--surface)' }}>
              {HOURS.map(hour => (
                <div key={hour} style={{
                  height: SLOT_H,
                  borderTop: '1px solid var(--border)',
                  fontSize: 10, color: 'var(--text-3)',
                  textAlign: 'right',
                  padding: '6px 6px 0',
                  lineHeight: 1,
                }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns — each is a single positioned container spanning all hours */}
            {days.map(d => {
              const ds = toDateStr(d);
              const today = isToday(d);
              const dayTasks = (tasksByDate[ds] || []).filter(t => t.start_time);
              const currentHour = Math.floor(currentMinutes / 60);
              const gapHours = getGapHours(dayTasks).filter(h => !today || h >= currentHour);
              const totalHeight = HOURS.length * SLOT_H;
              const firstHourMin = HOURS[0] * 60;

              // Current time offset
              const nowMin = currentMinutes - firstHourMin;
              const showNow = today && nowMin >= 0 && nowMin < HOURS.length * 60;

              return (
                <div key={ds} style={{ position: 'relative', height: totalHeight, background: 'var(--surface)' }}>
                  {/* Hour grid lines + work block backgrounds */}
                  {HOURS.map((hour, idx) => {
                    const slotStart = hour * 60;
                    const wb = workBlocks.find(b => {
                      const bs = timeToMinutes(b.start_time);
                      const be = timeToMinutes(b.end_time);
                      return slotStart >= bs && slotStart < be;
                    });
                    return (
                      <div key={hour} style={{
                        position: 'absolute',
                        top: idx * SLOT_H, left: 0, right: 0, height: SLOT_H,
                        borderTop: '1px solid var(--border)',
                        background: wb ? getCatColor(wb.category_id) + '0a' : 'transparent',
                        pointerEvents: 'none',
                      }} />
                    );
                  })}

                  {/* Current time bar */}
                  {showNow && (
                    <div style={{
                      position: 'absolute',
                      top: (nowMin / 60) * SLOT_H,
                      left: 0, right: 0, height: 2,
                      background: 'var(--danger)',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* Gap indicators — work hours 9–20 only */}
                  {gapHours.map(h => {
                    const idx = h - HOURS[0];
                    if (idx < 0 || idx >= HOURS.length) return null;
                    return (
                      <div key={`gap-${h}`}
                        onClick={() => setGapDialog({ date: ds, hour: h })}
                        title={`Hueco libre ${String(h).padStart(2,'0')}:00–${String(h+1).padStart(2,'0')}:00`}
                        style={{
                          position: 'absolute',
                          top: idx * SLOT_H, left: 0, right: 0, height: SLOT_H,
                          background: '#fef08a44',
                          borderTop: '1px dashed #fde047',
                          cursor: 'pointer',
                          zIndex: 2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        <span style={{ fontSize: 9, color: '#a16207', fontWeight: 600, pointerEvents: 'none' }}>
                          + tarea
                        </span>
                      </div>
                    );
                  })}

                  {/* Tasks — full duration height */}
                  {dayTasks.map(task => {
                    const startMin = timeToMinutes(task.start_time) - firstHourMin;
                    const endMin   = task.end_time ? timeToMinutes(task.end_time) - firstHourMin : startMin + 60;
                    const top    = Math.max(0, (startMin / 60) * SLOT_H);
                    const height = Math.max(28, ((endMin - startMin) / 60) * SLOT_H - 2);
                    const isNow  = today && timeToMinutes(task.start_time) <= currentMinutes &&
                                   (task.end_time ? timeToMinutes(task.end_time) > currentMinutes : false);
                    const taskColor = getTaskColor(task);
                    return (
                      <div key={task.id}
                        title={`${task.title} (${task.start_time}–${task.end_time || '?'})`}
                        onClick={() => setEditTask(task)}
                        style={{
                          position: 'absolute',
                          top, left: 2, right: 2, height,
                          background: isNow
                            ? taskColor
                            : taskColor + (task.status === 'completed' ? '55' : 'cc'),
                          borderRadius: 4,
                          padding: '2px 4px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          zIndex: 5,
                          borderLeft: `3px solid ${taskColor}`,
                        }}
                      >
                        <div style={{ fontSize: 9, color: 'white', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden' }}>
                          {task.start_time} {task.title}
                          {task.status === 'completed' && ' ✓'}
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.9)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getMilestoneLabel(task)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
