import React, { useRef, useState } from 'react';

const clamp = value => Math.max(0, Math.min(100, value));

export default function PhotoLabelsEditor({ photo, onChange, onClose, disabled }) {
  const [selectedId, setSelectedId] = useState(photo.labels?.[0]?.id || null);
  const [placing, setPlacing] = useState(false);
  const canvas = useRef(null);
  const dragging = useRef(null);
  const labels = photo.labels || [];
  const selected = labels.find(label => label.id === selectedId);
  function update(id, changes) { onChange({ ...photo, labels: labels.map(label => label.id === id ? { ...label, ...changes } : label) }); }
  function position(event, id) {
    const rect = canvas.current.getBoundingClientRect();
    update(id, { x: clamp((event.clientX - rect.left) / rect.width * 100), y: clamp((event.clientY - rect.top) / rect.height * 100) });
  }
  function finishDrag() { dragging.current = null; }
  return <fieldset disabled={disabled} className="project-label-editor">
    <div className="project-section-heading"><div><h3>Etiquetas de la foto</h3><p>{photo.name}</p></div><button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar editor</button></div>
    <p className="project-hint">Añade texto y arrastra su etiqueta. También puedes pulsar «Colocar en la foto» y tocar el punto deseado.</p>
    <div ref={canvas} className={`project-label-canvas ${placing ? 'is-placing' : ''}`} onClick={event => {
      if (!disabled && placing && selected && event.target.tagName === 'IMG') { position(event, selected.id); setPlacing(false); }
    }}>
      <img src={photo.src} alt={photo.name} draggable={false} />
      {labels.map(label => <button key={label.id} type="button" className={`project-photo-label ${selectedId === label.id ? 'is-selected' : ''}`} style={{ left: `${label.x}%`, top: `${label.y}%`, transform: `translate(-${label.x}%, -${label.y}%)` }} aria-label={`Seleccionar etiqueta: ${label.text || 'Sin texto'}`} aria-pressed={selectedId === label.id}
        onClick={() => { setSelectedId(label.id); setPlacing(false); }}
        onPointerDown={event => {
          if (disabled) return;
          setSelectedId(label.id); setPlacing(false); dragging.current = label.id; event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => { if (!disabled && dragging.current === label.id) position(event, label.id); }}
        onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
        onKeyDown={event => {
          const movements = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const movement = movements[event.key];
          if (movement) { event.preventDefault(); update(label.id, { x: clamp(label.x + movement[0]), y: clamp(label.y + movement[1]) }); }
        }}>{label.text || 'Etiqueta sin texto'}</button>)}
    </div>
    <div className="project-label-actions"><button type="button" className="btn btn-primary" onClick={() => {
      const id = crypto.randomUUID ? crypto.randomUUID() : `label-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      onChange({ ...photo, labels: [...labels, { id, text: 'Etiqueta', x: 50, y: 50 }] }); setSelectedId(id); setPlacing(false);
    }}>+ Añadir etiqueta</button></div>
    {selected && <div className="project-label-fields">
      <label className="project-field">Etiqueta<select aria-label="Etiqueta seleccionada" value={selected.id} onChange={event => { setSelectedId(event.target.value); setPlacing(false); }}>{labels.map(label => <option key={label.id} value={label.id}>{label.text || 'Sin texto'}</option>)}</select></label>
      <label className="project-field">Texto<textarea key={selected.id} autoFocus rows={2} maxLength={500} aria-label="Texto de la etiqueta" value={selected.text} onChange={event => update(selected.id, { text: event.target.value })} /></label>
      <div className="project-label-position">{[['x', 'Posición horizontal (%)'], ['y', 'Posición vertical (%)']].map(([axis, title]) => <label key={axis} className="project-field">{title}<input type="range" min="0" max="100" step="1" aria-label={title} value={selected[axis]} onChange={event => update(selected.id, { [axis]: Number(event.target.value) })} /></label>)}</div>
      <div className="project-label-actions"><button type="button" className="btn btn-ghost" aria-pressed={placing} onClick={() => setPlacing(previous => !previous)}>{placing ? 'Cancelar colocación' : 'Colocar en la foto'}</button><button type="button" className="project-text-button project-delete-button" onClick={() => { onChange({ ...photo, labels: labels.filter(label => label.id !== selected.id) }); setSelectedId(null); setPlacing(false); }}>Eliminar etiqueta</button></div>
      {placing && <p role="status" className="project-hint">Toca o haz clic en la foto para colocar la etiqueta.</p>}
    </div>}
  </fieldset>;
}
