import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { fmtShortDate } from '../utils/dateUtils.js';
import { CategoryBadges, CategoryOption, useCats } from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import ContentSearchFilters from '../components/ContentSearchFilters.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';

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

function fmtCost(value) {
  return `€${Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
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
        return <CategoryOption key={cat.id} cat={cat} active={active} onClick={() => toggle(cat.id)} />;
      })}
    </div>
  );
}

export function DetailDialog({ event, objectives, onClose, onSaved, onDeleted }) {
  useEscapeClose(onClose);
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
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      alert('La fecha de fin no puede ser anterior a la fecha de inicio');
      return;
    }
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
            <SpanishDateInput value={form.start_date} onChange={v => set('start_date', v)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={labelSt}>Fin</label>
            <SpanishDateInput value={form.end_date} onChange={v => set('end_date', v)} style={{ width: '100%' }} />
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
            <input type="text" inputMode="decimal" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} style={{ width: '100%' }} />
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
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterCats, setFilterCats] = useState([]);

  async function load() {
    api.events().then(setEvents);
    api.objectives().then(setObjectives);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const intent = location.state;
    if (!intent?.fromSearch || intent.itemKind !== 'event') return;
    const target = events.find(e => String(e.id) === String(intent.itemId));
    if (!target) return;
    setSelected(target);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, events]);

  const usedCatIds = [...new Set(events.flatMap(e => parseCatIds(e.category_ids, e.category_id)))];
  const normalizedSearch = searchTitle.trim().toLowerCase();
  const dateMatches = (ev) => {
    const start = ev.start_date || ev.end_date;
    const end = ev.end_date || ev.start_date;
    if (!start && !end) return !fromDate && !toDate;
    if (fromDate && end && end < fromDate) return false;
    if (toDate && start && start > toDate) return false;
    return true;
  };
  const visible = events
    .filter(e => !normalizedSearch || (e.title || '').toLowerCase().includes(normalizedSearch))
    .filter(dateMatches)
    .filter(e => filterCats.length === 0 || filterCats.some(fc => parseCatIds(e.category_ids, e.category_id).includes(fc)));

  const today = new Date().toISOString().slice(0, 10);
  const isPastEvent = ev => {
    if (ev.status === 'cancelled') return true;
    const endOrStart = ev.end_date || ev.start_date;
    return !!endOrStart && endOrStart < today;
  };
  const upcomingOrCurrentEvents = visible.filter(ev => !isPastEvent(ev));
  const pastEvents = visible.filter(isPastEvent);
  const totalEvents = events.length;
  const upcomingEvents = events.filter(ev => !isPastEvent(ev)).length;
  const completedEvents = events.filter(ev => ev.status === 'completed').length;
  const totalCost = events.reduce((sum, ev) => sum + (Number(ev.estimated_cost) || 0), 0);

  function renderEventRow(ev) {
    const isActive = ev.start_date && ev.end_date && ev.start_date <= today && ev.end_date >= today;
    const isPast = isPastEvent(ev);
    const catIds = parseCatIds(ev.category_ids, ev.category_id);
    const days = ev.days_remaining;
    const pct = ev.percentage_completed || 0;
    const daysCls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
    const notRegistered = !ev.registered;
    const missingLogistics = ev.registered && (!ev.hotel_booked || !ev.flight_booked);
    const rowBg = ev.status === 'cancelled'
      ? '#e5e7eb'
      : isPast
        ? '#ffffff'
      : notRegistered
        ? '#fee2e2'
        : missingLogistics
          ? '#fef9c3'
          : isActive
            ? 'var(--accent-light)'
            : 'transparent';
    return (
      <div key={ev.id} className="task-row"
        style={{ cursor: 'pointer', background: rowBg, margin: '0 -18px', padding: '10px 18px' }}
        onClick={() => setSelected(ev)}>
        <div className="task-info">
          <div style={{ fontWeight: 500, fontSize: 13, textDecoration: ev.status === 'cancelled' ? 'line-through' : 'none' }}>🎪 {ev.title}</div>
          <div className="task-meta">
            {days != null && <span className={`milestone-days ${daysCls}`}>{days < 0 ? `${Math.abs(days)}d pasado` : days === 0 ? 'Hoy' : `${days}d`}</span>}
            <span className="task-time">{fmtShortDate(ev.start_date)} → {fmtShortDate(ev.end_date)}</span>
            {isActive && <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }}>Activo</span>}
            {ev.location && <span className="task-time">📍 {ev.location}</span>}
            <span style={{ fontSize: 11, color: ev.registered ? '#16a34a' : '#dc2626' }}>{ev.registered ? '✓ Reg.' : '✗ Reg.'}</span>
            {ev.format !== 'Online' && <span style={{ fontSize: 11, color: ev.hotel_booked ? '#16a34a' : '#b45309' }}>{ev.hotel_booked ? '✓ Hotel' : '✗ Hotel'}</span>}
            {ev.format !== 'Online' && <span style={{ fontSize: 11, color: ev.flight_booked ? '#16a34a' : '#b45309' }}>{ev.flight_booked ? '✓ Avión' : '✗ Avión'}</span>}
          </div>
          {catIds.length > 0 && (
            <div className="task-meta" style={{ marginTop: 3 }}>
              <CategoryBadges ids={catIds} />
            </div>
          )}
          {pct > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <div className="progress-bar" style={{ flex: 1, maxWidth: 140, height: 4 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 28 }}>{pct}%</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
            background: ev.status === 'completed' ? '#dcfce7' : ev.status === 'in_progress' ? '#dbeafe' : ev.status === 'cancelled' ? '#e5e7eb' : 'var(--bg)',
            color: ev.status === 'completed' ? '#16a34a' : ev.status === 'in_progress' ? '#2563eb' : ev.status === 'cancelled' ? '#4b5563' : 'var(--text-2)',
          }}>
            {STATUS_OPTIONS.find(s => s.value === ev.status)?.label || ev.status}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtCost(ev.estimated_cost)}</span>
        </div>
      </div>
    );
  }

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

      <ContentMetricsSummary
        title="Resumen de eventos"
        metrics={[
          { label: 'Eventos totales', value: totalEvents, sub: 'registrados' },
          { label: 'Próximos/activos', value: upcomingEvents, sub: 'pendientes de ocurrir', valueStyle: { color: '#2563eb' } },
          { label: 'Completados', value: completedEvents, sub: `de ${totalEvents} total`, valueStyle: { color: 'var(--success)' } },
          { label: 'Coste total', value: fmtCost(totalCost), sub: 'suma de todos los eventos', valueStyle: { color: 'var(--accent)' } },
        ]}
      />

      <ContentSearchFilters
        title={searchTitle}
        onTitleChange={setSearchTitle}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        selectedCats={filterCats}
        onSelectedCatsChange={setFilterCats}
        availableCatIds={usedCatIds}
      />

      {visible.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎪</div>
          {filterCats.length > 0 || searchTitle || fromDate || toDate ? 'Sin resultados' : 'Sin eventos'}
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ padding: '0 18px' }}>
              {upcomingOrCurrentEvents.length > 0 ? upcomingOrCurrentEvents.map(renderEventRow) : (
                <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--text-3)' }}>Sin eventos próximos o activos</div>
              )}
            </div>
          </div>
          {pastEvents.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ padding: '14px 18px 4px', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                Eventos pasados o cancelados
              </div>
              <div style={{ padding: '0 18px' }}>
                {pastEvents.map(renderEventRow)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
