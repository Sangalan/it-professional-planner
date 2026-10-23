import React, { useEffect, useRef, useState } from 'react';
import { CLOCK_COLORS, DEFAULT_COLOR, TIME_ZONES, getClockParts } from '../utils/worldClocks.js';
import './WorldClocksView.css';

function AnalogClock({ hour, minute, city, color, onClick, expanded }) {
  const Element = onClick ? 'button' : 'div';
  return (
    <Element type={onClick ? 'button' : undefined} className="world-clock-face" style={{ '--clock-color': color || DEFAULT_COLOR }}
      aria-label={onClick ? `Cambiar color del reloj de ${city}` : undefined} aria-expanded={onClick ? expanded : undefined} onClick={onClick}>
      {[...Array(12)].map((_, index) => (
        <span key={index} className="world-clock-tick" style={{ transform: `rotate(${index * 30}deg)` }} />
      ))}
      <span className="world-clock-hand world-clock-hour" style={{ transform: `rotate(${(hour % 12) * 30 + minute / 2}deg)` }} />
      <span className="world-clock-hand world-clock-minute" style={{ transform: `rotate(${minute * 6}deg)` }} />
      <span className="world-clock-center" />
    </Element>
  );
}

function nextFreeSlot(cities) {
  const occupied = new Set(cities.map(item => item.slot));
  let slot = 0;
  while (occupied.has(slot)) slot += 1;
  return slot;
}

function moveToSlot(cities, id, targetSlot) {
  const moving = cities.find(item => item.id === id);
  if (!moving || moving.slot === targetSlot || targetSlot < 0) return cities;
  const occupant = cities.find(item => item.slot === targetSlot);
  return cities.map(item => {
    if (item.id === id) return { ...item, slot: targetSlot };
    if (occupant && item.id === occupant.id) return { ...item, slot: moving.slot };
    return item;
  });
}

