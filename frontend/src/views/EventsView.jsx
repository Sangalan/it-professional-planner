import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtShortDate, fmtDate } from '../utils/dateUtils.js';
import CatBadge, { useCats } from '../components/CatBadge.jsx';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed',   label: 'Realizado ✓' },
  { value: 'cancelled',   label: 'Cancelado' },
];

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const fieldW = { marginBottom: 14 };

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function CategorySelector({ selected, onChange }) {
  const cats = useCats();
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {cats.map(cat => {
        const active = selected.includes(cat.id);
        return (
          <span key={cat.id} onClick={() => toggle(cat.id)} style={{
            cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 10,
            background: active ? cat.color + '33' : 'var(--bg)',
            color: active ? cat.color : 'var(--text-3)',
            border: `1px solid ${active ? cat.color : 'var(--border)'}`,
            fontWeight: active ? 600 : 400,
          }}>
            {cat.name}
          </span>
        );
      })}
    </div>
  );
}

function DetailDialog({ event, objectives, onClose, onSaved, onDeleted }) {
  const isNew = !event;
  const initCatIds = parseCatIds(event?.category_ids, event?.category_id);
  const [form, setForm] = useState({
    title:                event?.title || '',
    start_date:           event?.start_date || '',
    end_date:             event?.end_date || '',
    location:             event?.location || '',
    format:               event?.format || '',
    estimated_cost:       event?.estimated_cost ?? 0,
    status:               event?.status || 'not_started',
    objective_id:         event?.objective_id || '',
    notes:                event?.notes || '',
    percentage_completed: event?.percentage_completed ?? 0,
    registered:           !!event?.registered,
    hotel_booked:         !!event?.hotel_booked,
    flight_booked:        !!event?.flight_booked,
  });
  const [catIds, setCatIds] = useState(initCatIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      objective_id: form.objective_id || null,
      location: form.location || null,
      format: form.format || null,
      estimated_cost: Number(form.estimated_cost) || 0,
      percentage_completed: Number(form.percentage_completed),
      category_ids: catIds,
      category_id: catIds[0] || null,
      registered: form.registered ? 1 : 0,
      hotel_booked: form.hotel_booked ? 1 : 0,
      flight_booked: form.flight_booked ? 1 : 0,
    };
    if (isNew) {
      await api.createEvent(payload);
    } else {
      await api.updateEvent(event.id, payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const days = event?.days_remaining;
  const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 28,
        maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>🎪 {isNew ? 'Nuevo evento' : 'Evento'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Título *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus={isNew} />
          </div>
          <div>
            <label style={labelSt}>Inicio</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={labelSt}>Fin</label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Objetivo</label>
            <select value={form.objective_id} onChange={e => set('objective_id', e.target.value)} style={{ width: '100%' }}>
              <option value="">Sin objetivo</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Formato</label>
            <select value={form.format} onChange={e => {
              const v = e.target.value;
              setForm(p => ({ ...p, format: v, location: v === 'Online' ? 'Online' : (p.location === 'Online' ? '' : p.location) }));
            }} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              <option value="Presencial">Presencial</option>
              <option value="Online">Online</option>
            </select>
          </div>
          <div>
            <label style={labelSt}>Lugar</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
              style={{ width: '100%', background: form.format === 'Online' ? 'var(--bg)' : undefined }}
              placeholder="Madrid, Barcelona…"
              readOnly={form.format === 'Online'} />
          </div>
          <div>
            <label style={labelSt}>Coste (€)</label>
            <input type="number" min="0" step="0.01" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={fieldW}>
          <label style={labelSt}>% completado</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min="0" max="100" step="5"
              value={form.percentage_completed}
              onChange={e => set('percentage_completed', Number(e.target.value))}
              style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 36, color: 'var(--accent)' }}>{form.percentage_completed}%</span>
          </div>
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Logística</label>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { key: 'registered',   label: 'Registrado' },
              { key: 'hotel_booked', label: 'Hotel' },
              { key: 'flight_booked',label: 'Avión' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Categorías</label>
          <CategorySelector selected={catIds} onChange={setCatIds} />
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Notas</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!isNew ? (
            <button className="btn btn-ghost" onClick={async () => {
              if (!confirm('¿Eliminar este evento?')) return;
              setDeleting(true);
              const r = await api.deleteEvent(event.id);
              setDeleting(false);
              if (r.error) { alert(r.error); return; }
              onDeleted(); onClose();
            }} disabled={deleting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventsView() {
  const [events, setEvents] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const cats = useCats();

  async function load() {
    api.events().then(setEvents);
    api.objectives().then(setObjectives);
  }

  useEffect(() => { load(); }, []);

  const usedCatIds = [...new Set(events.flatMap(e => parseCatIds(e.category_ids, e.category_id)))];
  const usedCats = cats.filter(c => usedCatIds.includes(c.id));
  const visible = filterCat ? events.filter(e => parseCatIds(e.category_ids, e.category_id).includes(filterCat)) : events;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Eventos</div>
          <div className="page-subtitle">{visible.length} eventos</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nuevo</button>
      </div>

      {creating && (
        <DetailDialog event={null} objectives={objectives} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} onDeleted={() => {}} />
      )}
      {selected && (
        <DetailDialog event={selected} objectives={objectives} onClose={() => setSelected(null)} onSaved={load} onDeleted={() => { setSelected(null); load(); }} />
      )}

      {usedCats.length > 0 && (
        <div className="filter-row" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Categoría:</span>
          <span className={`chip ${!filterCat ? 'active' : ''}`} onClick={() => setFilterCat('')}>Todos</span>
          {usedCats.map(c => (
            <span key={c.id} className={`chip ${filterCat === c.id ? 'active' : ''}`}
              onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}>{c.name}</span>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎪</div>
          {filterCat ? 'Sin eventos en esta categoría' : 'Sin eventos'}
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {visible.map(ev => {
              const isActive = ev.start_date && ev.end_date && ev.start_date <= today && ev.end_date >= today;
              const catIds = parseCatIds(ev.category_ids, ev.category_id);
              const days = ev.days_remaining;
              const pct = ev.percentage_completed || 0;
              const daysCls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
              const notRegistered = !ev.registered;
              const missingLogistics = ev.registered && (!ev.hotel_booked || !ev.flight_booked);
              const rowBg = notRegistered ? '#fee2e2' : missingLogistics ? '#fef9c3' : isActive ? 'var(--accent-light)' : 'transparent';
              return (
                <div key={ev.id} className="task-row"
                  style={{ cursor: 'pointer', background: rowBg, margin: '0 -18px', padding: '10px 18px' }}
                  onClick={() => setSelected(ev)}>
                  <div className="task-info">
                    <div style={{ fontWeight: 500, fontSize: 13 }}>🎪 {ev.title}</div>
                    <div className="task-meta">
                      <span className="task-time">{fmtShortDate(ev.start_date)} → {fmtShortDate(ev.end_date)}</span>
                      {days != null && <span className={`milestone-days ${daysCls}`}>{days < 0 ? `${Math.abs(days)}d pasado` : days === 0 ? 'Hoy' : `${days}d`}</span>}
                      {isActive && <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }}>Activo</span>}
                      {ev.location && <span className="task-time">📍 {ev.location}</span>}
                      {catIds.map(cid => <CatBadge key={cid} id={cid} />)}
                      <span style={{ fontSize: 11, color: ev.registered ? '#16a34a' : '#dc2626' }}>{ev.registered ? '✓ Reg.' : '✗ Reg.'}</span>
                      {ev.format !== 'Online' && <span style={{ fontSize: 11, color: ev.hotel_booked ? '#16a34a' : '#b45309' }}>{ev.hotel_booked ? '✓ Hotel' : '✗ Hotel'}</span>}
                      {ev.format !== 'Online' && <span style={{ fontSize: 11, color: ev.flight_booked ? '#16a34a' : '#b45309' }}>{ev.flight_booked ? '✓ Avión' : '✗ Avión'}</span>}
                    </div>
                    {pct > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <div className="progress-bar" style={{ flex: 1, maxWidth: 140, height: 4 }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 28 }}>{pct}%</span>
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                    background: ev.status === 'completed' ? '#dcfce7' : ev.status === 'in_progress' ? '#dbeafe' : ev.status === 'cancelled' ? '#fee2e2' : 'var(--bg)',
                    color: ev.status === 'completed' ? '#16a34a' : ev.status === 'in_progress' ? '#2563eb' : ev.status === 'cancelled' ? '#dc2626' : 'var(--text-2)',
                  }}>
                    {STATUS_OPTIONS.find(s => s.value === ev.status)?.label || ev.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
