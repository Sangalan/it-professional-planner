import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';

function fmtHour(h) {
  return `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`;
}

const DONE_STATUSES = new Set(['completed', 'published', 'merged', 'closed', 'failed', 'cancelled']);

function isActive(item) {
  return !DONE_STATUSES.has(item.status);
}

// Normalise every content type to a common shape
function normalise(items, type, icon, label, getDate, getObjId) {
  return items.filter(isActive).map(it => ({
    id: it.id,
    title: it.title,
    type,
    icon,
    typeLabel: label,
    date: getDate(it),
    objective_id: getObjId ? getObjId(it) : it.objective_id ?? null,
    raw: it,
  }));
}

const GROUPS = [
  { type: 'milestone',    icon: '🎯', label: 'Hitos' },
  { type: 'publication',  icon: '✍️',  label: 'Publicaciones' },
  { type: 'certification',icon: '🏆', label: 'Certificaciones' },
  { type: 'repo',         icon: '📦', label: 'Repositorios' },
  { type: 'pr',           icon: '🔀', label: 'Pull Requests' },
  { type: 'event',        icon: '🎪', label: 'Eventos' },
];

// Props:
//   date       — 'YYYY-MM-DD'
//   hour       — integer or null (null = let user pick slot first)
//   gapHours   — array of gap hour integers (used when hour is null)
//   onClose    — called on cancel / close
//   onCreated  — called after task is created successfully
export default function GapPickerDialog({ date, hour: initialHour, gapHours = [], onClose, onCreated }) {
  const [step, setStep] = useState(initialHour != null ? 'milestone' : 'slot');
  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [allItems, setAllItems] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState([]); // empty = all
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.milestones(),
      api.publications(),
      api.certifications(),
      api.repos(),
      api.prs(),
      api.events(),
      api.objectives(),
    ]).then(([ms, pubs, certs, repos, prs, evts, objs]) => {
      setObjectives(objs);
      setAllItems([
        ...normalise(ms.filter(m => m.id.startsWith('ms-')), 'milestone', '🎯', 'Hitos', it => it.target_date, null),
        ...normalise(pubs,  'publication',   '✍️',  'Publicaciones',   it => it.date,        null),
        ...normalise(certs, 'certification', '🏆', 'Certificaciones', it => it.target_date, null),
        ...normalise(repos, 'repo',          '📦', 'Repositorios',    it => it.target_date, null),
        ...normalise(prs,   'pr',            '🔀', 'Pull Requests',   it => it.end_date,    null),
        ...normalise(evts,  'event',         '🎪', 'Eventos',         it => it.start_date,  null),
      ]);
    });
  }, []);

  const objMap = useMemo(() => Object.fromEntries(objectives.map(o => [o.id, o])), [objectives]);

  const filtered = useMemo(() => {
    let out = allItems;
    if (activeTypes.length > 0) out = out.filter(it => activeTypes.includes(it.type));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(it => it.title.toLowerCase().includes(q));
    }
    return out;
  }, [allItems, search, activeTypes]);

  // Group by type preserving GROUPS order
  const grouped = useMemo(() => {
    return GROUPS
      .map(g => ({ ...g, items: filtered.filter(it => it.type === g.type) }))
      .filter(g => g.items.length > 0);
  }, [filtered]);

  function toggleType(type) {
    setActiveTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function pick(item) {
    if (creating) return;
    setCreating(true);
    const startTime = `${String(selectedHour).padStart(2, '0')}:00`;
    const endTime   = `${String(selectedHour + 1).padStart(2, '0')}:00`;
    const obj = objMap[item.objective_id];
    await api.createTask({
      title: `Tarea ${item.title}`,
      date,
      start_time: startTime,
      end_time: endTime,
      milestone_id: item.id,
      objective_id: item.objective_id || (obj?.id ?? null),
      status: 'pending',
    });
    setCreating(false);
    onCreated();
    onClose();
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Which types actually have items (before type filter, only search)
  const availableTypes = useMemo(() => {
    const searchFiltered = search.trim()
      ? allItems.filter(it => it.title.toLowerCase().includes(search.trim().toLowerCase()))
      : allItems;
    return new Set(searchFiltered.map(it => it.type));
  }, [allItems, search]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 400, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 24,
        maxWidth: 500, width: '100%', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Hueco libre · {dateLabel}</div>
            {step === 'milestone' && selectedHour != null && (
              <div style={{ fontSize: 12, color: '#92400e', marginTop: 3, fontWeight: 600 }}>
                {fmtHour(selectedHour)}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {step === 'slot' ? 'Selecciona el hueco horario' : 'Selecciona un elemento para crear la tarea'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--text-3)', lineHeight: 1, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Step: slot picker */}
        {step === 'slot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
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

        {/* Step: milestone/content picker */}
        {step === 'milestone' && (
          <>
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar hito, publicación, PR…"
              style={{ width: '100%', fontSize: 13, marginBottom: 10, flexShrink: 0 }}
              autoFocus
            />

            {/* Type filter pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12, flexShrink: 0 }}>
              {GROUPS.filter(g => availableTypes.has(g.type)).map(g => {
                const active = activeTypes.includes(g.type);
                return (
                  <span key={g.type} onClick={() => toggleType(g.type)} style={{
                    cursor: 'pointer', fontSize: 11, padding: '3px 9px', borderRadius: 10,
                    background: active ? 'var(--accent)' : 'var(--bg)',
                    color: active ? 'white' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    fontWeight: active ? 600 : 400,
                    userSelect: 'none',
                  }}>
                    {g.icon} {g.label}
                  </span>
                );
              })}
              {activeTypes.length > 0 && (
                <span onClick={() => setActiveTypes([])} style={{
                  cursor: 'pointer', fontSize: 11, padding: '3px 9px', borderRadius: 10,
                  background: 'var(--bg)', color: 'var(--text-3)',
                  border: '1px solid var(--border)', userSelect: 'none',
                }}>
                  ✕ Todos
                </span>
              )}
            </div>

            {/* Results grouped by type */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {grouped.length === 0 ? (
                <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  {allItems.length === 0 ? 'No hay elementos pendientes disponibles' : 'Sin resultados'}
                </div>
              ) : grouped.map(group => (
                <div key={group.type}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    marginBottom: 6, paddingBottom: 4,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {group.icon} {group.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {group.items.map(item => {
                      const obj = objMap[item.objective_id];
                      return (
                        <div key={item.id}
                          onClick={() => pick(item)}
                          style={{
                            padding: '8px 12px', borderRadius: 8,
                            cursor: creating ? 'wait' : 'pointer',
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            opacity: creating ? 0.6 : 1,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { if (!creating) e.currentTarget.style.background = 'var(--accent-light)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--text-3)' }}>
                            {obj && <span>{obj.title}</span>}
                            {item.date && <span>· {item.date}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {initialHour == null && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, flexShrink: 0 }}
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
