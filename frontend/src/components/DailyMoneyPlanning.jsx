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
  const [error, setError] = useState('');

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
  const moneyMinutes = estimatedMinutes(todayMoneyTasks);
  const pendingTodayTodos = tasks.filter(task => isTodoTask(task) && task.date === today && task.status !== 'completed');
  const plannedMinutes = estimatedMinutes(pendingTodayTodos);
  const availableMinutes = availableTodoMinutes(todayAgenda, today);
  const excessMinutes = Math.max(0, plannedMinutes - availableMinutes);
  const missingMinutes = Math.max(0, REQUIRED_MINUTES - moneyMinutes);

  const gateOpen = !loading && objective && moneyMinutes < REQUIRED_MINUTES;
  const overloadVisible = !loading && !gateOpen && excessMinutes > 0;

  useEffect(() => {
    if (loading) return;
    window.dispatchEvent(new CustomEvent('money-planning-status-changed', {
      detail: { ready: Boolean(objective) && moneyMinutes >= REQUIRED_MINUTES, moneyMinutes, requiredMinutes: REQUIRED_MINUTES },
    }));
  }, [loading, objective?.id, moneyMinutes]);

  useEffect(() => {
    if (loading) return;
    const status = { moneyVisible: Boolean(gateOpen), overloadVisible };
    window.__dailyPlannerBannerStatus = status;
    window.dispatchEvent(new CustomEvent('daily-banner-status-changed', { detail: status }));
  }, [loading, gateOpen, overloadVisible]);

  return <>
    {overloadVisible && <section className="daily-overload-banner" role="alert">
      <strong>Tu lista de hoy no es realista</strong>
      <span>Has planificado {formatDuration(plannedMinutes)}, pero solo quedan {formatDuration(availableMinutes) || '0m'} disponibles.</span>
      <span>Saca al menos {formatDuration(excessMinutes)} de la lista de hoy.</span>
    </section>}

    {gateOpen && <section className="daily-money-banner" role="status" aria-live="polite">
      <div>
        <div className="daily-money-kicker">Prioridad del día</div>
        <strong>{MONEY_OBJECTIVE_DISPLAY_TITLE}</strong>
        <span>Planifica 4h de tareas Money maker para poder comenzar cualquier ToDo.</span>
        {error && <span>No se pudo actualizar la planificación.</span>}
      </div>
      <div className="daily-money-banner-progress">
        <strong>{formatDuration(moneyMinutes) || '0m'} / 4h</strong>
        <span>Faltan {formatDuration(missingMinutes)}</span>
      </div>
    </section>}
  </>;
}
