import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import DocumentPreview from './DocumentPreview.jsx';

export default function ProjectDocuments({ projectId, disabled }) {
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    let active = true;
    api.documents({ repo_id: projectId }).then(rows => {
      if (active) setDocuments(rows);
    }).catch(() => { if (active) setError('No se pudieron cargar los documentos.'); });
    return () => { active = false; };
  }, [projectId]);

  async function uploadFiles(files) {
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        body.append('repo_id', projectId);
        const document = await api.uploadDocument(body);
        setDocuments(previous => [document, ...previous]);
      }
    } catch (_) { setError('No se pudo subir el documento.'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  function drop(event) {
    event.preventDefault();
    setDragging(false);
    if (!disabled && !busy) uploadFiles(Array.from(event.dataTransfer.files || []));
  }

  async function rename(document) {
    const name = prompt('Nombre del documento', document.name)?.trim();
    if (!name || name === document.name) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api.updateDocument(document.id, { name, category_ids: document.category_ids || [] });
      setDocuments(previous => previous.map(item => item.id === document.id ? updated : item));
    } catch (_) { setError('No se pudo cambiar el nombre.'); }
    finally { setBusy(false); }
  }

  async function remove(document) {
    if (!confirm(`¿Eliminar "${document.name}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteDocument(document.id);
      setDocuments(previous => previous.filter(item => item.id !== document.id));
    } catch (_) { setError('No se pudo eliminar el documento.'); }
    finally { setBusy(false); }
  }

  return <div className={`project-documents document-drop-target ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!disabled && !busy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={drop}>
    <div className="project-documents-header">
      <h3>Documentos</h3>
      <input ref={fileInput} type="file" multiple hidden onChange={event => uploadFiles(Array.from(event.target.files || []))} />
      <button className="btn btn-primary btn-sm" type="button" disabled={disabled || busy} onClick={() => fileInput.current?.click()}>{busy ? 'Procesando…' : '+ Subir documentos'}</button>
    </div>
    {error && <p className="project-form-error" role="alert">{error}</p>}
    {dragging && <div className="document-drop-hint">Suelta aquí los documentos</div>}
    {documents.length === 0 ? <p className="project-documents-empty">Este proyecto todavía no tiene documentos.</p> :
      <ul className="project-documents-list">{documents.map(document => <li key={document.id}>
        <span>{document.name}</span>
        <div className="project-document-actions">
          <button className="btn btn-ghost btn-sm" type="button" aria-label={`Visualizar ${document.name}`} title="Visualizar" onClick={() => setPreview(document)}>◉</button>
          <button className="btn btn-ghost btn-sm" type="button" disabled={disabled || busy} aria-label={`Renombrar ${document.name}`} title="Renombrar" onClick={() => rename(document)}>✎</button>
          <button className="btn btn-ghost btn-sm" type="button" disabled={disabled || busy} aria-label={`Eliminar ${document.name}`} title="Eliminar" onClick={() => remove(document)}>🗑</button>
        </div>
      </li>)}</ul>}
    {preview && <DocumentPreview doc={preview} onClose={() => setPreview(null)} />}
  </div>;
}
