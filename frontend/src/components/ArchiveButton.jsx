import { useState } from 'react';
import { api } from '../api.js';

export default function ArchiveButton({ kind, id, onArchived, disabled = false }) {
  const [archiving, setArchiving] = useState(false);

  async function archive() {
    const label = { objective: 'objetivo', milestone: 'hito', repo: 'proyecto' }[kind] || 'elemento';
    if (!window.confirm(`¿Archivar este ${label}?`)) return;
    setArchiving(true);
    try {
      await api.setArchived(kind, id, true);
      onArchived();
    } catch (error) {
      window.alert(error.message || 'No se pudo archivar el elemento.');
    } finally {
      setArchiving(false);
    }
  }

  return <button type="button" className="btn btn-ghost" disabled={disabled || archiving} onClick={archive}>
    {archiving ? 'Archivando…' : 'Archivar'}
  </button>;
}
