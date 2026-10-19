import { resizeProjectPhoto } from '../utils/resizeProjectPhoto.js';
import ProjectPhoto from './ProjectPhoto.jsx';
import PhotoLabelsEditor from './PhotoLabelsEditor.jsx';
import React, { useRef, useState } from 'react';

const CELL_TYPES = [
  ['text', 'Texto'], ['number', 'Número'], ['date', 'Fecha'], ['checkbox', 'Casilla de verificación'],
];
const newId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
  : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

export function parseNotebook(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const empty = { photos: [], notes: [], tables: [], widgets: [] };
    if (value == null) return empty;
    if (typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const parsed = Object.fromEntries(Object.keys(empty).map(key => [key, value[key] ?? []]));
    const validItems = items => Array.isArray(items) && items.every(item => item && typeof item.id === 'string');
    if (!Object.values(parsed).every(validItems)
      || parsed.photos.some(p => typeof p.src !== 'string' || typeof p.name !== 'string'
        || (p.labels !== undefined && (!validItems(p.labels) || p.labels.some(label => typeof label.text !== 'string'
          || ![label.x, label.y].every(position => typeof position === 'number' && Number.isFinite(position) && position >= 0 && position <= 100)))))
      || [...parsed.notes, ...parsed.widgets].some(n => typeof n.title !== 'string' || typeof n.text !== 'string')
      || parsed.notes.some(n => n.list !== undefined && typeof n.list !== 'string')
      || parsed.tables.some(t => typeof t.name !== 'string' || !validItems(t.columns) || !validItems(t.rows)
        || t.columns.some(c => typeof c.name !== 'string' || !CELL_TYPES.some(([type]) => type === c.type))
        || t.rows.some(r => !r.cells || typeof r.cells !== 'object' || Array.isArray(r.cells)))) throw new Error();
    return parsed;
  } catch (_) {
    return { photos: [], notes: [], tables: [], widgets: [], error: 'El contenido guardado no es válido. No se puede sobrescribir; revisa la copia de seguridad.' };
  }
}

function SectionHeading({ title, description, count, action, onAdd }) {
  return <div className="project-section-heading"><div><h3>{title} <span className="project-count">{count}</span></h3><p>{description}</p></div><button type="button" className="btn btn-primary" onClick={onAdd}>+ {action}</button></div>;
}

