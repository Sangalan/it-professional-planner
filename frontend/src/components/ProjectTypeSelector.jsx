import React, { useRef } from 'react';

export default function ProjectTypeSelector({ value, onChange, defaultGitType = 'personal' }) {
  const gitType = useRef(value === 'notes' ? defaultGitType : value || defaultGitType);
  if (value && value !== 'notes') gitType.current = value;
  return <div className="project-type-selector">
    <label className="project-field">Tipo de proyecto
      <select aria-label="Tipo de proyecto" value={value === 'notes' ? 'notes' : 'git'} onChange={event => onChange(event.target.value === 'notes' ? 'notes' : gitType.current)}>
        <option value="git">Proyecto Git</option>
        <option value="notes">Proyecto con notas</option>
      </select>
    </label>
    <p className="project-hint">{value === 'notes' ? 'Notas, fotos, tablas y widgets en un panel.' : 'Proyecto regular con enlace a su repositorio Git.'}</p>
    {value !== 'notes' && <label className="project-field">Ámbito del proyecto
      <select aria-label="Ámbito del proyecto" value={value || defaultGitType} onChange={event => onChange(event.target.value)}>
        <option value="personal">Personal</option>
        <option value="client">Cliente</option>
        <option value="sangalan">Sangalan</option>
      </select>
    </label>}
  </div>;
}
