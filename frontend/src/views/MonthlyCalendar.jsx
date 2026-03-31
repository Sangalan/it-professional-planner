import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import {
  getDaysInMonthGrid, fmtMonthYear, toDateStr,
  isToday, isSameMonth, addMonths, subMonths,
  parseISO, getGapHours
} from '../utils/dateUtils.js';
import { getCatColor } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import CatBadge from '../components/CatBadge.jsx';
import GapPickerDialog from '../components/GapPickerDialog.jsx';

const DOW = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function DayDetail({ dateStr, tasks, events, onClose, onRefresh }) {
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
            {localTasks.sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map(task => (
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
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditTask(task)}>
                  <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`}>{task.title}</div>
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
  const [filterCat, setFilterCat] = useState('');
  const [selected, setSelected] = useState(null);
  const [gapDialog, setGapDialog] = useState(null); // { date, gapHours }

  const days = useMemo(() => getDaysInMonthGrid(month), [month]);

  function reloadMonth() {
    const from = toDateStr(days[0]);
    const to   = toDateStr(days[days.length - 1]);
    api.tasks({ from, to }).then(setTasks);
    api.events({ from, to }).then(setEvents);
  }

  useEffect(() => { reloadMonth(); }, [month]);

  useEffect(() => { api.categories().then(setCats); }, []);

  function getItemsForDay(d) {
    const ds = toDateStr(d);
    const dayTasks  = tasks.filter(t => t.date === ds && (!filterCat || t.category_id === filterCat));
    const dayEvents = events.filter(e => e.start_date <= ds && e.end_date >= ds);
    return { tasks: dayTasks, events: dayEvents };
  }

  const selDate = selected ? toDateStr(selected) : null;
  const selItems = selected ? getItemsForDay(selected) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ textTransform: 'capitalize' }}>{fmtMonthYear(month)}</div>
          <div className="page-subtitle">Calendario mensual</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => subMonths(m, 1))}>← Anterior</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(2026, 3, 1))}>Abr 2026</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(2026, 4, 1))}>May 2026</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(2026, 5, 1))}>Jun 2026</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => addMonths(m, 1))}>Siguiente →</button>
          <button className="btn btn-primary btn-sm" onClick={() => setSelected(new Date())}>+ Nueva tarea</button>
        </div>
      </div>

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
              <div className="cal-day">{d.getDate()}</div>
              <div className="cal-items">
                {allItems.map((item, i) => {
                  const color = getCatColor(item.category_id);
                  return (
                    <div key={i} className="cal-item"
                      style={{ background: color + 'cc' }}
                      title={item.title}>
                      {item.title}
                    </div>
                  );
                })}
                {dt.length + de.length > 4 && (
                  <div style={{ fontSize: 9, color: 'var(--text-3)', paddingLeft: 4 }}>
                    +{dt.length + de.length - 4} más
                  </div>
                )}
                {dayGapHours.length > 0 && (
                  <div
                    onClick={e => { e.stopPropagation(); setGapDialog({ date: ds, gapHours: dayGapHours }); }}
                    title={`${dayGapHours.length} hueco${dayGapHours.length > 1 ? 's' : ''} libre${dayGapHours.length > 1 ? 's' : ''} (9–20h)`}
                    style={{
                      fontSize: 9, padding: '1px 4px', borderRadius: 3,
                      background: '#fef08a', color: '#92400e',
                      fontWeight: 600, cursor: 'pointer', marginTop: 1,
                    }}>
                    ⚠ {dayGapHours.length}h
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: 11 }}>
        {cats.map(c => (
          <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, display: 'inline-block' }} />
            {c.name}
          </span>
        ))}
      </div>

      {/* Day detail modal */}
      {selected && selItems && (
        <DayDetail
          dateStr={toDateStr(selected)}
          tasks={selItems.tasks}
          events={selItems.events}
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
    </div>
  );
}
