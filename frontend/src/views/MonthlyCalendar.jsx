import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import {
  getDaysInMonthGrid, fmtMonthYear, toDateStr,
  isToday, isSameMonth, addMonths, subMonths,
  parseISO, getGapHours, timeToMinutes
} from '../utils/dateUtils.js';
import { getCatColor } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import CatBadge from '../components/CatBadge.jsx';
import GapPickerDialog from '../components/GapPickerDialog.jsx';
import CalendarContentSummary from '../components/CalendarContentSummary.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';

const DOW = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const WORK_START = 9 * 60;  // 09:00 in minutes
const WORK_END   = 20 * 60; // 20:00 in minutes
const WORK_WINDOW = (WORK_END - WORK_START) / 60; // 11h

function computeWindowStats(tasks, dayCount = 1) {
  const intervals = tasks
    .filter(t => t.start_time && t.end_time)
    .map(t => [
      Math.max(timeToMinutes(t.start_time), WORK_START),
      Math.min(timeToMinutes(t.end_time),   WORK_END),
      t.date,
    ])
    .filter(([s, e]) => s < e)
    .sort((a, b) => {
      if ((a[2] || '') !== (b[2] || '')) return (a[2] || '').localeCompare(b[2] || '');
      return a[0] - b[0];
    });

  let covered = 0;
  let cursor = null;
  let cursorDate = null;
  for (const [s, e, date] of intervals) {
    if (cursorDate !== date) {
      cursorDate = date;
      cursor = WORK_START;
    }
    if (s > cursor) cursor = s;
    covered += Math.max(0, e - cursor);
    cursor = Math.max(cursor, e);
  }
  const scheduledH = covered / 60;
  const freeH = Math.max(0, dayCount * WORK_WINDOW - scheduledH);
  return { scheduledH, freeH };
}

function sortTasksByStartTime(a, b) {
  const aStart = a.start_time || '99:99';
  const bStart = b.start_time || '99:99';
  if (aStart !== bStart) return aStart.localeCompare(bStart);
  return (a.title || '').localeCompare(b.title || '');
}

