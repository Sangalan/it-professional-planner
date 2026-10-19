import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import './NotepadView.css';

const SAVE_DELAY = 1200;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function noteParts(content) {
  const marker = /!\[Imagen\]\(\/api\/notepad\/images\/([A-Za-z0-9-]+)\)|\[\[subiendo-imagen:([a-f0-9-]{36})\]\]/g;
  const parts = [];
  let start = 0;
  for (const match of content.matchAll(marker)) {
    if (match.index > start) parts.push({ type: 'text', value: content.slice(start, match.index) });
    parts.push(match[1] ? { type: 'image', value: match[1] } : { type: 'upload', value: match[2] });
    start = match.index + match[0].length;
  }
  if (start < content.length) parts.push({ type: 'text', value: content.slice(start) });
  return parts;
}

function expiryDate(deletedAt) {
  const deleted = new Date(`${deletedAt.replace(' ', 'T')}Z`);
  deleted.setUTCDate(deleted.getUTCDate() + 30);
  return deleted.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function NotepadView() {
  const clientId = useRef(crypto.randomUUID()).current;
  const [tabs, setTabs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [editingTabId, setEditingTabId] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashTabs, setTrashTabs] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashActionId, setTrashActionId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadCounts, setUploadCounts] = useState({});
  const tabsRef = useRef([]);
  const baseRevisions = useRef(new Map());
  const dirtyIds = useRef(new Set());
  const savingIds = useRef(new Set());
  const timers = useRef(new Map());
  const saveRequests = useRef(new Map());
  const pendingUploads = useRef(new Map());
  const uploadTasks = useRef(new Map());
  const conflicts = useRef(new Map());
  const refreshAfterSave = useRef(false);
  const refreshNumber = useRef(0);
  const mounted = useRef(true);
  const trashOpenRef = useRef(false);
  const trashRefreshNumber = useRef(0);
  const tabNameInput = useRef(null);
  const originalTabName = useRef('');

  useEffect(() => {
    if (editingTabId && tabNameInput.current) {
      tabNameInput.current.focus();
      tabNameInput.current.select();
    }
  }, [editingTabId]);

  function publish(next) {
    tabsRef.current = next;
    if (mounted.current) setTabs(next);
  }

  function status(id, value) {
    if (mounted.current) setStatuses(previous => ({ ...previous, [id]: value }));
  }

  function queueSave(id) {
    clearTimeout(timers.current.get(id));
    if (pendingUploads.current.get(id)?.size) return;
    if (conflicts.current.has(id)) return;
    timers.current.set(id, setTimeout(() => {
      timers.current.delete(id);
      save(id);
    }, SAVE_DELAY));
  }

  async function save(id) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    if (!dirtyIds.current.has(id) || savingIds.current.has(id) || conflicts.current.has(id)
      || pendingUploads.current.get(id)?.size) return false;
    const draft = tabsRef.current.find(tab => tab.id === id);
    if (!draft) return;
    const snapshot = { title: draft.title.trim() || 'Nueva pestaña', content: draft.content };
    savingIds.current.add(id);
    status(id, 'saving');
    let didSave = false;
    try {
      const request = api.updateNotepadTab(id, {
        ...snapshot, revision: baseRevisions.current.get(id), client_id: clientId,
      });
      saveRequests.current.set(id, request);
      const saved = await request;
      baseRevisions.current.set(id, saved.revision);
      didSave = true;
      const current = tabsRef.current.find(tab => tab.id === id);
      if (current && (current.title.trim() || 'Nueva pestaña') === snapshot.title && current.content === snapshot.content) {
        dirtyIds.current.delete(id);
        publish(tabsRef.current.map(tab => tab.id === id ? saved : tab));
        status(id, 'saved');
      } else if (current) {
        status(id, 'pending');
      }
    } catch (failure) {
      if (failure.status === 409 || failure.status === 404) {
        conflicts.current.set(id, failure.data?.current || null);
        status(id, 'conflict');
      } else {
        status(id, 'error');
      }
    } finally {
      saveRequests.current.delete(id);
      savingIds.current.delete(id);
      if (didSave && dirtyIds.current.has(id) && !conflicts.current.has(id)) {
        if (mounted.current) queueSave(id);
        else save(id);
      }
      if (refreshAfterSave.current && mounted.current) {
        refreshAfterSave.current = false;
        refresh();
      }
    }
    return didSave;
  }

  async function flushTab(id) {
    while (pendingUploads.current.get(id)?.size || dirtyIds.current.has(id) || savingIds.current.has(id)) {
      const pending = pendingUploads.current.get(id);
      if (pending?.size) {
        await Promise.allSettled([...pending].map(marker => uploadTasks.current.get(marker)).filter(Boolean));
        continue;
      }
      if (savingIds.current.has(id)) {
        try { await saveRequests.current.get(id); } catch (_) {}
      } else if (!await save(id)) {
        return false;
      }
      if (conflicts.current.has(id)) return false;
    }
    return true;
  }

  async function refreshTrash() {
    const requestNumber = ++trashRefreshNumber.current;
    setTrashLoading(true);
    try {
      const remote = await api.notepadTrash();
      if (!mounted.current || requestNumber !== trashRefreshNumber.current) return;
      setTrashTabs(remote);
      setError('');
    } catch (_) {
      if (mounted.current) setError('No se pudo cargar la papelera.');
    } finally {
      if (mounted.current && requestNumber === trashRefreshNumber.current) setTrashLoading(false);
    }
  }

  function toggleTrash() {
    trashOpenRef.current = !trashOpenRef.current;
    setTrashOpen(trashOpenRef.current);
    if (trashOpenRef.current) refreshTrash();
  }

  async function refresh() {
    const requestNumber = ++refreshNumber.current;
    try {
      const remote = await api.notepadTabs();
      if (!mounted.current || requestNumber !== refreshNumber.current) return;
      const remoteIds = new Set(remote.map(tab => tab.id));
      const local = new Map(tabsRef.current.map(tab => [tab.id, tab]));
      const next = remote.map(tab => {
        if (tab.revision < (baseRevisions.current.get(tab.id) || 0)) return local.get(tab.id) || tab;
        if (dirtyIds.current.has(tab.id) || savingIds.current.has(tab.id)) {
          if (tab.revision !== baseRevisions.current.get(tab.id) && !savingIds.current.has(tab.id)) {
            conflicts.current.set(tab.id, tab);
            clearTimeout(timers.current.get(tab.id));
            status(tab.id, 'conflict');
          } else if (tab.revision !== baseRevisions.current.get(tab.id)) {
            refreshAfterSave.current = true;
          }
          return local.get(tab.id) || tab;
        }
        baseRevisions.current.set(tab.id, tab.revision);
        return tab;
      });
      for (const tab of tabsRef.current) {
        if (!remoteIds.has(tab.id) && dirtyIds.current.has(tab.id)) {
          if (savingIds.current.has(tab.id)) refreshAfterSave.current = true;
          else {
            conflicts.current.set(tab.id, null);
            status(tab.id, 'conflict');
          }
          next.push(tab);
        }
      }
      publish(next);
      setActiveId(previous => next.some(tab => tab.id === previous) ? previous : next[0]?.id || null);
      setError('');
    } catch (_) {
      if (mounted.current) setError('No se pudo cargar el bloc de notas.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    refresh();
    const events = new EventSource(api.notepadEventsUrl());
    events.onopen = refresh;
    events.addEventListener('change', event => {
      try {
        if (JSON.parse(event.data).client_id === clientId) return;
      } catch (_) {}
      refresh();
      if (trashOpenRef.current) refreshTrash();
    });
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        for (const id of dirtyIds.current) save(id);
      }
    };
    document.addEventListener('visibilitychange', flush);
    return () => {
      mounted.current = false;
      events.close();
      document.removeEventListener('visibilitychange', flush);
      for (const id of dirtyIds.current) save(id);
    };
  }, []);

  function edit(id, field, value) {
    publish(tabsRef.current.map(tab => tab.id === id ? { ...tab, [field]: value } : tab));
    dirtyIds.current.add(id);
    if (!conflicts.current.has(id)) {
      status(id, 'pending');
      queueSave(id);
    }
  }

  async function uploadImage(tabId, file, marker) {
    try {
      const encoded = await fileAsBase64(file);
      const image = await api.uploadNotepadImage(tabId, file.type, encoded);
      const current = tabsRef.current.find(tab => tab.id === tabId);
      if (current?.content.includes(marker)) {
        edit(tabId, 'content', current.content.replace(marker, `![Imagen](/api/notepad/images/${image.id})`));
      }
    } catch (_) {
      const current = tabsRef.current.find(tab => tab.id === tabId);
      if (current?.content.includes(marker)) edit(tabId, 'content', current.content.replace(marker, ''));
      if (mounted.current) setError('No se pudo pegar la imagen.');
    } finally {
      pendingUploads.current.get(tabId)?.delete(marker);
      uploadTasks.current.delete(marker);
      if (!pendingUploads.current.get(tabId)?.size) pendingUploads.current.delete(tabId);
      if (mounted.current) setUploadCounts(previous => ({ ...previous, [tabId]: Math.max(0, (previous[tabId] || 1) - 1) }));
      if (dirtyIds.current.has(tabId) && !pendingUploads.current.has(tabId)) {
        if (mounted.current) queueSave(tabId);
        else save(tabId);
      }
    }
  }

  function pasteImages(event) {
    const files = [...event.clipboardData.items]
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile()).filter(Boolean);
    if (!files.length) return;
    event.preventDefault();
    const accepted = files.filter(file => IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_SIZE);
    if (accepted.length !== files.length) setError('Solo se admiten imágenes PNG, JPEG, GIF o WebP de hasta 10 MB.');
    if (!accepted.length) return;
    const tabId = activeId;
    const textarea = event.currentTarget;
    const current = tabsRef.current.find(tab => tab.id === tabId);
    if (!current) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const markers = accepted.map(() => `[[subiendo-imagen:${crypto.randomUUID()}]]`);
    const pending = pendingUploads.current.get(tabId) || new Set();
    markers.forEach(marker => pending.add(marker));
    pendingUploads.current.set(tabId, pending);
    setUploadCounts(previous => ({ ...previous, [tabId]: (previous[tabId] || 0) + accepted.length }));
    const before = current.content.slice(0, start);
    const after = current.content.slice(end);
    const inserted = `${before && !before.endsWith('\n') ? '\n' : ''}${markers.join('\n')}${after && !after.startsWith('\n') ? '\n' : ''}`;
    edit(tabId, 'content', before + inserted + after);
    requestAnimationFrame(() => {
      if (textarea.isConnected) textarea.setSelectionRange(start + inserted.length, start + inserted.length);
    });
    accepted.forEach((file, index) => {
      const task = uploadImage(tabId, file, markers[index]);
      uploadTasks.current.set(markers[index], task);
    });
  }

  async function addTab() {
    try {
      const tab = await api.createNotepadTab(clientId);
      refreshNumber.current += 1;
      if (tabsRef.current.some(existing => existing.id === tab.id)) {
        publish(tabsRef.current.map(existing => existing.id === tab.id ? tab : existing));
      } else {
        publish([...tabsRef.current, tab]);
      }
      baseRevisions.current.set(tab.id, tab.revision);
      setActiveId(tab.id);
      setError('');
    } catch (_) {
      setError('No se pudo crear la pestaña.');
    }
  }

  async function deleteTab(id) {
    setDeletingId(id);
    try {
      if (!await flushTab(id)) {
        setError('No se pudo guardar la pestaña antes de moverla a la papelera.');
        return;
      }
      await api.deleteNotepadTab(id, clientId);
      refreshNumber.current += 1;
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      dirtyIds.current.delete(id);
      conflicts.current.delete(id);
      baseRevisions.current.delete(id);
      const next = tabsRef.current.filter(tab => tab.id !== id);
      publish(next);
      if (editingTabId === id) setEditingTabId(null);
      setActiveId(previous => previous === id ? next[0]?.id || null : previous);
      setError('');
    } catch (_) {
      setError('No se pudo mover la pestaña a la papelera.');
    } finally {
      setDeletingId(null);
    }
  }

  async function restoreTab(id) {
    setTrashActionId(id);
    try {
      const restored = await api.restoreNotepadTab(id, clientId);
      setTrashTabs(previous => previous.filter(tab => tab.id !== id));
      await refresh();
      setActiveId(restored.id);
      trashOpenRef.current = false;
      setTrashOpen(false);
      setError('');
    } catch (_) {
      setError('No se pudo recuperar la pestaña.');
    } finally {
      setTrashActionId(null);
    }
  }

  function resolveConflict(id, keepLocal) {
    const remote = conflicts.current.get(id);
    conflicts.current.delete(id);
    if (!remote) {
      const next = tabsRef.current.filter(tab => tab.id !== id);
      publish(next);
      dirtyIds.current.delete(id);
      setActiveId(next[0]?.id || null);
      return;
    }
    baseRevisions.current.set(id, remote.revision);
    if (keepLocal) {
      status(id, 'pending');
      queueSave(id);
    } else {
      dirtyIds.current.delete(id);
      publish(tabsRef.current.map(tab => tab.id === id ? remote : tab));
      status(id, 'saved');
    }
  }

  const active = tabs.find(tab => tab.id === activeId);
  const activeStatus = statuses[activeId];
  const parts = active ? noteParts(active.content) : [];
  const hasImages = parts.some(part => part.type !== 'text');

  return (
    <div className="notepad-page">
      <div className="page-header">
        <div>
          <div className="notepad-heading">
            <h1 className="page-title">Bloc de notas</h1>
            <button type="button" className={`notepad-trash-toggle${trashOpen ? ' active' : ''}`}
              onClick={toggleTrash} title={trashOpen ? 'Volver al bloc' : 'Papelera'}
              aria-label={trashOpen ? 'Volver al bloc' : 'Abrir papelera'} aria-pressed={trashOpen}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {error && <p className="notepad-error" role="alert">{error}</p>}
      {trashOpen ? <div className="notepad-trash">
        <h2>Papelera</h2>
        <p>Las pestañas se eliminan definitivamente después de 30 días.</p>
        {trashLoading ? <p className="notepad-message">Cargando papelera…</p>
          : trashTabs.length ? <ul className="notepad-trash-list">
            {trashTabs.map(tab => <li key={tab.id}>
              <div><strong>{tab.title}</strong><span>Disponible hasta el {expiryDate(tab.deleted_at)}</span></div>
              <button type="button" disabled={trashActionId === tab.id} onClick={() => restoreTab(tab.id)}>Recuperar</button>
            </li>)}
          </ul> : <p className="notepad-trash-empty">La papelera está vacía.</p>}
      </div> : loading ? <p className="notepad-message">Cargando notas…</p> : <div className="notepad-shell">
        <div className="notepad-tabs" role="tablist" aria-label="Pestañas del bloc">
          {tabs.map(tab => <div key={tab.id} className="notepad-tab-wrap" role="presentation">
            {editingTabId === tab.id
            ? <input ref={tabNameInput} className="notepad-tab-name-input"
                aria-label="Editar nombre de la pestaña" maxLength={120} value={tab.title}
                onChange={event => edit(tab.id, 'title', event.target.value)}
                onBlur={() => { setEditingTabId(null); save(tab.id); }}
                onKeyDown={event => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    edit(tab.id, 'title', originalTabName.current);
                    event.currentTarget.blur();
                  }
                }} />
            : <button key={tab.id} type="button" role="tab"
                aria-selected={tab.id === activeId} className={`notepad-tab${tab.id === activeId ? ' active' : ''}`}
                onClick={() => { if (activeId) save(activeId); setActiveId(tab.id); }}
                onDoubleClick={() => {
                  originalTabName.current = tab.title;
                  setEditingTabId(tab.id);
                }}>
                <span>{tab.title.trim() || 'Nueva pestaña'}</span>
                {statuses[tab.id] === 'conflict' && <span className="notepad-tab-alert" aria-label="Conflicto">!</span>}
              </button>}
            <button type="button" className="notepad-tab-close" disabled={deletingId === tab.id}
              aria-label={`Mover ${tab.title.trim() || 'Nueva pestaña'} a la papelera`}
              title="Mover a la papelera" onClick={() => deleteTab(tab.id)}>×</button>
          </div>)}
          <button type="button" className="notepad-add" onClick={addTab}>+ Nueva pestaña</button>
        </div>
        {active ? <div className={`notepad-editor${hasImages ? ' has-images' : ''}`} role="tabpanel">
          <div className="notepad-save-state" role="status">
            {uploadCounts[active.id]
              ? `Subiendo ${uploadCounts[active.id]} ${uploadCounts[active.id] === 1 ? 'imagen' : 'imágenes'}…`
              : activeStatus === 'pending' ? 'Cambios pendientes…'
                : activeStatus === 'saving' ? 'Guardando…'
                  : activeStatus === 'saved' ? 'Guardado'
                    : activeStatus === 'error' ? <span>No se pudo guardar. <button type="button" onClick={() => save(active.id)}>Reintentar</button></span>
                      : null}
          </div>
          {activeStatus === 'conflict' && <div className="notepad-conflict" role="alert">
            {conflicts.current.get(active.id)
              ? <><span>Esta pestaña cambió en otra ventana. Elige qué versión conservar.</span>
                <button type="button" onClick={() => resolveConflict(active.id, true)}>Conservar mis cambios</button>
                <button type="button" onClick={() => resolveConflict(active.id, false)}>Cargar la otra versión</button></>
              : <><span>Esta pestaña se movió a la papelera en otra ventana. Copia tus cambios antes de cerrarla.</span>
                <button type="button" onClick={() => resolveConflict(active.id, false)}>Cerrar pestaña</button></>}
          </div>}
          <textarea aria-label="Contenido de la pestaña" placeholder="Escribe o pega aquí tus notas e imágenes…"
            value={active.content} onChange={event => edit(active.id, 'content', event.target.value)}
            onPaste={pasteImages} onBlur={() => save(active.id)} />
          {hasImages && <div className="notepad-preview">
            <strong>Vista con imágenes</strong>
            <div className="notepad-preview-content">
              {parts.map((part, index) => part.type === 'image'
                ? <img key={index} src={api.notepadImageUrl(part.value)} alt="Imagen pegada" loading="lazy" />
                : part.type === 'upload'
                  ? <span key={index} className="notepad-image-loading">Subiendo imagen…</span>
                  : <span key={index} className="notepad-preview-text">{part.value}</span>)}
            </div>
          </div>}
        </div> : <div className="notepad-empty">
          <strong>Tu bloc está vacío</strong>
          <p>Crea una pestaña para empezar a escribir.</p>
          <button type="button" onClick={addTab}>+ Nueva pestaña</button>
        </div>}
      </div>}
    </div>
  );
}
