import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, parseISO, format
} from '../utils/dateUtils.js';
import { es } from 'date-fns/locale';

const DOW = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const POPUP_W = 280;
const POPUP_H = 320;
const VIEWPORT_PAD = 8;

function parseValue(value) {
  if (!value) return null;
  try { return parseISO(value); } catch (_) { return null; }
}

export default function SpanishDateInput({ value, onChange, style, placeholder = 'Fecha' }) {
  const rootRef = useRef(null);
  const popupRef = useRef(null);
  const selectedDate = parseValue(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => selectedDate || new Date());
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: POPUP_W });

  function updatePopupPosition() {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const width = Math.min(POPUP_W, viewportW - VIEWPORT_PAD * 2);
    const maxLeft = viewportW - width - VIEWPORT_PAD;
    const left = Math.max(VIEWPORT_PAD, Math.min(rect.left, maxLeft));

    const belowTop = rect.bottom + 6;
    const aboveTop = rect.top - POPUP_H - 6;
    const showAbove = belowTop + POPUP_H > viewportH - VIEWPORT_PAD && aboveTop >= VIEWPORT_PAD;
    const naturalTop = showAbove ? aboveTop : belowTop;
    const maxTop = Math.max(VIEWPORT_PAD, viewportH - POPUP_H - VIEWPORT_PAD);
    const top = Math.max(VIEWPORT_PAD, Math.min(naturalTop, maxTop));

    setPopupPos({ top, left, width });
  }

  useEffect(() => {
    function onDocClick(e) {
      const inRoot = rootRef.current?.contains(e.target);
      const inPopup = popupRef.current?.contains(e.target);
      if (!inRoot && !inPopup) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onViewportChange() {
      updatePopupPosition();
    }
    if (open) {
      updatePopupPosition();
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKeyDown);
      window.addEventListener('resize', onViewportChange);
      window.addEventListener('scroll', onViewportChange, true);
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (selectedDate) setMonth(selectedDate);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const display = selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: es }) : '';

  function pick(d) {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--surface)',
          color: display ? 'var(--text-1)' : 'var(--text-3)',
          padding: '8px 10px',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {display || placeholder}
      </button>

      {open && createPortal((
        <div style={{
          position: 'fixed',
          zIndex: 1000,
          top: popupPos.top,
          left: popupPos.left,
          width: popupPos.width,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: 'var(--shadow-md)',
          padding: 10,
        }} ref={popupRef}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(m => subMonths(m, 1))}>‹</button>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
              {format(month, 'MMMM yyyy', { locale: es })}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(m => addMonths(m, 1))}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DOW.map(d => (
              <div key={d} style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '4px 0' }}>{d}</div>
            ))}
            {days.map(d => {
              const sameMonth = isSameMonth(d, month);
              const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pick(d)}
                  style={{
                    border: '1px solid transparent',
                    borderRadius: 6,
                    padding: '5px 0',
                    fontSize: 12,
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? 'white' : (sameMonth ? 'var(--text-1)' : 'var(--text-3)'),
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>Limpiar</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick(new Date())}>Hoy</button>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
