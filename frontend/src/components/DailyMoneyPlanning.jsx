import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDuration, toDateStr } from '../utils/dateUtils.js';
import { isFixedTask, isMoneyMakerTask, isMoneyObjective, isTodoTask } from '../utils/taskUtils.js';
import { availableTodoMinutes } from '../utils/todoCapacity.js';

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
  const [requiredMinutes, setRequiredMinutes] = useState(240);

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const [objectiveRows, taskRows, agendaRows, moneyStatus] = await Promise.all([
        api.objectives(), api.tasks(), api.tasks({ date: today }), api.moneyPlanningToday(),
      ]);
      setObjectives(objectiveRows);
      setTasks(taskRows);
      setTodayAgenda(agendaRows);
      setRequiredMinutes(moneyStatus.requiredMinutes);
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
    window.addEventListener('money-planning-config-changed', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('tasks-changed', refresh);
      window.removeEventListener('money-planning-config-changed', refresh);
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
  const missingMinutes = Math.max(0, requiredMinutes - moneyMinutes);

  const gateOpen = !loading && objective && moneyMinutes < requiredMinutes;
  const overloadVisible = !loading && !gateOpen && excessMinutes > 0;

  useEffect(() => {
    if (loading) return;
    window.dispatchEvent(new CustomEvent('money-planning-status-changed', {
      detail: { ready: Boolean(objective) && moneyMinutes >= requiredMinutes, moneyMinutes, requiredMinutes },
    }));
  }, [loading, objective?.id, moneyMinutes, requiredMinutes]);

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
        <span>Planifica {formatDuration(requiredMinutes)} de tareas Money maker para poder comenzar cualquier ToDo.</span>
        {error && <span>No se pudo actualizar la planificación.</span>}
      </div>
      <div className="daily-money-banner-progress">
        <strong>{formatDuration(moneyMinutes) || '0m'} / {formatDuration(requiredMinutes)}</strong>
        <span>Faltan {formatDuration(missingMinutes)}</span>
      </div>
    </section>}
  </>;
}
