import ProjectPhoto from './ProjectPhoto.jsx';
import React from 'react';
import { fmtDate } from '../utils/dateUtils.js';

export default function ProjectDashboard({ project, notebook, statusLabel, onEdit, disabled }) {
  const lists = [...new Set(notebook.notes.map(note => note.list?.trim() || 'Notas generales'))];
  const metrics = [['notes', 'Notas', notebook.notes.length], ['photos', 'Fotos', notebook.photos.length], ['tables', 'Tablas', notebook.tables.length], ['widgets', 'Widgets', notebook.widgets.length]];
  const isEmpty = metrics.every(([, , count]) => count === 0);
  return <div className="project-dashboard">
    <div className="project-overview-meta"><span className={`project-status-chip status-${project.status}`}>{statusLabel}</span><span>{project.target_date ? `Objetivo: ${fmtDate(project.target_date)}` : 'Sin fecha objetivo'}</span><button className="project-text-button" disabled={disabled} onClick={() => onEdit('details')}>Editar detalles</button></div>
    {project.notes && <p className="project-description">{project.notes}</p>}
    <div className="project-dashboard-metrics">
      {metrics.map(([key, label, count]) => <button key={key} type="button" className="project-metric" disabled={disabled} onClick={() => onEdit(key)}><strong>{count}</strong><span>{label}</span><span aria-hidden="true">↗</span></button>)}
    </div>
    {isEmpty && <div className="project-welcome"><h3>Todo empieza con una nota</h3><p>Reúne ideas, fotos y datos. Tu panel crecerá contigo.</p><button className="btn btn-primary" disabled={disabled} onClick={() => onEdit('notes')}>+ Crear mi primera nota</button></div>}
    <div className="project-dashboard-grid">
      <section className="project-dashboard-widget">
        <div className="project-widget-heading"><div><h3>Notas</h3><span className="project-hint">{notebook.notes.length} notas · {lists.length} listas</span></div><button className="project-text-button" disabled={disabled} onClick={() => onEdit('notes')}>{notebook.notes.length ? 'Ver todas →' : '+ Añadir'}</button></div>
        {!lists.length && <p className="project-empty">Ideas, reuniones, pendientes… Guarda lo que necesites recordar.</p>}
        {lists.map(list => <div key={list} className="project-note-group"><h4>{list}</h4>
          {notebook.notes.filter(note => (note.list?.trim() || 'Notas generales') === list).map(note => <details key={note.id} className="project-dashboard-note"><summary><strong>{note.title || 'Nota sin título'}</strong><span>{note.text.slice(0, 100) || 'Sin contenido'}</span></summary><p>{note.text || 'Sin contenido'}</p></details>)}
        </div>)}
      </section>
      <section className="project-dashboard-widget">
        <div className="project-widget-heading"><h3>Fotos</h3><button className="project-text-button" disabled={disabled} onClick={() => onEdit('photos')}>{notebook.photos.length ? 'Ver galería →' : '+ Añadir'}</button></div>
        {!notebook.photos.length && <p className="project-empty">Añade imágenes o capturas como referencia.</p>}
        <div className="project-photo-grid project-gallery-preview">
          {notebook.photos.slice(0, 6).map(photo => <figure key={photo.id}><ProjectPhoto photo={photo} photos={notebook.photos} /><figcaption>{photo.name}</figcaption></figure>)}
        </div>
        {notebook.photos.length > 6 && <button className="project-text-button" disabled={disabled} onClick={() => onEdit('photos')}>Ver las {notebook.photos.length} fotos →</button>}
      </section>
      {notebook.tables.map(table => <section key={table.id} className="project-dashboard-widget project-table-widget">
        <div className="project-widget-heading"><div><h3>{table.name || 'Tabla sin título'}</h3><span className="project-hint">{table.rows.length} filas · {table.columns.length} columnas</span></div><button className="project-text-button" disabled={disabled} onClick={() => onEdit('tables')}>Abrir tabla →</button></div>
        {!table.columns.length ? <p className="project-empty">Añade columnas para organizar los datos.</p> : <div className="project-table-scroll"><table className="project-data-table project-preview-table"><thead><tr>{table.columns.map(column => <th scope="col" key={column.id}>{column.name}</th>)}</tr></thead><tbody>{table.rows.slice(0, 5).map(row => <tr key={row.id}>{table.columns.map(column => <td key={column.id} data-label={column.name}>{column.type === 'checkbox' ? <span className={`project-cell-check ${row.cells[column.id] ? 'is-checked' : ''}`}>{row.cells[column.id] ? '✓ Sí' : 'No'}</span> : column.type === 'date' && row.cells[column.id] ? fmtDate(row.cells[column.id]) : String(row.cells[column.id] ?? '—')}</td>)}</tr>)}</tbody></table>{!table.rows.length && <p className="project-empty">La tabla todavía no tiene filas.</p>}{table.rows.length > 5 && <p className="project-hint">Mostrando 5 de {table.rows.length} filas. Abre la tabla para ver todos los datos.</p>}</div>}
      </section>)}
      {!notebook.tables.length && <section className="project-dashboard-widget"><div className="project-widget-heading"><h3>Tablas</h3><button className="project-text-button" disabled={disabled} onClick={() => onEdit('tables')}>+ Añadir</button></div><p className="project-empty">Inventarios, registros o seguimiento. Tú eliges las columnas.</p></section>}
      {notebook.widgets.map(widget => <section key={widget.id} className="project-dashboard-widget project-custom-widget"><div className="project-widget-heading"><h3>{widget.title || 'Widget sin título'}</h3><button className="project-text-button" disabled={disabled} onClick={() => onEdit('widgets')}>Editar</button></div><p className="project-widget-text">{widget.text || 'Sin contenido'}</p></section>)}
    </div>
  </div>;
}
