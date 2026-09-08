import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDuration, toDateStr } from '../utils/dateUtils.js';
import { isFixedTask, isMoneyMakerTask, isMoneyObjective, isTodoTask } from '../utils/taskUtils.js';
import { availableTodoMinutes } from '../utils/todoCapacity.js';

const REQUIRED_MINUTES = 4 * 60;
const MONEY_OBJECTIVE_DISPLAY_TITLE = "Let's make some Money!";

function estimatedMinutes(tasks) {
  return tasks.reduce((total, task) => total + Math.max(0, Number(task.duration_estimated) || 0), 0);
}

export default function DailyMoneyPlanning({ userId }) {
  const today = toDateStr(new Date());
  const [objectives, setObjectives] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [todayAgenda, setTodayAgenda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newHours, setNewHours] = useState('1');

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const [objectiveRows, taskRows, agendaRows] = await Promise.all([
        api.objectives(), api.tasks(), api.tasks({ date: today }),
      ]);
      setObjectives(objectiveRows);
      setTasks(taskRows);
      setTodayAgenda(agendaRows);
      setError('');
    } catch (_) {
      setError('No se pudo comprobar la planificación de hoy.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load({ quiet: true }), 30000);
    const refresh = () => load({ quiet: true });
    window.addEventListener('tasks-changed', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('tasks-changed', refresh);
    };
  }, [userId, today]);

  const objective = objectives.find(isMoneyObjective);
  const belongsToMoneyObjective = task => task.objective_id === objective?.id || isMoneyMakerTask(task);
  const objectiveTasks = useMemo(() => tasks.filter(belongsToMoneyObjective), [tasks, objective?.id]);
  const todayMoneyTasks = useMemo(() => [
    ...objectiveTasks.filter(task => !isFixedTask(task) && task.date === today),
    ...todayAgenda.filter(task => isFixedTask(task) && belongsToMoneyObjective(task)),
  ], [objectiveTasks, todayAgenda, objective?.id, today]);
  const backlogTasks = objectiveTasks.filter(task => !isFixedTask(task) && task.date !== today && task.status !== 'completed');
  const moneyMinutes = estimatedMinutes(todayMoneyTasks);
  const pendingTodayTodos = tasks.filter(task => isTodoTask(task) && task.date === today && task.status !== 'completed');
  const plannedMinutes = estimatedMinutes(pendingTodayTodos);
  const availableMinutes = availableTodoMinutes(todayAgenda, today);
  const excessMinutes = Math.max(0, plannedMinutes - availableMinutes);
  const missingMinutes = Math.max(0, REQUIRED_MINUTES - moneyMinutes);

  async function updateTask(task, changes) {
    setSavingId(task.id);
    setError('');
    try {
      await api.updateTask(task.id, changes);
      await load({ quiet: true });
    } catch (_) {
      setError('No se pudo guardar el cambio. Vuelve a intentarlo.');
    } finally {
      setSavingId(null);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    const hours = Number(newHours);
    if (!newTitle.trim() || !(hours > 0)) {
      setError('Escribe un título y una duración mayor que cero.');
      return;
    }
    setSavingId('new');
    try {
      await api.createTask({
        title: newTitle.trim(), date: today, start_time: null, end_time: null,
        duration_estimated: Math.round(hours * 60), status: 'pending', priority: 2,
        objective_id: objective.id, is_fixed: 0, is_money_maker: 1,
      });
      setNewTitle('');
      setNewHours('1');
      await load({ quiet: true });
    } catch (_) {
      setError('No se pudo crear el ToDo. Vuelve a intentarlo.');
    } finally {
      setSavingId(null);
    }
  }

  const gateOpen = !loading && objective && moneyMinutes < REQUIRED_MINUTES;

  return <>
    {!loading && excessMinutes > 0 && <section className="daily-overload-banner" role="alert">
      <strong>Tu lista de hoy no es realista</strong>
      <span>Has planificado {formatDuration(plannedMinutes)}, pero solo quedan {formatDuration(availableMinutes) || '0m'} disponibles.</span>
      <span>Saca al menos {formatDuration(excessMinutes)} de la lista de hoy.</span>
    </section>}

    {gateOpen && <div className="daily-money-backdrop">
      <section className="daily-money-modal" role="dialog" aria-modal="true" aria-labelledby="daily-money-title"
        style={{ '--daily-money-color': objective.color || 'var(--accent)' }}>
        <header>
          <div>
            <div className="daily-money-kicker">Planificación obligatoria</div>
            <h2 id="daily-money-title">{MONEY_OBJECTIVE_DISPLAY_TITLE}</h2>
            <p>Asigna al menos 4h a hoy antes de continuar.</p>
          </div>
          <div className="daily-money-progress" aria-live="polite">
            <strong>{formatDuration(moneyMinutes) || '0m'} / 4h</strong>
            <span>Faltan {formatDuration(missingMinutes)}</span>
          </div>
        </header>

        {error && <div className="daily-money-error" role="alert">{error}</div>}

        <form className="daily-money-create" onSubmit={createTask}>
          <label className="daily-money-title-field">Título
            <input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Nuevo ToDo para hoy" aria-label="Título del nuevo ToDo" />
          </label>
          <label>Horas <input type="number" min="0.25" step="0.25" value={newHours} onChange={event => setNewHours(event.target.value)} /></label>
          <button className="btn btn-primary" disabled={savingId === 'new'}>{savingId === 'new' ? 'Creando…' : 'Crear'}</button>
        </form>

        <div className="daily-money-columns">
          <div>
            <h3>Hoy</h3>
            {!todayMoneyTasks.length && <p className="empty-state">Todavía no has asignado ningún ToDo.</p>}
            {todayMoneyTasks.map(task => <div className="daily-money-task" key={task.id}>
              <span>{task.title}</span>
              <label>Horas <input type="number" min="0.25" step="0.25" defaultValue={(Number(task.duration_estimated) || 0) / 60 || ''}
                disabled={savingId === task.id}
                onBlur={event => {
                  const hours = Number(event.target.value);
                  if (hours > 0 && Math.round(hours * 60) !== Number(task.duration_estimated)) updateTask(task, { duration_estimated: Math.round(hours * 60) });
                }} /></label>
              {isFixedTask(task)
                ? <small>Tarea fija</small>
                : <button className="btn btn-ghost btn-sm" disabled={savingId === task.id} onClick={() => updateTask(task, { date: null, start_time: null, end_time: null })}>Sacar de hoy</button>}
            </div>)}
          </div>
          <div>
            <h3>Tareas Money maker disponibles</h3>
            {!backlogTasks.length && <p className="empty-state">No hay más tareas Money maker pendientes.</p>}
            {backlogTasks.map(task => <div className="daily-money-task" key={task.id}>
              <span>{task.title}</span>
              <small>{Number(task.duration_estimated) > 0 ? formatDuration(Number(task.duration_estimated)) : 'Sin duración'}</small>
              <button className="btn btn-ghost btn-sm" disabled={savingId === task.id} onClick={() => updateTask(task, { date: today, start_time: null, end_time: null })}>Añadir a hoy</button>
            </div>)}
          </div>
        </div>
      </section>
    </div>}
  </>;
}
