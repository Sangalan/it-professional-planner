import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function fmtHour(h) {
  return `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`;
}

// Props:
//   date       — 'YYYY-MM-DD'
//   hour       — integer or null (null = let user pick slot first)
//   gapHours   — array of gap hour integers (used when hour is null)
//   onClose    — called on cancel / close
//   onCreated  — called after task is created successfully
export default function GapPickerDialog({ date, hour: initialHour, gapHours = [], onClose, onCreated }) {
  const [step, setStep] = useState(initialHour != null ? 'milestone' : 'slot');
  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [milestones, setMilestones] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.milestones(), api.objectives()]).then(([ms, objs]) => {
      setMilestones(ms.filter(m => m.status !== 'completed'));
      setObjectives(objs);
    });
  }, []);

  async function pick(milestone) {
    if (creating) return;
    setCreating(true);
    const startTime = `${String(selectedHour).padStart(2, '0')}:00`;
    const endTime   = `${String(selectedHour + 1).padStart(2, '0')}:00`;
    await api.createTask({
      title: `Tarea ${milestone.title}`,
      date,
      start_time: startTime,
      end_time: endTime,
      milestone_id: milestone.id,
      status: 'pending',
    });
    setCreating(false);
    onCreated();
    onClose();
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 400, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 24,
        maxWidth: 440, width: '100%', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Hueco libre · {dateLabel}</div>
            {step === 'milestone' && selectedHour != null && (
              <div style={{ fontSize: 12, color: '#92400e', marginTop: 3, fontWeight: 600 }}>
                {fmtHour(selectedHour)}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {step === 'slot' ? 'Selecciona el hueco horario' : 'Selecciona un hito para crear la tarea'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--text-3)', lineHeight: 1, flexShrink: 0,
          }}>✕</button>
        </div>

        {step === 'slot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gapHours.map(h => (
              <div key={h}
                onClick={() => { setSelectedHour(h); setStep('milestone'); }}
                style={{
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  background: '#fef9c3', border: '1px solid #fde047',
                  fontWeight: 600, fontSize: 13, color: '#92400e',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                ⏰ {fmtHour(h)}
              </div>
            ))}
          </div>
        )}

        {step === 'milestone' && (
          <>
            {milestones.length === 0 ? (
              <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No hay hitos pendientes disponibles
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {milestones.map(m => {
                  const obj = objectives.find(o => o.id === m.objective_id);
                  return (
                    <div key={m.id}
                      onClick={() => pick(m)}
                      style={{
                        padding: '10px 14px', borderRadius: 8,
                        cursor: creating ? 'wait' : 'pointer',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        opacity: creating ? 0.6 : 1,
                      }}
                      onMouseEnter={e => { if (!creating) e.currentTarget.style.background = 'var(--accent-light)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                      {obj && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{obj.title}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {initialHour == null && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                onClick={() => setStep('slot')}>
                ← Cambiar horario
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
