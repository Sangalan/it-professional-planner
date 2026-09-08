import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useCats } from './CatBadge.jsx';
import DeadlineModal, { DeadlineChip } from './DeadlineModal.jsx';
import MoneyMakerIcon from './MoneyMakerIcon.jsx';
import { isMoneyMakerTask, isTodoTask } from '../utils/taskUtils.js';
import { availableTodoMinutes, sortDayTodos } from '../utils/todoCapacity.js';
import { toDateStr, startOfMonth, addMonths, addDays, getDaysInMonthGrid, isSameMonth, fmtMonthYear, fmtDate, formatDuration, formatActualDuration } from '../utils/dateUtils.js';

const MONTH_PICKER_COLUMNS = 4;
const MONTH_PICKER_ROWS = 3;

function MonthGridPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(value);
  const pickerRef = useRef(null);

  useEffect(() => { if (!open) setPreview(value); }, [open, value]);
  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <div className="todo-month-layout-picker" ref={pickerRef}>
    <button type="button" className="btn btn-ghost todo-month-layout-button" aria-haspopup="dialog" aria-expanded={open}
      title="Elegir filas y columnas de meses"
      onClick={() => { setPreview(value); setOpen(current => !current); }}>
      <span aria-hidden="true">▦</span> {value.columns}×{value.rows}
    </button>
    {open && <div className="todo-month-layout-popover" role="dialog" aria-label="Distribución de meses">
      <strong>{preview.columns} columna{preview.columns === 1 ? '' : 's'} × {preview.rows} fila{preview.rows === 1 ? '' : 's'}</strong>
      <span>{preview.columns * preview.rows} mes{preview.columns * preview.rows === 1 ? '' : 'es'}</span>
      <div className="todo-month-layout-grid" role="grid" aria-label="Selecciona el tamaño de la cuadrícula">
        {Array.from({ length: MONTH_PICKER_ROWS }, (_, row) =>
          Array.from({ length: MONTH_PICKER_COLUMNS }, (_, column) => {
            const selected = column < preview.columns && row < preview.rows;
            return <button type="button" role="gridcell" aria-selected={selected}
              aria-label={`${column + 1} columnas por ${row + 1} filas`}
              className={selected ? 'selected' : ''} key={`${row}-${column}`}
              onMouseEnter={() => setPreview({ columns: column + 1, rows: row + 1 })}
              onFocus={() => setPreview({ columns: column + 1, rows: row + 1 })}
              onClick={() => { onChange({ columns: column + 1, rows: row + 1 }); setOpen(false); }} />;
          }))}
      </div>
      <small>Mueve el cursor y haz clic para aplicar</small>
    </div>}
  </div>;
}

function InlineEstimate({ task, onUpdated }) {
  const [value, setValue] = useState(task.duration_estimated || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { setValue(task.duration_estimated || ''); }, [task.duration_estimated]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function save() {
    if (saving) return;
    const minutes = value === '' ? 0 : Number(value);
    if (!Number.isFinite(minutes) || minutes < 0) return;
    setSaving(true);
    try {
      const updated = await api.updateTask(task.id, { duration_estimated: minutes });
      onUpdated(updated);
      setEditing(false);
    } catch (_) {
      // Keep the inline field open so the user can retry without losing the value.
    } finally { setSaving(false); }
  }
  if (editing) return <input ref={inputRef} className="todo-inline-estimate-input"
    aria-label={`Estimación en minutos: ${task.title}`} type="number" min="0" step="1" value={value}
    onChange={e => setValue(e.target.value)} onBlur={save} disabled={saving}
    onKeyDown={e => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { setValue(task.duration_estimated || ''); setEditing(false); }
    }} />;
  return <button type="button" className="todo-inline-estimate" title="Editar duración estimada"
    onClick={e => { e.stopPropagation(); setEditing(true); }}>
    {saving ? '…' : (Number(task.duration_estimated) > 0 ? formatDuration(Number(task.duration_estimated)) : '—')}
  </button>;
}

