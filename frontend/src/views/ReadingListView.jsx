import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import CatBadge, { CategoryOption, useCats } from '../components/CatBadge.jsx';

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const fieldW = { marginBottom: 14 };

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function parseUrls(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (_) {}
  }
  if (typeof raw === 'string' && raw.length) return [raw];
  return [];
}

function daysAgo(createdAt) {
  if (!createdAt) return 0;
  const now = new Date();
  const created = new Date(createdAt);
  return Math.floor((now - created) / 86400000);
}

function CategorySelector({ selected, onChange }) {
  const cats = useCats();
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {cats.map(cat => {
        const active = selected.includes(cat.id);
        return <CategoryOption key={cat.id} cat={cat} active={active} onClick={() => toggle(cat.id)} />;
      })}
    </div>
  );
}

function UrlListEditor({ urls, onChange }) {
  function update(i, val) {
    const next = [...urls];
    next[i] = val;
    onChange(next);
  }
  function add() { onChange([...urls, '']); }
  function remove(i) { onChange(urls.filter((_, idx) => idx !== i)); }
  return (
    <div>
      {urls.map((u, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input type="url" value={u} onChange={e => update(i, e.target.value)}
            placeholder="https://..."
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} />
          <button onClick={() => remove(i)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '0 8px', color: 'var(--text-3)' }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', color: 'var(--accent)' }}>+ Añadir URL</button>
    </div>
  );
}

function ItemDialog({ item, onClose, onSaved, onDeleted }) {
  const initCatIds = parseCatIds(item?.category_ids, item?.category_id);
  const [form, setForm] = useState({
    title: item?.title || '',
    notes: item?.notes || '',
  });
  const [catIds, setCatIds] = useState(initCatIds);
  const [urls, setUrls] = useState(parseUrls(item?.urls));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isNew = !item;

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title,
      notes: form.notes || null,
      urls: urls.filter(u => u.trim()),
      category_ids: catIds,
      category_id: catIds[0] || null,
    };
    if (isNew) {
      await api.createReadingItem(payload);
    } else {
      await api.updateReadingItem(item.id, payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  async function del() {
    if (!confirm('¿Eliminar este elemento?')) return;
    setDeleting(true);
    await api.deleteReadingItem(item.id);
    setDeleting(false);
    onDeleted();
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 28,
        maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>📚 {isNew ? 'Nuevo elemento' : 'Editar elemento'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Título</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="Título del artículo, recurso..."
            style={{ width: '100%' }} autoFocus />
        </div>

        <div style={fieldW}>
          <label style={labelSt}>URLs</label>
          <UrlListEditor urls={urls} onChange={setUrls} />
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Categorías</label>
          <CategorySelector selected={catIds} onChange={setCatIds} />
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Notas</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!isNew ? (
            <button className="btn btn-ghost" onClick={del} disabled={deleting}
              style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingList({ items, onToggle, onEdit, onReorder }) {
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  function handleDragStart(e, i) {
    dragItem.current = i;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnter(e, i) {
    dragOver.current = i;
    e.preventDefault();
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    const from = dragItem.current;
    const to = dragOver.current;
    if (from === null || to === null || from === to) return;
    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    dragItem.current = null;
    dragOver.current = null;
    onReorder(reordered.map(it => it.id));
  }

  return (
    <div>
      {items.map((item, i) => {
        const ago = daysAgo(item.created_at);
        const urgencyBg = ago > 14 ? '#fee2e2' : ago > 7 ? '#fef9c3' : 'transparent';
        const urgencyBorder = ago > 14 ? '#fca5a5' : ago > 7 ? '#fde68a' : 'var(--border-subtle, transparent)';
        const catIds = parseCatIds(item.category_ids, item.category_id);
        const urls = parseUrls(item.urls);
        return (
          <div key={item.id}
            draggable
            onDragStart={e => handleDragStart(e, i)}
            onDragEnter={e => handleDragEnter(e, i)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="task-row"
            style={{
              background: urgencyBg,
              border: ago > 7 ? `1px solid ${urgencyBorder}` : 'none',
              borderRadius: ago > 7 ? 6 : 0,
              margin: ago > 7 ? '2px 0' : 0,
              cursor: 'grab',
              alignItems: 'flex-start',
              paddingTop: 10,
              paddingBottom: 10,
            }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
              <input type="checkbox" checked={false}
                onChange={() => onToggle(item)}
                style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
                onClick={e => e.stopPropagation()} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer', marginBottom: 3 }}
                  onClick={() => onEdit(item)}>
                  {item.title}
                </div>
                {urls.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    {urls.map((u, idx) => (
                      <a key={idx} href={u} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        ↗ {u.replace(/^https?:\/\//, '')}
                      </a>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.notes}
                  </div>
                )}
                {catIds.length > 0 && (
                  <div className="task-meta">
                    {catIds.map(cid => <CatBadge key={cid} id={cid} />)}
                  </div>
                )}
              </div>
            </div>
            <span style={{ fontSize: 11, color: ago > 14 ? '#dc2626' : ago > 7 ? '#92400e' : 'var(--text-3)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 3 }}>
              {ago === 0 ? 'Hoy' : `hace ${ago}d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReadList({ items, onToggle, onEdit }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: open ? 8 : 0 }}
        onClick={() => setOpen(p => !p)}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
          {open ? '▾' : '▸'} Leído ({items.length})
        </span>
      </div>
      {open && (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {items.length === 0 ? (
              <div style={{ padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>Sin elementos leídos</div>
            ) : items.map(item => {
              const catIds = parseCatIds(item.category_ids, item.category_id);
              const urls = parseUrls(item.urls);
              return (
                <div key={item.id} className="task-row" style={{ alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10, opacity: 0.7 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={true}
                      onChange={() => onToggle(item)}
                      style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
                      onClick={e => e.stopPropagation()} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer', textDecoration: 'line-through', color: 'var(--text-3)', marginBottom: 3 }}
                        onClick={() => onEdit(item)}>
                        {item.title}
                      </div>
                      {urls.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                          {urls.map((u, idx) => (
                            <a key={idx} href={u} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                              ↗ {u.replace(/^https?:\/\//, '')}
                            </a>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.notes}
                        </div>
                      )}
                      {catIds.length > 0 && (
                        <div className="task-meta">
                          {catIds.map(cid => <CatBadge key={cid} id={cid} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBar({ search, onSearch, filterCats, onFilterCats }) {
  const cats = useCats();
  function toggleCat(id) {
    onFilterCats(filterCats.includes(id) ? filterCats.filter(c => c !== id) : [...filterCats, id]);
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <input
        type="text"
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder="Buscar por título o notas…"
        style={{ width: '100%', marginBottom: 10, fontSize: 13 }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {cats.map(cat => {
          const active = filterCats.includes(cat.id);
          return (
            <span key={cat.id} onClick={() => toggleCat(cat.id)} style={{
              cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 10,
              background: active ? cat.color + '33' : 'var(--bg)',
              color: active ? cat.color : 'var(--text-3)',
              border: `1px solid ${active ? cat.color : 'var(--border)'}`,
              fontWeight: active ? 600 : 400,
              userSelect: 'none',
            }}>
              {cat.name}
            </span>
          );
        })}
        {(search || filterCats.length > 0) && (
          <span onClick={() => { onSearch(''); onFilterCats([]); }} style={{
            cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 10,
            background: 'var(--bg)', color: 'var(--text-3)',
            border: '1px solid var(--border)', userSelect: 'none',
          }}>
            ✕ Limpiar
          </span>
        )}
      </div>
    </div>
  );
}

function applyFilters(items, search, filterCats) {
  let out = items;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    out = out.filter(it =>
      it.title.toLowerCase().includes(q) ||
      (it.notes && it.notes.toLowerCase().includes(q))
    );
  }
  if (filterCats.length > 0) {
    out = out.filter(it => {
      const ids = parseCatIds(it.category_ids, it.category_id);
      return filterCats.some(fc => ids.includes(fc));
    });
  }
  return out;
}

export default function ReadingListView() {
  const [items, setItems] = useState([]);
  const [dialog, setDialog] = useState(null); // null | 'new' | item object
  const [search, setSearch] = useState('');
  const [filterCats, setFilterCats] = useState([]);

  async function load() {
    api.readingList().then(setItems);
  }

  useEffect(() => { load(); }, []);

  async function toggleStatus(item) {
    const newStatus = item.status === 'pending' ? 'read' : 'pending';
    await api.updateReadingItem(item.id, { status: newStatus });
    load();
  }

  async function reorder(ids) {
    // Optimistic update
    const idxMap = Object.fromEntries(ids.map((id, i) => [id, i]));
    setItems(prev => {
      const pending = prev.filter(it => it.status === 'pending');
      const read = prev.filter(it => it.status !== 'pending');
      const sorted = [...pending].sort((a, b) => (idxMap[a.id] ?? 0) - (idxMap[b.id] ?? 0));
      return [...sorted, ...read];
    });
    await api.reorderReadingList(ids);
  }

  const allPending = items.filter(it => it.status === 'pending');
  const allRead = items.filter(it => it.status !== 'pending');
  const isFiltering = search.trim() || filterCats.length > 0;
  const pending = isFiltering ? applyFilters(allPending, search, filterCats) : allPending;
  const read = isFiltering ? applyFilters(allRead, search, filterCats) : allRead;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Para Leer</div>
          <div className="page-subtitle">{allPending.length} pendientes · {allRead.length} leídos</div>
        </div>
        <button className="btn btn-primary" onClick={() => setDialog('new')}>+ Añadir</button>
      </div>

      {dialog && (
        <ItemDialog
          item={dialog === 'new' ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={load}
          onDeleted={load}
        />
      )}

      <FilterBar search={search} onSearch={setSearch} filterCats={filterCats} onFilterCats={setFilterCats} />

      {pending.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
          {isFiltering ? 'Sin resultados' : 'Sin elementos pendientes'}
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            <PendingList
              items={pending}
              onToggle={toggleStatus}
              onEdit={setDialog}
              onReorder={reorder}
            />
          </div>
        </div>
      )}

      <ReadList items={read} onToggle={toggleStatus} onEdit={setDialog} />
    </div>
  );
}
