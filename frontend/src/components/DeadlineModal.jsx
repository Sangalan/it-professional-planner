import React, { useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { api } from '../api.js';
import SpanishDateInput from './SpanishDateInput.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';
import { fmtDate } from '../utils/dateUtils.js';

export default function DeadlineModal({ initial = {}, onClose, onSave, onDeleted }) {
  useEscapeClose(onClose);
  const isEdit = Boolean(initial.id);
  const [title, setTitle] = useState(initial.title || '');
  const [date, setDate] = useState(initial.date || '');
  const [color, setColor] = useState(initial.color || '#dc2626');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !date) { setError('El nombre y la fecha son obligatorios'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) await api.updateDeadline(initial.id, { title: title.trim(), date, color });
      else await api.createDeadline({ title: title.trim(), date, color });
      onSave();
    } catch (_) { setError('No se pudo guardar la fecha límite.'); }
    finally { setSaving(false); }
  }
  return <div className="deadline-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="deadline-modal" onSubmit={submit}>
      <div className="deadline-modal-header"><h2>{isEdit ? 'Editar fecha límite' : 'Nueva fecha límite'}</h2><button type="button" onClick={onClose}>✕</button></div>
      <label>Nombre *<input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre de la fecha límite" /></label>
      <label>Fecha *<SpanishDateInput value={date} onChange={setDate} style={{ width: '100%' }} /></label>
      <label>Color<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
      {error && <div className="deadline-modal-error" role="alert">{error}</div>}
      <div className="deadline-modal-actions">
        {isEdit && <button type="button" className="btn btn-ghost deadline-delete" onClick={async () => {
          if (!confirm('¿Eliminar esta fecha límite?')) return;
          await api.deleteDeadline(initial.id); (onDeleted || onSave)();
        }}>Eliminar</button>}
        <span />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  </div>;
}

export function DeadlineChip({ deadline, onClick, compact = false }) {
  const days = deadline.date ? differenceInCalendarDays(parseISO(deadline.date), new Date()) : null;
  const remaining = days === null ? ''
    : days === 0 ? 'Hoy'
      : days === 1 ? 'Falta 1 día'
        : days > 1 ? `Faltan ${days} días`
          : days === -1 ? 'Venció hace 1 día'
            : `Venció hace ${Math.abs(days)} días`;
  const details = deadline.date ? `${fmtDate(deadline.date)} · ${remaining}` : remaining;
  return <button type="button" className={`deadline-chip${compact ? ' compact' : ''}`} style={{ '--deadline-color': deadline.color || '#dc2626' }}
    title={`Fecha límite: ${deadline.title}${details ? `. ${details}` : ''}`}
    onClick={e => { e.stopPropagation(); onClick?.(deadline); }}>
    📅 {deadline.title}{!compact && details ? ` · ${details}` : ''}
  </button>;
}
