import React from 'react';

export default function IndependentVisibility({ value, onChange, color, onColorChange, parentColor }) {
  return <div><label className="independent-visibility">
    <input type="checkbox" checked={Number(value) === 1} onChange={event => onChange(event.target.checked ? 1 : 0)} />
    <span><strong>Mostrar independiente</strong><small>También aparecerá por separado en Todo list y Objetivos. Seguirá dentro de su objetivo padre.</small></span>
  </label>
    {Number(value) === 1 && onColorChange && <div className="independent-color-picker">
      <label>Color del proyecto independiente <input type="color" aria-label="Color del proyecto independiente" value={color || parentColor || '#2563eb'} onChange={event => onColorChange(event.target.value)} /></label>
      <button type="button" className="btn btn-ghost btn-sm" disabled={!color} onClick={() => onColorChange(null)}>Usar color del objetivo</button>
      <small>{color ? 'Color propio para Objetivos y Todo List.' : 'Se usará el color del objetivo padre; sin objetivo, el color por defecto.'}</small>
    </div>}
  </div>;
}