export default function WorldClocksView({ cities, ready, loading, error: storageError, update, retry }) {
  const [city, setCity] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [drag, setDrag] = useState(null);
  const [openColorId, setOpenColorId] = useState(null);
  const dragRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    let timer;
    const update = () => {
      setNow(new Date());
      timer = setTimeout(update, 60000 - Date.now() % 60000);
    };
    timer = setTimeout(update, 60000 - Date.now() % 60000);
    return () => clearTimeout(timer);
  }, []);

  function saveCities(next) {
    update(next);
  }

  function addCity(event) {
    event.preventDefault();
    const name = city.trim();
    const zone = timeZone.trim();
    if (!name || !TIME_ZONES.includes(zone)) {
      setFormError('Escribe una ciudad y selecciona una zona horaria de la lista.');
      return;
    }
    if (cities.some(item => item.city.toLocaleLowerCase('es') === name.toLocaleLowerCase('es') && item.timeZone === zone)) {
      setFormError('Esta ciudad ya está añadida.');
      return;
    }
    saveCities([...cities, { id: crypto.randomUUID(), city: name, timeZone: zone, slot: nextFreeSlot(cities), color: DEFAULT_COLOR, pinned: false }]);
    setCity('');
    setTimeZone('');
    setFormError('');
  }

  function slotAt(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY)?.closest('[data-clock-slot]');
    return element && gridRef.current?.contains(element) ? Number(element.dataset.clockSlot) : null;
  }

  function startDrag(event, clock) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    setOpenColorId(null);
    const card = event.currentTarget.closest('.world-clock-card');
    const rect = card.getBoundingClientRect();
    dragRef.current = { id: clock.id, pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ ...dragRef.current, x: event.clientX, y: event.clientY, targetSlot: clock.slot });
  }

  function moveDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const targetSlot = slotAt(event.clientX, event.clientY);
    setDrag(previous => previous && { ...previous, x: event.clientX, y: event.clientY, targetSlot });
  }

  function finishDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const targetSlot = slotAt(event.clientX, event.clientY);
    if (targetSlot !== null) saveCities(moveToSlot(cities, dragRef.current.id, targetSlot));
    dragRef.current = null;
    setDrag(null);
  }

  function cancelDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDrag(null);
  }

  function moveWithKeyboard(event, clock) {
    const columns = gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length : 1;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    saveCities(moveToSlot(cities, clock.id, clock.slot + offsets[event.key]));
  }

  const clocks = cities.map(item => ({ ...item, ...getClockParts(now, item.timeZone) }))
    .sort((a, b) => a.slot - b.slot);
  const draggedClock = clocks.find(clock => clock.id === drag?.id);
  const highestSlot = Math.max(-1, ...clocks.map(clock => clock.slot));
  const slotCount = Math.max(16, Math.ceil((highestSlot + 1) / 4) * 4);
  const visibleSlots = Array.from({ length: drag ? slotCount : highestSlot + 1 }, (_, slot) => slot);
  const clockBySlot = new Map(clocks.map(clock => [clock.slot, clock]));

  function renderClock(clock) {
    const colorOpen = openColorId === clock.id;
    return (
      <article className={`world-clock-card card${colorOpen ? ' has-palette' : ''}${drag?.id === clock.id ? ' is-dragged' : ''}`} key={clock.id}>
        <AnalogClock {...clock} expanded={colorOpen} onClick={() => setOpenColorId(colorOpen ? null : clock.id)} />
        <div className="world-clock-details"><h2>{clock.city}</h2></div>
        <time className="world-clock-time" dateTime={`${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`}>
          {String(clock.hour).padStart(2, '0')}:{String(clock.minute).padStart(2, '0')}
        </time>
        <div className="world-clock-actions">
          <button type="button" className="world-clock-remove" aria-label={`Quitar ${clock.city}`}
            title={`Quitar ${clock.city}`} onClick={() => saveCities(cities.filter(item => item.id !== clock.id))}>✕</button>
          <button type="button" className={`world-clock-pin${clock.pinned ? ' is-pinned' : ''}`}
            aria-label={clock.pinned ? `Desfijar ${clock.city}` : `Fijar ${clock.city} arriba`}
            aria-pressed={Boolean(clock.pinned)} title={clock.pinned ? 'Desfijar de la parte superior' : 'Fijar arriba'}
            onClick={() => saveCities(cities.map(item => item.id === clock.id ? { ...item, pinned: !item.pinned } : item))}>📌</button>
          <button type="button" className="world-clock-drag-handle" aria-label={`Mover ${clock.city}`}
            title={`Arrastrar ${clock.city} o usar las flechas del teclado`}
            onPointerDown={event => startDrag(event, clock)} onPointerMove={moveDrag}
            onPointerUp={finishDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
            onKeyDown={event => moveWithKeyboard(event, clock)}>⠿</button>
        </div>
        {colorOpen && (
          <div className="world-clock-palette" role="group" aria-label={`Color del reloj de ${clock.city}`}>
            {CLOCK_COLORS.map(color => (
              <button type="button" key={color.value} className={`world-clock-swatch${clock.color === color.value ? ' selected' : ''}`}
                style={{ backgroundColor: color.value }} aria-label={color.name} title={color.name}
                aria-pressed={clock.color === color.value}
                onClick={() => { saveCities(cities.map(item => item.id === clock.id ? { ...item, color: color.value } : item)); setOpenColorId(null); }} />
            ))}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="world-clocks-page">
      <div className="page-header">
        <div>
          <div className="page-title">🌍 Horas del mundo</div>
          <div className="page-subtitle">Arrastra las tarjetas para ordenarlas; pulsa un reloj para cambiar su color</div>
        </div>
      </div>

      <form className="world-clocks-form card" onSubmit={addCity}>
        <label>
          <span>Ciudad</span>
          <input value={city} onChange={event => setCity(event.target.value)} placeholder="Ej.: Lisboa" required disabled={!ready} />
        </label>
        <label>
          <span>Zona horaria de la ciudad</span>
          <input list="world-time-zones" value={timeZone} onChange={event => setTimeZone(event.target.value)}
            placeholder="Busca una ciudad o región" required disabled={!ready} />
          <datalist id="world-time-zones">
            {TIME_ZONES.map(zone => <option key={zone} value={zone} />)}
          </datalist>
        </label>
        <button className="btn btn-primary" type="submit" disabled={!ready}>+ Añadir ciudad</button>
        {formError && <p className="world-clocks-error" role="alert">{formError}</p>}
      </form>

      {storageError && <div className="world-clocks-storage-error" role="alert">{storageError} <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>Reintentar</button></div>}
      {loading ? (
        <div className="world-clocks-empty card">Cargando horas del mundo…</div>
      ) : clocks.length === 0 && ready ? (
        <div className="world-clocks-empty card">Añade una ciudad para ver su hora aquí.</div>
      ) : clocks.length > 0 && (
        <div ref={gridRef} className={`world-clocks-list${drag ? ' is-dragging' : ''}`}>
          {visibleSlots.map(slot => (
            <div key={slot} data-clock-slot={slot}
              className={`world-clock-slot${drag?.targetSlot === slot ? ' is-target' : ''}`}>
              {clockBySlot.has(slot) && renderClock(clockBySlot.get(slot))}
            </div>
          ))}
        </div>
      )}
      {draggedClock && (
        <div className="world-clock-drag-preview card" style={{
          left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.width,
        }} aria-hidden="true">
          <AnalogClock {...draggedClock} />
          <strong>{draggedClock.city}</strong>
          <time>{String(draggedClock.hour).padStart(2, '0')}:{String(draggedClock.minute).padStart(2, '0')}</time>
        </div>
      )}
    </div>
  );
}
