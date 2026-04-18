import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { formatCountdown, secondsUntilTime, secondsBetweenTimes, timeToMinutes } from '../utils/dateUtils.js';
import { getCatColor, getCatLabel } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';

// Web Audio API beep — no external files needed
function playBeep(frequency = 880, duration = 0.6, type = 'sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    // Double beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = type;
    osc2.frequency.setValueAtTime(frequency * 1.2, ctx.currentTime + 0.2);
    gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.8);
  } catch (e) {
    console.warn('Audio not available', e);
  }
}

function useNowData() {
  const [data, setData] = useState(null);
  const refresh = useCallback(() => {
    api.tasksNow().then(setData).catch(console.error);
  }, []);
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30000); // refresh every 30s
    return () => clearInterval(iv);
  }, [refresh]);
  return { data, refresh };
}

export default function NowView() {
  const { data, refresh } = useNowData();
  const [tick, setTick] = useState(0);
  const [editTask, setEditTask] = useState(null);

  // Second-level tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Update document title with countdown; restore on unmount
  useEffect(() => {
    const DEFAULT_TITLE = 'Plan Maestro';
    if (!data) return;
    const { current, upcoming } = data;
    let secs = 0;
    if (current) {
      secs = secondsUntilTime(current.end_time);
      if (secs < 0) secs = 0;
    } else if (upcoming) {
      secs = secondsUntilTime(upcoming.start_time);
      if (secs < 0) secs = 0;
    }
    let pct = 0;
    if (current && current.start_time && current.end_time) {
      const total = secondsBetweenTimes(current.start_time, current.end_time);
      const elapsed = total - secs;
      pct = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
    }
    document.title = secs > 0 ? `${formatCountdown(secs)} · ${pct}%` : 'Sin tarea activa';
    return () => { document.title = DEFAULT_TITLE; };
  });

  if (!data) return <div className="empty-state">Cargando...</div>;

  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);
  const { current, upcoming } = data;

  // Compute countdown
  let timerSeconds = 0;
  let timerLabel = '';
  let timerMode = 'free'; // 'active' | 'waiting' | 'free'

  if (current) {
    // Time remaining in current task
    timerSeconds = secondsUntilTime(current.end_time);
    if (timerSeconds <= 0) {
      timerSeconds = 0;
      timerMode = 'free';
    } else {
      timerMode = 'active';
      timerLabel = 'tiempo restante';
    }
  } else if (upcoming) {
    timerSeconds = secondsUntilTime(upcoming.start_time);
    timerMode = timerSeconds > 0 ? 'waiting' : 'free';
    timerLabel = 'hasta la próxima tarea';
  }

  const timerDisplay = formatCountdown(timerSeconds);
  const timerClass = timerMode === 'active'
    ? (timerSeconds < 300 ? 'now-timer warning' : 'now-timer')
    : timerMode === 'waiting' ? 'now-timer free'
    : 'now-timer free';

  // Progress within current task
  let taskProgress = 0;
  if (current && current.start_time && current.end_time) {
    const total = secondsBetweenTimes(current.start_time, current.end_time);
    const elapsed = total - timerSeconds;
    taskProgress = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
  }

  const weekday = now.toLocaleDateString('es-ES', { weekday: 'long' });
  const dateLabel = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  const gapHours = current && upcoming
    ? (timeToMinutes(upcoming.start_time) - timeToMinutes(current.end_time)) / 60
    : 0;
  const hasGapBetweenTasks = gapHours > (5 / 60);
  const formattedGapHours = Number.isInteger(gapHours) ? String(gapHours) : gapHours.toFixed(1);

  return (
    <div className="now-container">
      <div className="page-header" style={{ justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 4 }}>
        <div className="page-title" style={{ textTransform: 'capitalize' }}>{weekday}, {dateLabel}</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {timerLabel && <span>{timerLabel}</span>}
        </div>
      </div>

      {/* Big timer */}
      <div className={timerClass}>
        {timerMode === 'free' && !upcoming ? '–' : timerDisplay}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginBottom: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <span>🕐 {timeStr}</span>
        <button
          onClick={() => playBeep()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-3)', padding: 0 }}
          title="Probar sonido"
        >
          test
        </button>
      </div>

      {/* Current task */}
      {current ? (
        <div
          className="now-task-card"
          style={{ borderColor: getCatColor(current.category_id) + '88', background: getCatColor(current.category_id) + '11', cursor: 'pointer' }}
          onClick={() => setEditTask(current)}
          title="Editar tarea"
        >
          <div className="now-task-label" style={{ color: getCatColor(current.category_id) }}>
            TAREA ACTIVA · {getCatLabel(current.category_id)}
          </div>
          <div className="now-task-title">{current.title}</div>
          <div className="now-task-time">
            {current.start_time} → {current.end_time}
            &nbsp;·&nbsp;
            {timerSeconds > 0 ? `${formatCountdown(timerSeconds)} restantes` : 'Terminada'}
          </div>
          {/* Progress bar of time elapsed */}
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-fill"
              style={{ width: `${taskProgress}%`, background: getCatColor(current.category_id) }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{taskProgress}% del tiempo transcurrido</div>

          {/* Complete checkbox */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              onClick={async (e) => {
                e.stopPropagation();
                const newStatus = current.status === 'completed' ? 'pending' : 'completed';
                await api.updateTask(current.id, { status: newStatus, percentage_completed: newStatus === 'completed' ? 100 : current.percentage_completed });
                refresh();
              }}
              title={current.status === 'completed' ? 'Desmarcar como completada' : 'Marcar como completada'}
              style={{
                width: 22, height: 22, borderRadius: 5, cursor: 'pointer',
                border: `2px solid ${current.status === 'completed' ? getCatColor(current.category_id) : 'var(--border-2)'}`,
                background: current.status === 'completed' ? getCatColor(current.category_id) : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 13, fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {current.status === 'completed' ? '✓' : ''}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {current.status === 'completed' ? 'Completada' : 'Marcar como completada'}
            </span>
          </div>
        </div>
      ) : (
        <div className="now-free-card">
          <div style={{ fontSize: 32, marginBottom: 8 }}>☕</div>
          <div>No hay tarea activa ahora mismo</div>
        </div>
      )}

      {hasGapBetweenTasks && (
        <div style={{ textAlign: 'center', margin: '14px 0 10px', fontSize: 12, color: 'var(--text-3)' }}>
          ⏸ Tiempo libre entre tareas: {formattedGapHours}h
        </div>
      )}

      {/* Next task */}
      {upcoming && (
        <div className="now-next-card" style={{ cursor: 'pointer' }} onClick={() => setEditTask(upcoming)} title="Editar tarea">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>
            PRÓXIMA TAREA · en {formatCountdown(secondsUntilTime(upcoming.start_time))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="dot" style={{ background: getCatColor(upcoming.category_id), width: 10, height: 10 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{upcoming.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {upcoming.start_time} → {upcoming.end_time}
                &nbsp;·&nbsp;{getCatLabel(upcoming.category_id)}
              </div>
            </div>
          </div>
        </div>
      )}

      {editTask && (
        <TaskModal
          initial={editTask}
          onClose={() => setEditTask(null)}
          onSave={() => {
            setEditTask(null);
            refresh();
          }}
          onDeleted={() => {
            setEditTask(null);
            refresh();
          }}
        />
      )}

      {!current && !upcoming && (
        <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-3)', fontSize: 13 }}>
          No hay más tareas programadas para hoy.
        </div>
      )}
    </div>
  );
}