function TodoDayPicker({ task, anchor, onSelect, onClose }) {
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
  return <aside ref={calendarRef} className="todo-drop-calendar" aria-label="Cambiar día del ToDo" style={{ left, top, width: panelWidth, maxHeight }}>
    <div className="todo-drop-calendar-title">Elige un día para la tarea</div>
    <div className="todo-drop-calendar-task"><MoneyMakerIcon task={task} />{task.title}</div>
    <div className="todo-drop-months">
      {[currentMonth, addMonths(currentMonth, 1)].map(displayMonth => <section key={toDateStr(displayMonth)}>
        <h3>{fmtMonthYear(displayMonth)}</h3>
        <div className="todo-drop-days">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => <span className="todo-drop-weekday" key={day}>{day}</span>)}
          {getDaysInMonthGrid(displayMonth).map(day => {
            const date = toDateStr(day);
            if (!isSameMonth(day, displayMonth)) return <span key={date} />;
            return <button type="button" key={date} aria-label={fmtDate(date)}
              className={`todo-drop-day${date === today ? ' today' : ''}`}
              onClick={() => onSelect(date)}>{day.getDate()}</button>;
          })}
        </div>
      </section>)}
    </div>
    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
  </aside>;
}

export default function TodoCalendar({ tasks, objectives, countdownEnd, moneyPlanningReady, onEdit, onUpdated, onStart, onSetDuration, onCreateTask, onReorder, reordering }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [monthLayout, setMonthLayout] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('todo-month-layout'));
      if (saved?.columns >= 1 && saved.columns <= MONTH_PICKER_COLUMNS && saved?.rows >= 1 && saved.rows <= MONTH_PICKER_ROWS) return saved;
    } catch (_) { /* Use the default layout if the saved preference is invalid. */ }
    return { columns: 1, rows: 1 };
  });
  const [selected, setSelected] = useState(() => toDateStr(new Date()));
  const [agenda, setAgenda] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [deadlines, setDeadlines] = useState([]);
  const [deadlineModal, setDeadlineModal] = useState(null);
  const [dayMenu, setDayMenu] = useState(null);
  const [taskMenu, setTaskMenu] = useState(null);
  const [changingDayTask, setChangingDayTask] = useState(null);
  const [changeDayAnchor, setChangeDayAnchor] = useState(null);
  const [changingDay, setChangingDay] = useState(false);
  const [sortMode, setSortMode] = useState('importance');
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);
  const [durationTooltip, setDurationTooltip] = useState(null);
  const draggedTaskRef = useRef(null);
  const categories = useCats();
  const visibleMonthCount = monthLayout.columns * monthLayout.rows;
  const visibleMonths = useMemo(() => Array.from({ length: visibleMonthCount }, (_, index) => addMonths(month, index)), [month, visibleMonthCount]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), countdownEnd ? 1000 : 60000);
    return () => clearInterval(timer);
  }, [countdownEnd]);
  useEffect(() => {
    if (!countdownEnd) return;
    const today = new Date();
    setMonth(startOfMonth(today));
    setSelected(toDateStr(today));
    setNow(today);
  }, [countdownEnd]);
  async function loadDeadlines() {
    try { setDeadlines(await api.deadlines()); } catch (_) { setDeadlines([]); }
  }
  useEffect(() => { loadDeadlines(); }, []);
  useEffect(() => {
    if (!dayMenu && !taskMenu) return undefined;
    const close = () => { setDayMenu(null); setTaskMenu(null); };
    document.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('blur', close); };
  }, [dayMenu, taskMenu]);
  useEffect(() => {
    let cancelled = false;
    setCompletedExpanded(false);
    setAgenda(null);
    setError('');
    api.tasks({ date: selected }).then(rows => { if (!cancelled) setAgenda({ date: selected, rows }); })
      .catch(() => { if (!cancelled) setError('No se pudo cargar la agenda del día.'); });
    return () => { cancelled = true; };
  }, [selected, tasks]);
  const byDay = useMemo(() => {
    const map = new Map();
    const postponedObjectiveIds = new Set(objectives.filter(objective => objective.status === 'postponed').map(objective => objective.id));
    for (const task of tasks.filter(t => isTodoTask(t) && t.date && !postponedObjectiveIds.has(t.objective_id))) {
      if (!map.has(task.date)) map.set(task.date, []);
      map.get(task.date).push(task);
    }
    for (const [date, rows] of map) map.set(date, sortDayTodos(rows, objectives, categories, sortMode));
    return map;
  }, [tasks, objectives, categories, sortMode]);
  const cumulativeDurationByTaskId = useMemo(() => {
    const map = new Map();
    for (const rows of byDay.values()) {
      let minutes = 0;
      let missing = 0;
      for (const task of rows) {
        const duration = Number(task.duration_estimated);
        if (duration > 0) minutes += duration;
        else missing += 1;
        map.set(task.id, { minutes, missing });
      }
    }
    return map;
  }, [byDay]);
  const detail = byDay.get(selected) || [];
  const totalEstimatedMinutes = detail.reduce((sum, task) => sum + Math.max(0, Number(task.duration_estimated) || 0), 0);
  const completedEstimatedMinutes = detail
    .filter(task => task.status === 'completed')
    .reduce((sum, task) => sum + Math.max(0, Number(task.duration_estimated) || 0), 0);
  const completionPercent = totalEstimatedMinutes > 0
    ? Math.round((completedEstimatedMinutes / totalEstimatedMinutes) * 100)
    : 0;
  const selectedDeadlines = deadlines.filter(deadline => deadline.date === selected);
  const objectiveById = useMemo(() => new Map(objectives.map(objective => [objective.id, objective])), [objectives]);
  const objectiveColor = task => objectiveById.get(task.objective_id)?.color || null;
  const pending = detail.filter(t => t.status !== 'completed');
  const estimated = pending.reduce((sum, t) => sum + Math.max(0, Number(t.duration_estimated) || 0), 0);
  const missing = pending.filter(t => !(Number(t.duration_estimated) > 0)).length;
  const countdownActiveForSelectedDay = Number(countdownEnd) > now.getTime() && selected === toDateStr(now);
  const free = countdownActiveForSelectedDay
    ? Math.max(0, Math.floor((Number(countdownEnd) - now.getTime()) / 60000))
    : agenda?.date === selected ? availableTodoMinutes(agenda.rows, selected, now) : null;
  let capacityLimitAfterTaskId = null;
  const uncompletableTaskIds = new Set();
  if (free !== null) {
    let remainingMinutes = free;
    let capacityExceeded = false;
    for (const task of pending) {
      const duration = Number(task.duration_estimated);
      if (!capacityExceeded && duration > 0 && duration <= remainingMinutes) {
        remainingMinutes -= duration;
        capacityLimitAfterTaskId = task.id;
      } else {
        capacityExceeded = true;
        uncompletableTaskIds.add(task.id);
      }
    }
  }
  if (uncompletableTaskIds.size === 0) capacityLimitAfterTaskId = null;
  const showCapacityLimitAtTop = free !== null
    && uncompletableTaskIds.size > 0
    && (free === 0 || capacityLimitAfterTaskId === null);
  const firstCompletedTaskId = detail.find(task => task.status === 'completed')?.id || null;
  const completedCount = detail.length - pending.length;
  const completableTaskCount = free === null ? 0 : pending.length - uncompletableTaskIds.size;
  function showDurationTooltip(event, task) {
    const cumulative = cumulativeDurationByTaskId.get(task.id) || { minutes: 0, missing: 0 };
    const rect = event.currentTarget.getBoundingClientRect();
    const startTime = new Date();
    const completionTime = new Date(startTime.getTime() + cumulative.minutes * 60000);
    const finishesToday = toDateStr(completionTime) === toDateStr(startTime);
    const completionLabel = finishesToday
      ? completionTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      : completionTime.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const missingText = cumulative.missing > 0
      ? ` · ${cumulative.missing} sin estimar`
      : '';
    setDurationTooltip({
      taskId: task.id,
      durationText: `Hasta «${task.title}»: ${formatDuration(cumulative.minutes) || '0m'}${missingText}`,
      completionText: `Finalización: ${completionLabel}${cumulative.missing > 0 ? ' (sin contar las tareas sin estimar)' : ''}`,
      left: rect.right + 10,
      top: Math.max(36, Math.min(rect.top + rect.height / 2, window.innerHeight - 36)),
      maxWidth: Math.max(120, Math.min(290, window.innerWidth - rect.right - 22)),
    });
  }
  function hideDurationTooltip(taskId) {
    setDurationTooltip(current => current?.taskId === taskId ? null : current);
  }
  function changeMonth(offset) {
    const next = addMonths(month, offset * visibleMonthCount);
    setMonth(next);
    setSelected(toDateStr(next));
  }
  function changeMonthLayout(next) {
    setMonthLayout(next);
    try { localStorage.setItem('todo-month-layout', JSON.stringify(next)); } catch (_) { /* The view still works without persistence. */ }
  }
  async function changeTaskDay(task, date) {
    if (!task || !date || changingDay) return;
    setChangingDay(true);
    setError('');
    try {
      const updated = await api.updateTask(task.id, { date, start_time: null, end_time: null });
      onUpdated(updated);
      setChangingDayTask(null);
      setChangeDayAnchor(null);
    } catch (_) {
      setError('No se pudo cambiar el día de la tarea.');
    } finally {
      setChangingDay(false);
    }
  }
  async function toggleMoneyMaker(task) {
    if (!task || changingDay) return;
    setTaskMenu(null);
    setError('');
    try {
      const updated = await api.updateTask(task.id, { is_money_maker: isMoneyMakerTask(task) ? 0 : 1 });
      onUpdated(updated);
    } catch (_) {
      setError('No se pudo cambiar la marca Money maker.');
    }
  }
  function saveChangedDay(date) {
    return changeTaskDay(changingDayTask, date);
  }
  const monthRangeTitle = visibleMonthCount === 1
    ? fmtMonthYear(month)
    : `${fmtMonthYear(visibleMonths[0])} – ${fmtMonthYear(visibleMonths[visibleMonths.length - 1])}`;
  return <div className="todo-calendar-layout">
    <aside className="card todo-day-detail">
      <div className="todo-day-heading">
        <div>
          <h2>{fmtDate(selected)}</h2>
          <div className="todo-day-completion">{completionPercent}% completado</div>
        </div>
        <div className="todo-sort-switch" aria-label="Ordenar ToDo">
          <button type="button" className={sortMode === 'time' ? 'selected' : ''} onClick={() => setSortMode('time')}>⏱ Tiempo</button>
          <button type="button" className={sortMode === 'importance' ? 'selected' : ''} onClick={() => setSortMode('importance')}>★ Importancia</button>
        </div>
      </div>
      {selectedDeadlines.length > 0 && <div className="deadline-detail-list">
        {selectedDeadlines.map(deadline => <DeadlineChip key={deadline.id} deadline={deadline} onClick={setDeadlineModal} />)}
      </div>}
      {error ? <p role="alert">{error}</p> : free === null ? <p role="status">Calculando huecos…</p> :
        <div className="todo-capacity" aria-live="polite">
          <div>{countdownActiveForSelectedDay ? 'Tiempo disponible en contrarreloj' : 'Tiempo disponible de 9h a 20h'}: <strong>{formatDuration(free) || '0m'}</strong></div>
          {countdownActiveForSelectedDay && <div>ToDo que caben: <strong>{completableTaskCount} de {pending.length}</strong></div>}
          <div>ToDo pendientes estimados: <strong>{formatDuration(estimated) || '0m'}</strong></div>
          <p style={{ color: estimated > free ? 'var(--danger)' : 'var(--text-2)' }}>
            {estimated > free ? `No caben: faltan ${formatDuration(estimated - free)}.`
              : missing ? `Quedan ${formatDuration(free - estimated) || '0m'} antes de estimar el resto.`
                : `Caben por tiempo total. Margen: ${formatDuration(free - estimated) || '0m'}.`}
          </p>
          {missing > 0 && <p>{missing} ToDo sin estimación. Aún no se puede confirmar si caben todos.</p>}
        </div>}
      {sortMode === 'importance' && pending.length > 1 && <p className="text-muted">Arrastra las tareas para ordenar este día.</p>}
      {showCapacityLimitAtTop && <div className="todo-capacity-limit" role="separator" aria-label="Límite del tiempo disponible" />}
      {!detail.length && <p className="empty-state">No hay ToDo asignados a este día.</p>}
      {detail.map(task => <React.Fragment key={task.id}>
        {firstCompletedTaskId === task.id && <button type="button" className="todo-completed-toggle"
          aria-expanded={completedExpanded} onClick={() => setCompletedExpanded(value => !value)}>
          <span>Completadas ({completedCount})</span><span>{completedExpanded ? '▲' : '▼'}</span>
        </button>}
        {(task.status !== 'completed' || completedExpanded) && <>
        <article className={`todo-detail-card${dropTarget?.id === task.id ? ' drop-target' : ''}${uncompletableTaskIds.has(task.id) ? ' exceeds-capacity' : ''}`} style={objectiveColor(task) ? { '--todo-objective-color': objectiveColor(task) } : undefined}
        onMouseEnter={event => showDurationTooltip(event, task)} onMouseLeave={() => hideDurationTooltip(task.id)}
        draggable={sortMode === 'importance' && !reordering}
        onDragStart={event => {
          draggedTaskRef.current = task;
          setDropTarget(null);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', task.id);
        }}
        onDragEnd={() => { draggedTaskRef.current = null; setDropTarget(null); }}
        onDragOver={event => {
          const dragged = draggedTaskRef.current;
          if (reordering || sortMode !== 'importance' || !dragged || dragged.id === task.id || dragged.date !== task.date) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          const rect = event.currentTarget.getBoundingClientRect();
          setDropTarget({ id: task.id, placement: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
        }}
        onDrop={event => {
          event.preventDefault();
          const dragged = draggedTaskRef.current;
          const placement = dropTarget?.id === task.id ? dropTarget.placement : 'before';
          if (!reordering && sortMode === 'importance' && dragged && dragged.id !== task.id && dragged.date === task.date) {
            const next = detail.filter(row => row.id !== dragged.id);
            const targetIndex = next.findIndex(row => row.id === task.id);
            next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, dragged);
            onReorder(selected, next.map(row => row.id));
          }
          draggedTaskRef.current = null;
          setDropTarget(null);
        }}
        onContextMenu={e => { e.preventDefault(); setTaskMenu({ task, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 200) }); }}>
        <div className="todo-detail-heading">
          <InlineEstimate task={task} onUpdated={onUpdated} />
          <button className={`todo-detail-title${task.status === 'completed' ? ' done' : ''}`} onClick={() => onEdit(task)}><MoneyMakerIcon task={task} />{task.title}</button>
        </div>
        {task.description && <p>{task.description}</p>}
        {task.status === 'completed' && <span className="badge badge-completed">Completada{formatActualDuration(task.actual_seconds) && ` · ${formatActualDuration(task.actual_seconds)}`}</span>}
        </article>
        {capacityLimitAfterTaskId === task.id && <div className="todo-capacity-limit" role="separator" aria-label="Límite del tiempo disponible" />}
        </>}
      </React.Fragment>)}
    </aside>
    <section className="card todo-month-view">
      <div className="todo-month-toolbar">
        <button className="btn btn-ghost" aria-label="Bloque de meses anterior" onClick={() => changeMonth(-1)}>‹</button>
        <h2>{monthRangeTitle}</h2>
        <button className="btn btn-ghost" aria-label="Bloque de meses siguiente" onClick={() => changeMonth(1)}>›</button>
        <button className="btn btn-ghost" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(toDateStr(new Date())); }}>Hoy</button>
        <MonthGridPicker value={monthLayout} onChange={changeMonthLayout} />
      </div>
      <div className={`todo-months-grid${visibleMonthCount > 1 ? ' multiple' : ''}`}
        style={{ '--todo-month-columns': monthLayout.columns }}>
        {visibleMonths.map(displayMonth => <section className="todo-calendar-month" key={toDateStr(displayMonth)}>
          {visibleMonthCount > 1 && <h3>{fmtMonthYear(displayMonth)}</h3>}
          <div className="todo-month-grid">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div className="todo-month-weekday" key={d}>{d}</div>)}
            {getDaysInMonthGrid(displayMonth).map(day => {
              const date = toDateStr(day);
              const outside = !isSameMonth(day, displayMonth);
              if (visibleMonthCount > 1 && outside) return <div key={date} className="todo-month-day outside empty" aria-hidden="true" />;
              const rows = byDay.get(date) || [];
              const dayDeadlines = deadlines.filter(deadline => deadline.date === date);
              return <div key={date} role="button" tabIndex={0} aria-label={`Ver ToDo del ${fmtDate(date)}`} aria-pressed={selected === date}
                className={`todo-month-day${selected === date ? ' selected' : ''}${outside ? ' outside' : ''}`}
                style={dayDeadlines[0] ? { '--deadline-day-color': dayDeadlines[0].color } : undefined}
                onClick={() => setSelected(date)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(date); }}
                onContextMenu={e => { e.preventDefault(); setSelected(date); setDayMenu({ date, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 100) }); }}>
                {dayDeadlines[0] ? <button type="button" className="deadline-day-banner"
                  style={{ '--deadline-color': dayDeadlines[0].color || '#dc2626' }}
                  title={`Fecha límite: ${dayDeadlines[0].title}`}
                  onClick={e => { e.stopPropagation(); setDeadlineModal(dayDeadlines[0]); }}>
                  <strong>{day.getDate()}{date === toDateStr(now) ? ' · Hoy' : ''}</strong>
                  <span>{dayDeadlines[0].title}</span>
                </button> : <strong>{day.getDate()}{date === toDateStr(now) ? ' · Hoy' : ''}</strong>}
                {dayDeadlines.slice(1).map(deadline => <DeadlineChip key={deadline.id} deadline={deadline} compact onClick={setDeadlineModal} />)}
                {rows.map(task => <span key={task.id} className={`${task.status === 'completed' ? 'done' : ''}${date === selected && uncompletableTaskIds.has(task.id) ? ' exceeds-capacity' : ''}`}
                  style={objectiveColor(task) ? { '--todo-objective-color': objectiveColor(task) } : undefined}
                  onMouseEnter={event => showDurationTooltip(event, task)} onMouseLeave={() => hideDurationTooltip(task.id)}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTaskMenu({ task, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 200) });
                  }}><MoneyMakerIcon task={task} />{task.title}</span>)}
              </div>;
            })}
          </div>
        </section>)}
      </div>
    </section>
    {dayMenu && <div className="todo-day-context-menu" style={{ left: dayMenu.x, top: dayMenu.y }} onMouseDown={e => e.stopPropagation()}>
      <button type="button" onClick={() => { onCreateTask(dayMenu.date); setDayMenu(null); }}>Crear tarea</button>
      <button type="button" onClick={() => { setDeadlineModal({ date: dayMenu.date }); setDayMenu(null); }}>Crear fecha límite</button>
    </div>}
    {taskMenu && <div className="todo-task-context-menu" style={{ left: taskMenu.x, top: taskMenu.y }} onMouseDown={e => e.stopPropagation()}>
      <button type="button" onClick={() => toggleMoneyMaker(taskMenu.task)}>{isMoneyMakerTask(taskMenu.task) ? 'Quitar Money maker' : 'Marcar Money maker 💰'}</button>
      <button type="button" disabled={taskMenu.task.date === toDateStr(now)} onClick={() => {
        const task = taskMenu.task;
        setTaskMenu(null);
        changeTaskDay(task, toDateStr(new Date()));
      }}>Cambiar a Hoy</button>
      <button type="button" disabled={taskMenu.task.date === toDateStr(addDays(now, 1))} onClick={() => {
        const task = taskMenu.task;
        setTaskMenu(null);
        changeTaskDay(task, toDateStr(addDays(new Date(), 1)));
      }}>Cambiar a mañana</button>
      <button type="button" onClick={() => {
        setChangingDayTask(taskMenu.task);
        setChangeDayAnchor({ top: taskMenu.y, left: taskMenu.x, right: taskMenu.x + 180 });
        setTaskMenu(null);
      }}>Cambiar día</button>
      <button type="button" onClick={() => { onSetDuration(taskMenu.task); setTaskMenu(null); }}>Establecer duración</button>
      <button type="button" disabled={!moneyPlanningReady || taskMenu.task.status === 'completed' || !(Number(taskMenu.task.duration_estimated) > 0)}
        title={!moneyPlanningReady ? 'Planifica primero 4h de tareas Money maker' : (Number(taskMenu.task.duration_estimated) > 0 ? 'Comenzar este ToDo' : 'Asigna primero una duración estimada')}
        onClick={() => { onStart(taskMenu.task); setTaskMenu(null); }}>Comenzar</button>
    </div>}
    {changingDayTask && changeDayAnchor && <TodoDayPicker task={changingDayTask} anchor={changeDayAnchor} onSelect={saveChangedDay}
      onClose={() => { if (!changingDay) { setChangingDayTask(null); setChangeDayAnchor(null); } }} />}
    {durationTooltip && <div role="tooltip" className="todo-duration-tooltip"
      style={{ left: durationTooltip.left, top: durationTooltip.top, maxWidth: durationTooltip.maxWidth }}>
      <strong>{durationTooltip.durationText}</strong>
      <span>{durationTooltip.completionText}</span>
    </div>}
    {deadlineModal && <DeadlineModal initial={deadlineModal} onClose={() => setDeadlineModal(null)}
      onSave={() => { setDeadlineModal(null); loadDeadlines(); }} onDeleted={() => { setDeadlineModal(null); loadDeadlines(); }} />}
  </div>;
}
