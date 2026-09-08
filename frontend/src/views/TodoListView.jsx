import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api, getActiveUserId } from '../api.js';
import TaskModal from '../components/TaskModal.jsx';
import TodoCalendar from '../components/TodoCalendar.jsx';
import DeadlineModal, { DeadlineChip } from '../components/DeadlineModal.jsx';
import MoneyMakerIcon from '../components/MoneyMakerIcon.jsx';
import { fmtDate, toDateStr, startOfMonth, addMonths, getDaysInMonthGrid, isSameMonth, fmtMonthYear, formatDuration, formatActualDuration } from '../utils/dateUtils.js';
import { isMoneyMakerTask, isMoneyObjective, isTodoTask } from '../utils/taskUtils.js';

const LAST_ORDER = Number.MAX_SAFE_INTEGER;
const COUNTDOWN_STORAGE_KEY = 'todo-countdown-end';

function byStoredOrder(a, b) {
  const completionOrder = Number(a.status === 'completed') - Number(b.status === 'completed');
  if (completionOrder) return completionOrder;
  const ao = a.todo_order ?? LAST_ORDER;
  const bo = b.todo_order ?? LAST_ORDER;
  if (ao !== bo) return ao - bo;
  return (a.title || '').localeCompare(b.title || '', 'es');
}

function groupTodos(tasks) {
  const completionPercent = rows => {
    const totalMinutes = rows.reduce((sum, task) => sum + Math.max(0, Number(task.duration_estimated) || 0), 0);
    if (!totalMinutes) return 0;
    const completedMinutes = rows
      .filter(task => task.status === 'completed')
      .reduce((sum, task) => sum + Math.max(0, Number(task.duration_estimated) || 0), 0);
    return Math.round((completedMinutes / totalMinutes) * 100);
  };
  const today = toDateStr(new Date());
  const overdue = tasks.filter(task => task.date && task.date < today && task.status !== 'completed');
  const undated = tasks.filter(task => !task.date && !overdue.includes(task));
  const dated = tasks.filter(task => task.date && !overdue.includes(task));
  const todayTasks = dated.filter(task => task.date === today);
  const futureOrCompletedDated = dated.filter(task => task.date !== today);
  const dates = [...new Set(futureOrCompletedDated.map(task => task.date))].sort();

  return [
    ...(overdue.length ? [{ key: 'overdue', label: 'Vencidas', overdue: true, tasks: overdue }] : []),
    ...(todayTasks.length ? [{ key: 'today', label: `Hoy ${fmtDate(today)}`, today: true, completionPercent: completionPercent(todayTasks), tasks: todayTasks }] : []),
    ...(undated.length ? [{ key: 'undated', label: 'Sin fecha', tasks: undated }] : []),
    ...dates.map(date => {
      const dateTasks = futureOrCompletedDated.filter(task => task.date === date);
      return { key: date, label: fmtDate(date), completionPercent: completionPercent(dateTasks), tasks: dateTasks };
    }),
  ];
}

function QuickAdd({ objectiveId, moneyMaker = false, onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const quickAddRef = useRef(null);

  useEffect(() => {
    if (!open || saving) return undefined;
    // The parent refreshes the board after each creation. Focus only once that
    // render and the saving state have both settled.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, saving]);

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!quickAddRef.current?.contains(event.target)) {
        setTitle('');
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await api.createTask({
        title: title.trim(),
        objective_id: objectiveId,
        date: null,
        start_time: null,
        end_time: null,
        status: 'pending',
        is_money_maker: moneyMaker ? 1 : 0,
      });
      setTitle('');
      await onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="todo-quick-add" ref={quickAddRef} onClick={e => e.stopPropagation()}>
      <button type="button" className="todo-add-button" title="Añadir ToDo" onClick={() => setOpen(true)}>+</button>
      {open && (
        <form className="todo-quick-form" onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setTitle('');
                setOpen(false);
              }
            }}
            placeholder="Nuevo ToDo"
            aria-label="Título del nuevo ToDo"
            disabled={saving}
          />
        </form>
      )}
    </div>
  );
}