export default function ProjectNotebook({ value, onChange, disabled, onBusyChange, section = 'notes' }) {
  const [error, setError] = useState('');
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [freshId, setFreshId] = useState(null);
  const [pages, setPages] = useState({});
  const [configured, setConfigured] = useState(() => new Set());
  const fileInput = useRef(null);
  const update = (key, items) => onChange({ ...value, [key]: items });
  const updateTable = (id, transform) => update('tables', value.tables.map(table => table.id === id ? transform(table) : table));
  const focusNewItem = id => { setExpanded(id); setFreshId(id); };
  const toggleConfiguration = id => setConfigured(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  async function addPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError(''); onBusyChange(true);
    try {
      if (value.photos.length + files.length > 100) throw new Error(`El proyecto admite un máximo de 100 fotos. Puedes añadir ${Math.max(0, 100 - value.photos.length)} más.`);
      const photos = [...value.photos];
      // Process sequentially to avoid decoding several large images at once on mobile.
      for (const file of files) {
        const src = await resizeProjectPhoto(file);
        const photo = { id: newId(), name: file.name, src };
        photos.push(photo);
      }
      const next = { ...value, photos };
      onChange(next);
    } catch (err) { setError(err.message); }
    finally { onBusyChange(false); }
  }
  function addNote() {
    const id = newId();
    update('notes', [...value.notes, { id, title: '', text: '', list: '' }]); focusNewItem(id);
  }
  function addTable() {
    const id = newId(), columnId = newId();
    update('tables', [...value.tables, { id, name: '', columns: [{ id: columnId, name: 'Nombre', type: 'text' }], rows: [{ id: newId(), cells: {} }] }]);
    setFreshId(id); setConfigured(previous => new Set([...previous, id]));
  }
  function addWidget() {
    const id = newId();
    update('widgets', [...value.widgets, { id, title: '', text: '' }]); focusNewItem(id);
  }

  return <fieldset disabled={disabled} className="project-notebook">
    {error && <p className="project-form-error" role="alert">{error}</p>}
    {section === 'photos' && <section>
      <SectionHeading title="Fotos" description="Tus imágenes, juntas en un solo lugar. Toca una foto para ampliarla." count={value.photos.length} action="Añadir fotos" onAdd={() => fileInput.current.click()} />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={addPhotos} className="project-hidden-input" />
      {value.photos.some(photo => photo.id === editingPhotoId) && <PhotoLabelsEditor key={editingPhotoId} photo={value.photos.find(photo => photo.id === editingPhotoId)} disabled={disabled} onClose={() => setEditingPhotoId(null)} onChange={photo => update('photos', value.photos.map(item => item.id === photo.id ? photo : item))} />}
      {!value.photos.length && <div className="project-empty-card"><span aria-hidden="true">▧</span><h4>Una imagen ayuda a recordar</h4><p>Añade fotos, capturas o referencias de tu proyecto.</p></div>}
      <div className="project-photo-grid project-photo-editor">
        {value.photos.map(photo => <figure key={photo.id}><ProjectPhoto photo={photo} photos={value.photos} />
          <input aria-label="Descripción de la foto" placeholder="Descripción de la foto" value={photo.name} onChange={e => update('photos', value.photos.map(p => p.id === photo.id ? { ...p, name: e.target.value } : p))} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingPhotoId(photo.id)}>Editar etiquetas</button>
          <button type="button" className="project-text-button project-delete-button" onClick={() => { if (confirm('¿Eliminar esta foto?')) update('photos', value.photos.filter(p => p.id !== photo.id)); }}>Eliminar foto</button>
        </figure>)}
      </div>
      <p className="project-hint">{value.photos.length} / 100 fotos · Sin límite de tamaño del archivo original · Reducción automática a un máximo de 800 KB por foto. Los GIF se guardan como imagen estática.</p>
    </section>}
    {section === 'notes' && <section>
      <SectionHeading title="Notas" description="Guarda ideas y detalles. Puedes agrupar las notas en listas." count={value.notes.length} action="Nueva nota" onAdd={addNote} />
      <datalist id="project-note-lists">{[...new Set(value.notes.map(n => n.list?.trim()).filter(Boolean))].map(list => <option key={list} value={list} />)}</datalist>
      {!value.notes.length && <div className="project-empty-card"><span aria-hidden="true">≡</span><h4>Empieza con una idea</h4><p>Crea tu primera nota. No hace falta rellenarlo todo.</p></div>}
      {value.notes.map(note => <details key={note.id} open={expanded === note.id} className="project-editor-item">
        <summary onClick={e => { e.preventDefault(); setExpanded(expanded === note.id ? null : note.id); }}><div><strong>{note.title || 'Nota sin título'}</strong><span>{note.list?.trim() || 'Notas generales'}{note.text ? ` · ${note.text.slice(0, 90)}` : ''}</span></div><span className="project-expand-mark" aria-hidden="true">{expanded === note.id ? '−' : '+'}</span></summary>
        <div className="project-item-fields">
          <label className="project-field">Título<input autoFocus={freshId === note.id} aria-label="Título de la nota" placeholder="Ponle un título (opcional)" value={note.title} onChange={e => update('notes', value.notes.map(n => n.id === note.id ? { ...n, title: e.target.value } : n))} /></label>
          <label className="project-field">Nota<textarea aria-label="Contenido de la nota" placeholder="Escribe aquí…" rows={5} value={note.text} onChange={e => update('notes', value.notes.map(n => n.id === note.id ? { ...n, text: e.target.value } : n))} /></label>
          <label className="project-field">Lista <span className="project-optional">opcional</span><input aria-label="Lista de notas" placeholder="Por ejemplo: Ideas, Reuniones…" list="project-note-lists" value={note.list || ''} onChange={e => update('notes', value.notes.map(n => n.id === note.id ? { ...n, list: e.target.value } : n))} /></label>
          <button type="button" className="project-text-button project-delete-button" onClick={() => { if (confirm('¿Eliminar esta nota?')) update('notes', value.notes.filter(n => n.id !== note.id)); }}>Eliminar nota</button>
        </div>
      </details>)}
    </section>}
    {section === 'tables' && <section>
      <SectionHeading title="Tablas" description="Organiza datos a tu manera. Define las columnas y añade filas." count={value.tables.length} action="Nueva tabla" onAdd={addTable} />
      {!value.tables.length && <div className="project-empty-card"><span aria-hidden="true">▦</span><h4>Ordena tus datos</h4><p>Crea una tabla para inventarios, seguimiento o cualquier otra información.</p></div>}
      {value.tables.map(table => {
        const pageCount = Math.max(1, Math.ceil(table.rows.length / 10));
        const page = Math.min(pages[table.id] || 0, pageCount - 1);
        return <div key={table.id} className="project-table-editor">
        <div className="project-table-heading"><label className="project-field">Nombre de la tabla<input autoFocus={freshId === table.id} aria-label="Nombre de la tabla" placeholder="Por ejemplo: Inventario" value={table.name} onChange={e => updateTable(table.id, t => ({ ...t, name: e.target.value }))} /></label><span className="project-hint">{table.rows.length} filas</span></div>
        {pageCount > 1 && <nav className="project-table-pagination" aria-label={`Páginas de ${table.name || 'la tabla'}`}>
          <button type="button" className="project-icon-button" aria-label="Página anterior" disabled={page === 0} onClick={() => setPages(previous => ({ ...previous, [table.id]: page - 1 }))}>‹</button>
          <label>Página <select aria-label={`Página de ${table.name || 'la tabla'}`} value={page} onChange={e => setPages(previous => ({ ...previous, [table.id]: Number(e.target.value) }))}>{Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1} de {pageCount}</option>)}</select></label>
          <button type="button" className="project-icon-button" aria-label="Página siguiente" disabled={page === pageCount - 1} onClick={() => setPages(previous => ({ ...previous, [table.id]: page + 1 }))}>›</button>
        </nav>}
        <details className="project-table-config" open={configured.has(table.id) || !table.columns.length || table.columns.some(column => !column.name.trim())}>
          <summary onClick={e => { e.preventDefault(); toggleConfiguration(table.id); }}>Configurar columnas <span>{table.columns.length} columnas</span></summary>
          <div className="project-column-list">
            {table.columns.map(column => <div key={column.id} className="project-column-config">
              <label className="project-field">Cabecera<input aria-label="Nombre de la cabecera" placeholder="Nombre de la columna" value={column.name} onChange={e => updateTable(table.id, t => ({ ...t, columns: t.columns.map(c => c.id === column.id ? { ...c, name: e.target.value } : c) }))} /></label>
              <label className="project-field">Tipo<select aria-label="Tipo de celda" value={column.type} onChange={e => {
                const nextType = e.target.value;
                if (table.rows.some(row => row.cells[column.id] !== undefined && row.cells[column.id] !== '' && row.cells[column.id] !== false) && !confirm('¿Cambiar el tipo de esta columna y vaciar sus celdas?')) { e.target.value = column.type; return; }
                updateTable(table.id, t => ({ ...t, columns: t.columns.map(c => c.id === column.id ? { ...c, type: nextType } : c), rows: t.rows.map(row => ({ ...row, cells: { ...row.cells, [column.id]: nextType === 'checkbox' ? false : '' } })) }));
              }}>{CELL_TYPES.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
              <button type="button" className="project-icon-button project-delete-button" aria-label={`Eliminar columna ${column.name}`} onClick={() => {
                if (!confirm('¿Eliminar esta columna y sus datos?')) return;
                updateTable(table.id, t => ({ ...t, columns: t.columns.filter(c => c.id !== column.id), rows: t.rows.map(row => ({ ...row, cells: Object.fromEntries(Object.entries(row.cells).filter(([key]) => key !== column.id)) })) }));
              }}>✕</button>
            </div>)}
            <button type="button" className="btn btn-ghost" onClick={() => updateTable(table.id, t => ({ ...t, columns: [...t.columns, { id: newId(), name: `Columna ${t.columns.length + 1}`, type: 'text' }] }))}>+ Añadir columna</button>
            <p className="project-hint">Al cambiar el tipo de una columna se vacían sus celdas.</p>
          </div>
        </details>
        {table.columns.length > 0 ? <div className="project-table-scroll">
          <table className="project-data-table project-editable-table"><thead><tr>{table.columns.map(c => <th scope="col" key={c.id}>{c.name}</th>)}<th scope="col">Acciones</th></tr></thead>
            <tbody>{table.rows.slice(page * 10, page * 10 + 10).map((row, localIndex) => { const index = page * 10 + localIndex; return <tr key={row.id}>
              {table.columns.map((column, columnIndex) => <td key={column.id} data-label={column.name}><label className="project-cell-input"><input autoFocus={freshId === row.id && columnIndex === 0} aria-label={`${column.name}, fila ${index + 1}`} type={column.type} step={column.type === 'number' ? 'any' : undefined}
                {...(column.type === 'checkbox' ? { checked: !!row.cells[column.id] } : { value: row.cells[column.id] ?? '' })}
                onChange={e => {
                  const cell = column.type === 'checkbox' ? e.target.checked : column.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value;
                  updateTable(table.id, t => ({ ...t, rows: t.rows.map(r => r.id === row.id ? { ...r, cells: { ...r.cells, [column.id]: cell } } : r) }));
                }} /></label></td>)}
              <td className="project-row-action" data-label={`Fila ${index + 1}`}><button type="button" className="project-text-button project-delete-button" aria-label={`Eliminar fila ${index + 1}`} onClick={() => { if (Object.values(row.cells).some(cell => cell !== '' && cell !== false) && !confirm('¿Eliminar esta fila y sus datos?')) return; updateTable(table.id, t => ({ ...t, rows: t.rows.filter(r => r.id !== row.id) })); }}>Eliminar fila</button></td>
            </tr>; })}</tbody>
          </table>
          {!table.rows.length && <p className="project-empty">Sin filas. Añade la primera para empezar.</p>}
        </div> : <p className="project-empty">Añade una columna para empezar.</p>}
        <div className="project-table-actions"><button type="button" className="btn btn-ghost" disabled={!table.columns.length} onClick={() => { const id = newId(); setFreshId(id); setPages(previous => ({ ...previous, [table.id]: Math.floor(table.rows.length / 10) })); updateTable(table.id, t => ({ ...t, rows: [...t.rows, { id, cells: {} }] })); }}>+ Añadir fila</button><button type="button" className="project-text-button project-delete-button" onClick={() => { if (confirm('¿Eliminar esta tabla y sus datos?')) update('tables', value.tables.filter(t => t.id !== table.id)); }}>Eliminar tabla</button></div>
      </div>; })}
    </section>}
    {section === 'widgets' && <section>
      <SectionHeading title="Widgets" description="Pequeños recordatorios y resúmenes para tu panel." count={value.widgets.length} action="Nuevo widget" onAdd={addWidget} />
      {!value.widgets.length && <div className="project-empty-card"><span aria-hidden="true">◇</span><h4>Lo importante, a mano</h4><p>Añade un recordatorio o un resumen que quieras ver siempre en el panel.</p></div>}
      {value.widgets.map(widget => <details key={widget.id} className="project-editor-item" open={expanded === widget.id}>
        <summary onClick={e => { e.preventDefault(); setExpanded(expanded === widget.id ? null : widget.id); }}><div><strong>{widget.title || 'Widget sin título'}</strong><span>{widget.text.slice(0, 90) || 'Añade un recordatorio o un resumen'}</span></div><span className="project-expand-mark" aria-hidden="true">{expanded === widget.id ? '−' : '+'}</span></summary>
        <div className="project-item-fields"><label className="project-field">Título<input autoFocus={freshId === widget.id} aria-label="Título del widget" placeholder="Por ejemplo: Próximos pasos" value={widget.title} onChange={e => update('widgets', value.widgets.map(w => w.id === widget.id ? { ...w, title: e.target.value } : w))} /></label>
          <label className="project-field">Contenido<textarea aria-label="Contenido del widget" placeholder="¿Qué quieres tener a mano?" rows={4} value={widget.text} onChange={e => update('widgets', value.widgets.map(w => w.id === widget.id ? { ...w, text: e.target.value } : w))} /></label>
          <button type="button" className="project-text-button project-delete-button" onClick={() => { if (confirm('¿Eliminar este widget?')) update('widgets', value.widgets.filter(w => w.id !== widget.id)); }}>Eliminar widget</button>
        </div>
      </details>)}
    </section>}
  </fieldset>;
}
