import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { formatCountdown, formatLiveCountdown, secondsUntilTime, timeToMinutes, getTaskTiming, formatTaskTimeRemaining } from '../utils/dateUtils.js';
import { getCatColor, getCatLabel } from '../utils/categoryUtils.js';
import TaskModal from '../components/TaskModal.jsx';
import MoneyMakerIcon from '../components/MoneyMakerIcon.jsx';
import { canCompleteTask, isTodoTask } from '../utils/taskUtils.js';

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
    window.addEventListener('tasks-changed', refresh);
    return () => { clearInterval(iv); window.removeEventListener('tasks-changed', refresh); };
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
      secs = getTaskTiming(current).remainingSeconds;
    } else if (upcoming) {
      secs = secondsUntilTime(upcoming.start_time);
      if (secs < 0) secs = 0;
    }
    let pct = 0;
    if (current) {
      const { totalSeconds } = getTaskTiming(current);
      pct = totalSeconds > 0 ? Math.min(100, Math.max(0, Math.round((totalSeconds - secs) / totalSeconds * 100))) : 0;
    }
    document.title = current ? `${formatTaskTimeRemaining(secs)} · ${pct}%`
      : secs > 0 ? formatLiveCountdown(secs) : 'Sin tarea activa';
    return () => { document.title = DEFAULT_TITLE; };
  });

  if (!data) return <div className="empty-state">Cargando...</div>;

  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);
  const { current, upcoming } = data;
  const activeTasks = data.activeTasks || (current ? [current] : []);

  // Compute countdown
  let timerSeconds = 0;
  let timerLabel = '';
  let timerMode = 'free'; // 'active' | 'waiting' | 'free'

  if (current) {
    // Time remaining in current task
    timerSeconds = getTaskTiming(current, now).remainingSeconds;
    if (timerSeconds <= 0) {
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

  const timerDisplay = current ? formatTaskTimeRemaining(timerSeconds) : formatLiveCountdown(timerSeconds);
  const timerClass = timerMode === 'active'
    ? (timerSeconds < 300 ? 'now-timer warning' : 'now-timer')
    : timerMode === 'waiting' ? 'now-timer free'
    : 'now-timer free';

  const weekday = now.toLocaleDateString('es-ES', { weekday: 'long' });
  const dateLabel = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  const gapHours = current?.end_time && upcoming
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
        {timerMode === 'free' && !current && !upcoming ? '–' : timerDisplay}
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
      {activeTasks.length ? activeTasks.map(task => {
        const { remainingSeconds, totalSeconds, scheduled } = getTaskTiming(task, now);
        const progress = totalSeconds > 0
          ? Math.min(100, Math.max(0, Math.round((totalSeconds - remainingSeconds) / totalSeconds * 100))) : 0;
        return <div key={task.id}
          className="now-task-card"
          style={{ borderColor: getCatColor(task.category_id) + '88', background: getCatColor(task.category_id) + '11', cursor: 'pointer' }}
          onClick={() => setEditTask(task)}
          title="Editar tarea"
        >
          <div className="now-task-label" style={{ color: getCatColor(task.category_id) }}>
            TAREA ACTIVA · {getCatLabel(task.category_id)}
          </div>
          <div className="now-task-title"><MoneyMakerIcon task={task} />{task.title}</div>
          <div className="now-task-time">
            {scheduled ? <>{task.start_time} → {task.end_time} · {formatTaskTimeRemaining(remainingSeconds)} restantes</>
              : `${formatTaskTimeRemaining(remainingSeconds)} de tiempo estimado restantes`}
          </div>
          {/* Progress bar of time elapsed */}
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-fill"
              style={{ width: `${progress}%`, background: getCatColor(task.category_id) }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{progress}% del tiempo transcurrido</div>

          {/* Complete checkbox */}
          {(canCompleteTask(task) || !isTodoTask(task)) ? (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isTodoTask(task)) {
                    await api.taskTimer(task.id, 'complete');
                  } else {
                    await api.completeScheduledTask(task);
                  }
                  refresh();
                }}
                title="Marcar como completada"
                style={{
                  width: 22, height: 22, borderRadius: 5, cursor: 'pointer',
                  border: '2px solid var(--border-2)',
                  background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  flexShrink: 0,
                }}
              >
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Marcar como completada
              </span>
            </div>
          ) : isTodoTask(task) ? (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-2)' }}>
              Tarea fija recurrente
            </div>
          ) : null}
        </div>;
      }) : (
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
              <div style={{ fontWeight: 600, fontSize: 15 }}><MoneyMakerIcon task={upcoming} />{upcoming.title}</div>
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
