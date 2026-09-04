import React from 'react';

export default function StatusFilter({ value, onChange }) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} aria-label="Filtrar por estado">
      <option value="active">Activos</option>
      <option value="all">Todos</option>
      <option value="discarded">Descartado</option>
    </select>
  );
}