function DayDetail({ dateStr, tasks, events, getTaskColor, getMilestoneLabel, onClose, onRefresh }) {
  useEscapeClose(onClose);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [editTask, setEditTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function toggle(task) {
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns, percentage_completed: ns === 'completed' ? 100 : task.percentage_completed });
    setLocalTasks(lt => lt.map(t => t.id === task.id ? { ...t, status: ns } : t));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 10, padding: 24,
        maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            {new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Nueva</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)' }}>✕</button>
          </div>
        </div>

        {showCreate && (
          <TaskModal
            initial={{ date: dateStr }}
            onClose={() => setShowCreate(false)}
            onSave={() => { setShowCreate(false); onRefresh(); }}
          />
        )}
        {editTask && (
          <TaskModal
            initial={editTask}
            onClose={() => setEditTask(null)}
            onSave={async () => {
              setEditTask(null);
              const updated = await api.tasks({ date: dateStr });
              setLocalTasks(updated);
              onRefresh();
            }}
          />
        )}

        {events.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Eventos</div>
            {events.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="dot" style={{ background: getCatColor(ev.category_id) }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{ev.location}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {localTasks.length > 0 ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Tareas</div>
            {[...localTasks].sort(sortTasksByStartTime).map(task => (
              <div key={task.id} style={{
                display: 'flex', gap: 10, padding: '8px 0',
                borderBottom: '1px solid var(--border)', alignItems: 'flex-start'
              }}>
                <div
                  className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
                  style={{ marginTop: 1 }}
                  onClick={() => toggle(task)}
                >
                  {task.status === 'completed' ? '✓' : ''}
                </div>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: getTaskColor(task), marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditTask(task)}>
                  <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`}>{task.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontStyle: 'italic' }}>
                    {getMilestoneLabel(task)}
                  </div>
                  <div className="task-meta">
                    {task.start_time && <span className="task-time">{task.start_time}–{task.end_time}</span>}
                    <CatBadge id={task.category_id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Sin tareas</div>
        )}
      </div>
    </div>
  );
}

export default function MonthlyCalendar() {
  const [month, setMonth] = useState(new Date(2026, 3, 1)); // April 2026
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [cats, setCats] = useState([]);
  const [objectiveColors, setObjectiveColors] = useState({});
  const [milestoneTitles, setMilestoneTitles] = useState({});
  const [filterCat, setFilterCat] = useState('');
  const [selected, setSelected] = useState(null);
  const [gapDialog, setGapDialog] = useState(null); // { date, gapHours }
  const [calendarView, setCalendarView] = useState('current');

  const days = useMemo(() => getDaysInMonthGrid(month), [month]);

  function reloadMonth() {
    const from = toDateStr(days[0]);
    const to   = toDateStr(days[days.length - 1]);
    api.tasks({ from, to }).then(setTasks);
    api.events({ from, to }).then(setEvents);
  }

  useEffect(() => { reloadMonth(); }, [month]);

  useEffect(() => { api.categories().then(setCats); }, []);

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

  function getItemsForDay(d) {
    const ds = toDateStr(d);
    const dayTasks = tasks
      .filter(t => t.date === ds && (!filterCat || t.category_id === filterCat))
      .sort(sortTasksByStartTime);
    const dayEvents = events.filter(e => e.start_date <= ds && e.end_date >= ds);
    return { tasks: dayTasks, events: dayEvents };
  }

  const selDate = selected ? toDateStr(selected) : null;
  const selItems = selected ? getItemsForDay(selected) : null;
  const monthTasks = useMemo(
    () => tasks.filter(t => t.date && isSameMonth(parseISO(t.date), month)),
    [tasks, month]
  );
  const daysInCurrentMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const { scheduledH, freeH } = useMemo(
    () => computeWindowStats(monthTasks, daysInCurrentMonth),
    [monthTasks, daysInCurrentMonth]
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) auto', columnGap: 12, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div className="page-title" style={{ textTransform: 'capitalize' }}>{fmtMonthYear(month)}</div>
          <div className="page-subtitle">Calendario mensual</div>
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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => subMonths(m, 1))}>← Anterior</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(2026, 3, 1))}>Abr 2026</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(2026, 4, 1))}>May 2026</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(2026, 5, 1))}>Jun 2026</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => addMonths(m, 1))}>Siguiente →</button>
          <button className="btn btn-primary btn-sm" onClick={() => setSelected(new Date())}>+ Nueva tarea</button>
        </div>
      </div>

      {calendarView === 'content' ? (
        <CalendarContentSummary mode="month" monthDate={month} />
      ) : (
        <>
          {/* Category filter */}
          <div className="filter-row">
            <span className={`chip ${!filterCat ? 'active' : ''}`} onClick={() => setFilterCat('')}>Todas</span>
            {cats.map(c => (
              <span key={c.id}
                className={`chip ${filterCat === c.id ? 'active' : ''}`}
                style={{ '--chip-color': c.color }}
                onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block', marginRight: 4 }} />
                {c.name}
              </span>
            ))}
          </div>

          <div className="cal-grid">
            {/* Header */}
            {DOW.map(d => <div key={d} className="cal-header-cell">{d}</div>)}

            {/* Days */}
            {days.map(d => {
              const ds = toDateStr(d);
              const inMonth = isSameMonth(d, month);
              const today = isToday(d);
              const isSelected = selected && toDateStr(d) === toDateStr(selected);
              const { tasks: dt, events: de } = getItemsForDay(d);
              const nowHour = new Date().getHours();
              const dayGapHours = inMonth ? getGapHours(dt).filter(h => !today || h >= nowHour) : [];
              const allItems = [
                ...de.map(e => ({ ...e, _type: 'event' })),
                ...dt.slice(0, 3).map(t => ({ ...t, _type: 'task' })),
              ].slice(0, 4);

              return (
                <div
                  key={ds}
                  className={[
                    'cal-cell',
                    !inMonth ? 'other-month' : '',
                    today ? 'today' : '',
                    isSelected ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelected(d)}
                >
                  <div
                    onClick={dayGapHours.length > 0 ? (e => { e.stopPropagation(); setGapDialog({ date: ds, gapHours: dayGapHours }); }) : undefined}
                    title={dayGapHours.length > 0
                      ? `${dayGapHours.length} hueco${dayGapHours.length > 1 ? 's' : ''} libre${dayGapHours.length > 1 ? 's' : ''} (9–20h)`
                      : undefined}
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: dayGapHours.length > 0 ? 'rgb(255 252 230)' : 'rgb(252 252 252)',
                      color: '#92400e',
                      fontWeight: 700,
                      cursor: dayGapHours.length > 0 ? 'pointer' : 'default',
                      marginBottom: 3,
                      textAlign: 'center',
                      minHeight: 14,
                    }}>
                    {dayGapHours.length > 0 ? `⚠ ${dayGapHours.length}h libres` : ''}
                  </div>
                  <div className="cal-day">{d.getDate()}</div>
                  <div className="cal-items">
                    {allItems.map((item, i) => {
                      const color = item._type === 'task' ? getTaskColor(item) : getCatColor(item.category_id);
                      return (
                        <div key={i} className="cal-item"
                          style={{
                            background: color + 'cc',
                            whiteSpace: item._type === 'task' ? 'normal' : 'nowrap',
                            lineHeight: item._type === 'task' ? 1.2 : undefined,
                          }}
                          title={item.title}>
                          {item.title}
                          {item._type === 'task' && (
                            <div style={{ fontSize: 9, opacity: 0.92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getMilestoneLabel(item)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {dt.length + de.length > 4 && (
                      <div style={{ fontSize: 9, color: 'var(--text-3)', paddingLeft: 4 }}>
                        +{dt.length + de.length - 4} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day detail modal */}
          {selected && selItems && (
            <DayDetail
              dateStr={toDateStr(selected)}
              tasks={selItems.tasks}
              events={selItems.events}
              getTaskColor={getTaskColor}
              getMilestoneLabel={getMilestoneLabel}
              onClose={() => setSelected(null)}
              onRefresh={reloadMonth}
            />
          )}

          {gapDialog && (
            <GapPickerDialog
              date={gapDialog.date}
              hour={null}
              gapHours={gapDialog.gapHours}
              onClose={() => setGapDialog(null)}
              onCreated={reloadMonth}
            />
          )}
        </>
      )}
    </div>
  );
}