function TodoColumn({ objective, tasks, draggedTaskId, flashedTaskId, onReload, onEdit, onTaskContextMenu, onColumnDrop, onTaskDrop, onTaskDragStart, onTaskDragEnd, dragColumnRef, dragTaskRef, saving }) {
  const [dropTarget, setDropTarget] = useState(null);
  const dropTargetRef = useRef(null);
  const previewTasks = useMemo(() => {
    const preview = dropTarget;
    if (!preview) return tasks;
    const sourceIndex = tasks.findIndex(task => task.id === preview.sourceId);
    const targetTask = tasks.find(task => task.id === preview.id);
    if (sourceIndex < 0 || !targetTask) return tasks;
    const next = [...tasks];
    const [moved] = next.splice(sourceIndex, 1);
    const targetIndex = next.findIndex(task => task.id === preview.id);
    if (targetIndex < 0) return tasks;
    next.splice(targetIndex + (preview.placement === 'after' ? 1 : 0), 0, {
      ...moved,
      date: targetTask.date || null,
      start_time: (moved.date || null) === (targetTask.date || null) ? moved.start_time : null,
      end_time: (moved.date || null) === (targetTask.date || null) ? moved.end_time : null,
    });
    return next;
  }, [dropTarget, tasks]);
  const groups = groupTodos(previewTasks);

  function finishTaskDrop(event, targetTask, forcedPlacement = null) {
    event.stopPropagation();
    event.preventDefault();
    const dragged = dragTaskRef.current;
    const currentDropTarget = dropTargetRef.current;
    const effectiveTarget = targetTask.id === dragged?.id && currentDropTarget
      ? tasks.find(task => task.id === currentDropTarget.id)
      : targetTask;
    const placement = forcedPlacement || (currentDropTarget?.id === effectiveTarget?.id ? currentDropTarget.placement : null);
    const sourceTask = tasks.find(item => item.id === dragged?.id);
    const sourceIndex = tasks.findIndex(item => item.id === dragged?.id);
    const targetIndex = tasks.findIndex(item => item.id === effectiveTarget?.id);
    const isNoOpDrop = (sourceTask?.date || null) === (effectiveTarget?.date || null)
      && ((placement === 'before' && targetIndex === sourceIndex + 1)
        || (placement === 'after' && targetIndex === sourceIndex - 1));
    const isValidDrop = dragged?.objectiveId === objective.id
      && currentDropTarget?.sourceId === dragged.id
      && currentDropTarget?.id === effectiveTarget?.id
      && currentDropTarget?.placement === placement
      && dragged.id !== effectiveTarget?.id
      && !isNoOpDrop;
    dropTargetRef.current = null;
    if (isValidDrop) event.dataTransfer.dropEffect = 'move';
    flushSync(() => {
      setDropTarget(null);
      if (isValidDrop) onTaskDrop(objective.id, dragged.id, effectiveTarget.id, placement);
      onTaskDragEnd();
    });
  }

  return (
    <section
      className={`todo-column${dragTaskRef.current?.objectiveId === objective.id ? ' task-dragging' : ''}`}
      onDragOver={e => {
        if (dragColumnRef.current) e.preventDefault();
        else if (dragTaskRef.current) e.dataTransfer.dropEffect = 'none';
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        if (dragColumnRef.current) onColumnDrop(dragColumnRef.current, objective.id);
        else if (dragTaskRef.current) onTaskDragEnd();
      }}
    >
      <header
        className="todo-column-header"
        style={{ '--todo-objective-color': objective.color || 'var(--border)' }}
        draggable
        onDragStart={e => {
          dragTaskRef.current = null;
          dragColumnRef.current = objective.id;
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => { dragColumnRef.current = null; }}
      >
        <span className="todo-column-title">{objective.title}</span>
        <QuickAdd objectiveId={objective.id} moneyMaker={isMoneyObjective(objective)} onCreated={onReload} />
      </header>

      <div className="todo-column-body">
        {groups.map(group => (
          <div key={group.key} className="todo-group">
            {group.label && <div className={`todo-date-divider${group.overdue ? ' overdue' : ''}${group.today ? ' today' : ''}`}><span>{group.label}{group.completionPercent !== undefined && ` - ${group.completionPercent}%`}</span></div>}
            {group.tasks.map(task => {
              const isMoneyAlias = isMoneyObjective(objective) && task.objective_id !== objective.id;
              const sourceId = dragTaskRef.current?.id || draggedTaskId;
              const draggedTask = tasks.find(item => item.id === sourceId);
              const sourceIndex = draggedTask ? tasks.findIndex(item => item.id === draggedTask.id) : -1;
              const targetIndex = tasks.findIndex(item => item.id === task.id);
              const isNoOpPlacement = placement => (
                (draggedTask?.date || null) === (task.date || null)
                && ((placement === 'before' && targetIndex === sourceIndex + 1)
                  || (placement === 'after' && targetIndex === sourceIndex - 1))
              );
              return <React.Fragment key={task.id}>
                <article
                data-todo-task-id={task.id}
                className={`todo-card${group.overdue ? ' overdue' : ''}${group.today ? ' today' : ''}${task.status === 'completed' ? ' completed' : ''}${flashedTaskId === task.id ? ' moved' : ''}${sourceId === task.id ? ' dragging' : ''}`}
                draggable={!saving && !isMoneyAlias}
                onDragStart={e => {
                  e.stopPropagation();
                  dragColumnRef.current = null;
                  dragTaskRef.current = { id: task.id, objectiveId: objective.id };
                  dropTargetRef.current = null;
                  setDropTarget(null);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', task.id);
                  onTaskDragStart(task, e);
                }}
                onDragEnd={() => { dropTargetRef.current = null; setDropTarget(null); onTaskDragEnd(); }}
                onDragOver={e => {
                  e.stopPropagation();
                  const isSourceTask = (dragTaskRef.current?.id || draggedTaskId) === task.id;
                  if (dragTaskRef.current?.objectiveId !== objective.id || isSourceTask) {
                    if (isSourceTask) {
                      if (dropTargetRef.current) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      } else {
                        e.dataTransfer.dropEffect = 'none';
                      }
                    } else {
                      e.dataTransfer.dropEffect = 'none';
                    }
                    return;
                  }
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const placement = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                  if (isNoOpPlacement(placement)) {
                    e.dataTransfer.dropEffect = 'none';
                    dropTargetRef.current = null;
                    setDropTarget(null);
                    return;
                  }
                  const nextTarget = { sourceId: dragTaskRef.current?.id || draggedTaskId, id: task.id, placement };
                  if (dropTargetRef.current?.id === nextTarget.id && dropTargetRef.current.placement === nextTarget.placement) return;
                  dropTargetRef.current = nextTarget;
                  setDropTarget(nextTarget);
                }}
                onDrop={e => finishTaskDrop(e, task)}
                onClick={() => onEdit(task)}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTaskContextMenu(task, e);
                }}
              >
                <div className="todo-card-heading">
                  <div className="todo-card-title"><MoneyMakerIcon task={task} />{task.title}</div>
                  {Number(task.duration_estimated) > 0 && <span className="todo-card-duration">{formatDuration(Number(task.duration_estimated))}</span>}
                </div>
                {task.status === 'completed' && <div className="todo-card-status">
                  <span className="badge badge-completed">Completada{formatActualDuration(task.actual_seconds) && ` · ${formatActualDuration(task.actual_seconds)}`}</span>
                </div>}
              </article>
              </React.Fragment>;
            })}
            {group.today && <div className="todo-today-end-divider" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function countdownMinutes(task, now) {
  if (!task?.end_time) return 0;
  const [hours, minutes] = task.end_time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  return Math.max(0, Math.ceil((target - now) / 60000));
}

function ActiveTaskBanner({ task, compact = false, onAction, saving }) {
  const [now, setNow] = useState(() => new Date());
  const started = task.timer_started_at || (task.date && task.start_time ? `${task.date}T${task.start_time}:00` : null);
  const elapsed = (Number(task.actual_seconds) || 0) + (started ? Math.max(0, (now - new Date(started)) / 1000) : 0);
  const estimatedMinutes = Number(task.original_estimate_minutes ?? task.duration_estimated) || 0;
  const remaining = estimatedMinutes - elapsed / 60;
  const overtimeMinutes = Math.ceil(Math.max(0, -remaining));
  const countdown = overtimeMinutes > 0
    ? `${formatDuration(estimatedMinutes) || '0m'} +${formatDuration(overtimeMinutes)}`
    : (formatDuration(Math.ceil(remaining)) || '0m');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, [task?.id]);

  useEffect(() => {
    document.title = countdown;
    return () => { document.title = 'Plan Maestro'; };
  }, [countdown]);

  return <div className={`todo-active-banner${compact ? ' compact' : ''}`} role="timer" aria-live="polite">
    <div className="todo-active-label">Tarea en curso</div>
    <div className="todo-active-countdown">{countdown}</div>
    <div className="todo-active-title-row">
      <div className="todo-active-title"><MoneyMakerIcon task={task} />{task.title}</div>
      <div className="todo-active-actions">
        {isTodoTask(task) && <button type="button" className="todo-active-action" aria-label="Pausar tarea" title="Pausar" disabled={saving} onClick={() => onAction('pause')}>⏸</button>}
        <button type="button" className="todo-active-action" aria-label="Completar tarea" title="Completar" disabled={saving} onClick={() => onAction('complete')}>✓</button>
      </div>
    </div>
  </div>;
}

function DurationDialog({ task, onClose, onSaved }) {
  const [hours, setHours] = useState(task.duration_estimated ? String(Number(task.duration_estimated) / 60) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  async function submit(event) {
    event.preventDefault();
    const value = hours === '' ? 0 : Math.round(Number(hours.replace(',', '.')) * 60);
    if (!Number.isFinite(value) || value < 0) { setError('Introduce una duración válida en horas.'); return; }
    setSaving(true);
    try {
      const updated = await api.updateTask(task.id, { duration_estimated: value });
      onSaved(updated);
    } catch (_) { setError('No se pudo guardar la duración.'); }
    finally { setSaving(false); }
  }
  return <div className="todo-confirm-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className="todo-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="todo-duration-title" onSubmit={submit}>
      <h2 id="todo-duration-title">Establecer duración</h2>
      <p><MoneyMakerIcon task={task} />{task.title}</p>
      <label style={{ display: 'block', marginTop: 14 }}>Estimación (horas)
        <input ref={inputRef} type="text" inputMode="decimal" autoComplete="off" value={hours} onChange={event => setHours(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 5 }} />
      </label>
      {error && <div role="alert" className="todo-confirm-error">{error}</div>}
      <div className="todo-confirm-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  </div>;
}

function CountdownDialog({ initialEnd, onClose, onStart }) {
  const defaultEnd = initialEnd ? new Date(initialEnd) : new Date(Date.now() + 60 * 60000);
  const [time, setTime] = useState(() => `${String(defaultEnd.getHours()).padStart(2, '0')}:${String(defaultEnd.getMinutes()).padStart(2, '0')}`);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function submit(event) {
    event.preventDefault();
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      setError('Selecciona una hora válida.');
      return;
    }
    const now = new Date();
    const end = new Date(now);
    end.setHours(hours, minutes, 0, 0);
    if (end <= now) end.setDate(end.getDate() + 1);
    onStart(end.getTime());
  }

  return <div className="todo-confirm-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className="todo-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="todo-countdown-title" onSubmit={submit}>
      <h2 id="todo-countdown-title">Modo contrarreloj</h2>
      <p>¿Hasta qué hora quieres trabajar en las tareas pendientes?</p>
      <label className="todo-countdown-time-label">Hora de finalización
        <input ref={inputRef} className="todo-countdown-time-input" type="time" required value={time} onChange={event => { setTime(event.target.value); setError(''); }} />
      </label>
      <small className="todo-countdown-hint">Si la hora ya ha pasado hoy, se entenderá como mañana.</small>
      {error && <div role="alert" className="todo-confirm-error">{error}</div>}
      <div className="todo-confirm-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger">{initialEnd ? 'Actualizar' : 'Comenzar contrarreloj'}</button>
      </div>
    </form>
  </div>;
}

function CountdownBanner({ end, onStop }) {
  const [now, setNow] = useState(() => Date.now());
  const remainingSeconds = Math.max(0, Math.ceil((end - now) / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const countdown = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const endDate = new Date(end);
  const endsToday = toDateStr(endDate) === toDateStr(new Date(now));
  const endLabel = endDate.toLocaleString('es-ES', endsToday
    ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  useEffect(() => {
    if (remainingSeconds <= 0) {
      onStop();
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds, onStop]);

  return <div className="todo-countdown-banner" role="timer" aria-live="polite">
    <div className="todo-active-label">Modo contrarreloj · hasta las {endLabel}</div>
    <div className="todo-active-countdown">{countdown}</div>
    <div className="todo-countdown-banner-footer">
      <span>Tiempo disponible para completar las tareas pendientes</span>
      <button type="button" className="todo-active-action" onClick={onStop} aria-label="Finalizar modo contrarreloj" title="Finalizar contrarreloj">✕</button>
    </div>
  </div>;
}

function TodoDropCalendar({ task, anchor, onDropDate, onDropOutside }) {
  const [hoverDate, setHoverDate] = useState(null);
  const [calendarHeight, setCalendarHeight] = useState(0);
  const calendarRef = useRef(null);
  const today = toDateStr(new Date());
  const currentMonth = startOfMonth(new Date());
  useLayoutEffect(() => {
    if (calendarRef.current) setCalendarHeight(calendarRef.current.scrollHeight);
  }, [task.id, anchor.top]);
  const panelWidth = Math.min(560, window.innerWidth - 32);
  const maxHeight = window.innerHeight - 32;
  const displayedHeight = Math.min(calendarHeight || maxHeight, maxHeight);
  const gap = 10;
  const spaceRight = window.innerWidth - anchor.right;
  const spaceLeft = anchor.left;
  const showOnRight = spaceRight >= panelWidth || spaceRight >= spaceLeft;
  const left = Math.max(16, Math.min(
    showOnRight ? anchor.right + gap : anchor.left - panelWidth - gap,
    window.innerWidth - panelWidth - 16,
  ));
  const top = calendarHeight && anchor.top + displayedHeight + 16 > window.innerHeight
    ? Math.max(16, window.innerHeight - displayedHeight - 16)
    : Math.max(8, anchor.top);
  return (
    <aside ref={calendarRef} className="todo-drop-calendar" aria-label="Asignar fecha al ToDo" style={{
      left,
      top,
      width: panelWidth,
      maxHeight,
    }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); onDropOutside(); }}>
      <div className="todo-drop-calendar-title">Suelta en un día para asignar fecha</div>
      <div className="todo-drop-calendar-task"><MoneyMakerIcon task={task} />{task.title}</div>
      <div className="todo-drop-months">
        {[currentMonth, addMonths(currentMonth, 1)].map(month => (
          <section key={toDateStr(month)}>
            <h3>{fmtMonthYear(month)}</h3>
            <div className="todo-drop-days">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => <span className="todo-drop-weekday" key={day}>{day}</span>)}
              {getDaysInMonthGrid(month).map(day => {
                const date = toDateStr(day);
                if (!isSameMonth(day, month)) return <span key={date} />;
                return (
                  <div key={date} aria-label={fmtDate(date)}
                    className={`todo-drop-day${date === today ? ' today' : ''}${date === hoverDate ? ' drop-target' : ''}`}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHoverDate(date); }}
                    onDragLeave={() => setHoverDate(null)}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); onDropDate(date); }}
                  >{day.getDate()}</div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

export default function TodoListView() {
  const [objectives, setObjectives] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creatingTaskDate, setCreatingTaskDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar');
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragAnchor, setDragAnchor] = useState(null);
  const [flashedTaskId, setFlashedTaskId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [deadlineRows, setDeadlineRows] = useState([]);
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [taskMenu, setTaskMenu] = useState(null);
  const [durationTask, setDurationTask] = useState(null);
  const [countdownDialogOpen, setCountdownDialogOpen] = useState(false);
  const [moneyPlanningReady, setMoneyPlanningReady] = useState(false);
  const [dailyOverloadVisible, setDailyOverloadVisible] = useState(
    () => Boolean(window.__dailyPlannerBannerStatus?.overloadVisible)
  );
  const [countdownEnd, setCountdownEnd] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(COUNTDOWN_STORAGE_KEY));
      return saved > Date.now() ? saved : null;
    } catch (_) { return null; }
  });
  const dragColumnRef = useRef(null);
  const dragTaskRef = useRef(null);
  const dragAnchorRef = useRef(null);
  const dragSessionRef = useRef(0);
  const flashTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(flashTimerRef.current), []);

  function stopCountdown() {
    setCountdownEnd(null);
    try { localStorage.removeItem(COUNTDOWN_STORAGE_KEY); } catch (_) { /* The mode still stops without persistence. */ }
  }

  function startCountdown(end) {
    setCountdownEnd(end);
    setCountdownDialogOpen(false);
    setView('calendar');
    try { localStorage.setItem(COUNTDOWN_STORAGE_KEY, String(end)); } catch (_) { /* The mode still works without persistence. */ }
  }

  function flashMovedTask(taskId) {
    window.clearTimeout(flashTimerRef.current);
    setFlashedTaskId(taskId);
    flashTimerRef.current = window.setTimeout(() => setFlashedTaskId(null), 420);
  }

  function endTaskDrag() {
    dragTaskRef.current = null;
    dragAnchorRef.current = null;
    setDraggedTask(null);
    setDragAnchor(null);
  }

  useEffect(() => {
    const closeAfterDrop = () => {
      const session = dragSessionRef.current;
      window.setTimeout(() => {
        if (dragSessionRef.current === session) endTaskDrag();
      }, 0);
    };
    document.addEventListener('drop', closeAfterDrop, true);
    document.addEventListener('dragend', closeAfterDrop, true);
    return () => {
      document.removeEventListener('drop', closeAfterDrop, true);
      document.removeEventListener('dragend', closeAfterDrop, true);
    };
  }, []);

  async function assignDate(date) {
    const task = draggedTask;
    endTaskDrag();
    if (!task || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateTask(task.id, { date, start_time: null, end_time: null });
      setTasks(rows => rows.map(row => row.id === task.id ? { ...row, ...updated } : row));
    } catch (_) {
      setError('No se pudo guardar la fecha. Vuelve a intentarlo.');
    } finally {
      setSaving(false);
    }
  }

  async function load() {
    const [objectiveRows, taskRows, nowData, moneyStatus] = await Promise.all([
      api.objectives(), api.tasks(), api.tasksNow(), api.moneyPlanningToday(),
    ]);
    setObjectives(objectiveRows);
    setTasks(taskRows);
    setActiveTask(nowData.current || null);
    setMoneyPlanningReady(Boolean(moneyStatus.ready));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const refresh = event => {
      if (!event.detail?.userId || event.detail.userId === getActiveUserId()) load();
    };
    window.addEventListener('tasks-changed', refresh);
    return () => window.removeEventListener('tasks-changed', refresh);
  }, []);
  useEffect(() => {
    const updateMoneyStatus = event => setMoneyPlanningReady(Boolean(event.detail?.ready));
    window.addEventListener('money-planning-status-changed', updateMoneyStatus);
    return () => window.removeEventListener('money-planning-status-changed', updateMoneyStatus);
  }, []);
  useEffect(() => {
    const updateBannerStatus = event => setDailyOverloadVisible(Boolean(event.detail?.overloadVisible));
    window.addEventListener('daily-banner-status-changed', updateBannerStatus);
    return () => window.removeEventListener('daily-banner-status-changed', updateBannerStatus);
  }, []);
  useEffect(() => {
    if (view === 'board') api.deadlines().then(setDeadlineRows).catch(() => setDeadlineRows([]));
  }, [view]);
  useEffect(() => {
    if (!taskMenu) return undefined;
    const close = () => setTaskMenu(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('blur', close); };
  }, [taskMenu]);

  async function startTodo(task) {
    const duration = Number(task?.duration_estimated);
    if (!task || !(duration > 0) || starting) return;
    if (!moneyPlanningReady) {
      setError('Planifica al menos 4h de tareas Money maker antes de comenzar un ToDo.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const updated = await api.taskTimer(task.id, 'start');
      setTasks(rows => rows.map(row => row.id === updated.id ? { ...row, ...updated } : row));
      setActiveTask(updated);
    } catch (_) {
      setError('No se pudo comenzar la tarea. Pausa primero cualquier otra tarea en curso y vuelve a intentarlo.');
    } finally {
      setStarting(false);
    }
  }

  async function finishActiveTask(action) {
    if (!activeTask || starting) return;
    setStarting(true);
    setError('');
    try {
      const updated = isTodoTask(activeTask)
        ? await api.taskTimer(activeTask.id, action)
        : await api.completeScheduledTask(activeTask);
      setTasks(rows => rows.map(row => row.id === updated.id ? { ...row, ...updated } : row));
      setActiveTask(null);
    } catch (_) {
      setError('No se pudo guardar el tiempo trabajado. Vuelve a intentarlo.');
    } finally { setStarting(false); }
  }

  const columns = useMemo(() => {
    const todoObjectiveIds = new Set(tasks.filter(task => isTodoTask(task) && task.objective_id).map(task => task.objective_id));
    const hasMoneyMakerTodos = tasks.some(task => isTodoTask(task) && isMoneyMakerTask(task));
    return objectives
      .filter(objective => objective.status !== 'postponed' && (todoObjectiveIds.has(objective.id) || (hasMoneyMakerTodos && isMoneyObjective(objective))))
      .sort(byStoredOrder);
  }, [objectives, tasks]);

  async function toggleMoneyMaker(task) {
    setTaskMenu(null);
    setError('');
    try {
      const updated = await api.updateTask(task.id, { is_money_maker: isMoneyMakerTask(task) ? 0 : 1 });
      setTasks(rows => rows.map(row => row.id === updated.id ? { ...row, ...updated } : row));
    } catch (_) {
      setError('No se pudo cambiar la marca Money maker. Vuelve a intentarlo.');
    }
  }

  async function reorderDay(date, ids) {
    if (reordering) return;
    setReordering(true);
    setError('');
    try {
      await api.reorderTodoDay(date, ids);
      const positions = new Map(ids.map((id, index) => [id, index]));
      setTasks(rows => rows.map(task => task.date === date && positions.has(task.id)
        ? { ...task, todo_day_order: positions.get(task.id), todo_order_date: date } : task));
    } catch (_) {
      setError('No se pudo guardar el orden del día. Vuelve a intentarlo.');
    } finally {
      setReordering(false);
    }
  }

  async function moveColumn(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const next = [...columns];
    const from = next.findIndex(item => item.id === fromId);
    const to = next.findIndex(item => item.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const positions = new Map(next.map((item, index) => [item.id, index]));
    setObjectives(rows => rows.map(item => positions.has(item.id) ? { ...item, todo_order: positions.get(item.id) } : item));
    await api.reorderTodoObjectives(next.map(item => item.id));
  }

  async function moveTask(objectiveId, fromId, toId, placement = 'before') {
    if (!fromId || fromId === toId) return;
    const list = tasks.filter(task => task.objective_id === objectiveId && isTodoTask(task)).sort(byStoredOrder);
    const from = list.findIndex(item => item.id === fromId);
    const targetTask = list.find(item => item.id === toId);
    if (from < 0 || !targetTask) return;
    const targetDate = targetTask.date || null;
    const [moved] = list.splice(from, 1);
    const target = list.findIndex(item => item.id === toId);
    if (target < 0) return;
    list.splice(target + (placement === 'after' ? 1 : 0), 0, moved);
    const positions = new Map(list.map((item, index) => [item.id, index]));
    const dateChanged = (moved.date || null) !== targetDate;
    setTasks(rows => rows.map(item => {
      if (!positions.has(item.id)) return item;
      const reordered = { ...item, todo_order: positions.get(item.id) };
      return item.id === moved.id && dateChanged
        ? { ...reordered, date: targetDate, start_time: null, end_time: null }
        : reordered;
    }));
    flashMovedTask(moved.id);
    try {
      if (dateChanged) await api.updateTask(moved.id, { date: targetDate, start_time: null, end_time: null });
      await api.reorderTodos(objectiveId, list.map(item => item.id));
    } catch (_) {
      setError('No se pudo guardar el nuevo orden. Se ha restaurado la lista.');
      load();
    }
  }

  return (
    <div>
      {moneyPlanningReady && countdownEnd && <CountdownBanner end={countdownEnd} onStop={stopCountdown} />}
      {moneyPlanningReady && activeTask && <ActiveTaskBanner task={activeTask} compact={dailyOverloadVisible}
        onAction={finishActiveTask} saving={starting} />}
      <div className="page-header">
        <div className="todo-page-heading">
          <div className="todo-page-title-row">
            <div className="page-title">ToDo-List</div>
            <div className="todo-view-switch">
              <button className={`btn ${view === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} aria-label="Vista de calendario" title="Calendario" onClick={() => setView('calendar')}>📅</button>
              <button className={`btn ${view === 'board' ? 'btn-primary' : 'btn-ghost'}`} aria-label="Vista por objetivos" title="Por objetivos" onClick={() => setView('board')}>🎯</button>
            </div>
            <button type="button" className={`btn todo-countdown-mode-button${countdownEnd ? ' active' : ''}`}
              onClick={() => setCountdownDialogOpen(true)}>⏱ {countdownEnd ? 'Cambiar contrarreloj' : 'Modo contrarreloj'}</button>
          </div>
          <div className="page-subtitle">{columns.length} objetivo{columns.length === 1 ? '' : 's'} con tareas ToDo</div>
        </div>
      </div>

      {error && <div role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      {saving && <div role="status">Guardando fecha…</div>}
      {loading ? (
        <div className="empty-state card">Cargando…</div>
      ) : view === 'calendar' ? (
        <TodoCalendar tasks={tasks} objectives={objectives} onEdit={setEditing}
          countdownEnd={countdownEnd}
          moneyPlanningReady={moneyPlanningReady}
          onStart={startTodo}
          onSetDuration={setDurationTask}
          onCreateTask={setCreatingTaskDate}
          onReorder={reorderDay} reordering={reordering}
          onUpdated={updated => setTasks(rows => rows.map(row => row.id === updated.id ? { ...row, ...updated } : row))} />
      ) : columns.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>No hay objetivos con tareas ToDo</div>
      ) : (
        <>
        {deadlineRows.length > 0 && <div className="card todo-deadline-overview">
          <div className="card-title">Fechas límite</div>
          <div>{deadlineRows.map(deadline => <DeadlineChip key={deadline.id} deadline={deadline} onClick={setEditingDeadline} />)}</div>
        </div>}
        <div className="todo-board">
          {columns.map(objective => (
            <TodoColumn
              key={objective.id}
              objective={objective}
              tasks={tasks.filter(task => isTodoTask(task) && (task.objective_id === objective.id || (isMoneyObjective(objective) && isMoneyMakerTask(task)))).sort(byStoredOrder)}
              onReload={load}
              onEdit={setEditing}
              onTaskContextMenu={(task, event) => setTaskMenu({ task, x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 60) })}
              onColumnDrop={moveColumn}
              onTaskDrop={moveTask}
              dragColumnRef={dragColumnRef}
              dragTaskRef={dragTaskRef}
              draggedTaskId={draggedTask?.id}
              flashedTaskId={flashedTaskId}
              onTaskDragStart={(task, event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const anchor = { top: rect.top, left: rect.left, right: rect.right };
                dragSessionRef.current += 1;
                dragAnchorRef.current = anchor;
                setDragAnchor(anchor);
                setDraggedTask(task);
              }}
              onTaskDragEnd={endTaskDrag}
              saving={saving}
            />
          ))}
        </div>
        {taskMenu && <div className="todo-task-context-menu" style={{ left: taskMenu.x, top: taskMenu.y }} onMouseDown={e => e.stopPropagation()}>
          <button type="button" onClick={() => toggleMoneyMaker(taskMenu.task)}>{isMoneyMakerTask(taskMenu.task) ? 'Quitar Money maker' : 'Marcar Money maker 💰'}</button>
          <button type="button" onClick={() => { setDurationTask(taskMenu.task); setTaskMenu(null); }}>Establecer duración</button>
          <button type="button" disabled={!moneyPlanningReady || taskMenu.task.status === 'completed' || !(Number(taskMenu.task.duration_estimated) > 0)}
            title={!moneyPlanningReady ? 'Planifica primero 4h de tareas Money maker' : (Number(taskMenu.task.duration_estimated) > 0 ? 'Comenzar este ToDo' : 'Asigna primero una duración estimada')}
            onClick={() => { startTodo(taskMenu.task); setTaskMenu(null); }}>Comenzar</button>
        </div>}
        </>
      )}

      {draggedTask && dragAnchor && <TodoDropCalendar task={draggedTask} anchor={dragAnchor} onDropDate={assignDate} onDropOutside={endTaskDrag} />}

      {durationTask && <DurationDialog task={durationTask} onClose={() => setDurationTask(null)}
        onSaved={updated => { setTasks(rows => rows.map(row => row.id === updated.id ? { ...row, ...updated } : row)); setDurationTask(null); }} />}

      {countdownDialogOpen && <CountdownDialog initialEnd={countdownEnd} onClose={() => setCountdownDialogOpen(false)} onStart={startCountdown} />}

      {editing && (
        <TaskModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={() => { setEditing(null); load(); }}
          onDeleted={() => { setEditing(null); load(); }}
        />
      )}
      {creatingTaskDate && <TaskModal initial={{ date: creatingTaskDate }} onClose={() => setCreatingTaskDate(null)}
        onSave={() => { setCreatingTaskDate(null); load(); }} />}
      {editingDeadline && <DeadlineModal initial={editingDeadline} onClose={() => setEditingDeadline(null)}
        onSave={() => { setEditingDeadline(null); api.deadlines().then(setDeadlineRows); }}
        onDeleted={() => { setEditingDeadline(null); api.deadlines().then(setDeadlineRows); }} />}
    </div>
  );
}
