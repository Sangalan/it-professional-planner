import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate } from '../utils/dateUtils.js';
import CatBadge, { CategoryOption, useCats } from '../components/CatBadge.jsx';

const TYPE_ICONS = { video: '🎬', article: '📝', post: '✍️' };
const TYPE_LABELS = { video: 'Vídeo', article: 'Artículo', post: 'Post' };

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pendiente' },
  { value: 'draft',     label: 'Borrador' },
  { value: 'published', label: 'Publicado ✓' },
];

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const fieldW = { marginBottom: 14 };

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function daysLabel(days) {
  if (days == null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d vencido`, cls: 'overdue' };
  if (days === 0) return { text: 'Hoy', cls: 'soon' };
  return { text: `${days}d`, cls: days <= 7 ? 'soon' : 'ok' };
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

function DetailDialog({ pub, objectives, onClose, onSaved, onDeleted }) {
  const isNew = !pub;
  const initCatIds = parseCatIds(pub?.category_ids, pub?.category_id);
  const [form, setForm] = useState({
    title: pub?.title || '',
    type: pub?.type || 'post',
    date: pub?.date || '',
    status: pub?.status || 'pending',
    objective_id: pub?.objective_id || '',
    notes: pub?.notes || '',
  });
  const [catIds, setCatIds] = useState(initCatIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    if (isNew) {
      await api.createPublication({ ...form, objective_id: form.objective_id || null, category_ids: catIds, category_id: catIds[0] || null });
    } else {
      await api.updatePublication(pub.id, { ...form, objective_id: form.objective_id || null, category_ids: catIds, category_id: catIds[0] || null });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const days = pub?.days_remaining;
  const dl = daysLabel(days);

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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{isNew ? 'Nueva publicación' : 'Publicación'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={fieldW}>
          <label style={labelSt}>Título</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Tipo</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%' }}>
              <option value="post">Post</option>
              <option value="video">Vídeo</option>
              <option value="article">Artículo</option>
            </select>
          </div>
          <div>
            <label style={labelSt}>Fecha {dl && <span className={`milestone-days ${dl.cls}`} style={{ marginLeft: 6, fontSize: 11 }}>{dl.text}</span>}</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Objetivo</label>
            <select value={form.objective_id} onChange={e => set('objective_id', e.target.value)} style={{ width: '100%' }}>
              <option value="">Sin objetivo</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
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
            <button className="btn btn-ghost" onClick={async () => {
              if (!confirm('¿Eliminar esta publicación?')) return;
              setDeleting(true);
              const r = await api.deletePublication(pub.id);
              setDeleting(false);
              if (r.error) { alert(r.error); return; }
              onDeleted(); onClose();
            }} disabled={deleting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicationsView() {
  const [pubs, setPubs] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const cats = useCats();

  async function load() {
    api.publications().then(setPubs);
    api.objectives().then(setObjectives);
  }

  useEffect(() => { load(); }, []);

  const usedCatIds = [...new Set(pubs.flatMap(p => parseCatIds(p.category_ids, p.category_id)))];
  const usedCats = cats.filter(c => usedCatIds.includes(c.id));

  const displayed = pubs
    .filter(p => !filterCat || parseCatIds(p.category_ids, p.category_id).includes(filterCat))
    .filter(p => !filterStatus || p.status === filterStatus);

  const objMap = Object.fromEntries(objectives.map(o => [o.id, o]));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Publicaciones</div>
          <div className="page-subtitle">{displayed.length} publicaciones</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nueva</button>
      </div>

      {creating && (
        <DetailDialog
          pub={null}
          objectives={objectives}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
          onDeleted={() => {}}
        />
      )}
      {selected && (
        <DetailDialog
          pub={selected}
          objectives={objectives}
          onClose={() => setSelected(null)}
          onSaved={load}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}

      {/* Filters */}
      {usedCats.length > 0 && (
        <div className="filter-row" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Categoría:</span>
          <span className={`chip ${!filterCat ? 'active' : ''}`} onClick={() => setFilterCat('')}>Todos</span>
          {usedCats.map(c => (
            <span key={c.id} className={`chip ${filterCat === c.id ? 'active' : ''}`} onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}>{c.name}</span>
          ))}
        </div>
      )}
      <div className="filter-row" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Estado:</span>
        <span className={`chip ${!filterStatus ? 'active' : ''}`} onClick={() => setFilterStatus('')}>Todos</span>
        {STATUS_OPTIONS.map(s => (
          <span key={s.value} className={`chip ${filterStatus === s.value ? 'active' : ''}`} onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}>{s.label}</span>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✍️</div>
          Sin publicaciones
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {displayed.map(pub => {
              const icon = TYPE_ICONS[pub.type] || '✍️';
              const obj = objMap[pub.objective_id];
              const days = pub.days_remaining;
              const dl = daysLabel(days);
              const catIds = parseCatIds(pub.category_ids, pub.category_id);
              return (
                <div key={pub.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(pub)}>
                  <div className="task-info">
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{icon} {pub.title}</div>
                    <div className="task-meta">
                      {dl && <span className={`milestone-days ${dl.cls}`}>{dl.text}</span>}
                      <span className="task-time">{fmtDate(pub.date)}</span>
                      {obj && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→ {obj.title}</span>}
                    </div>
                    {catIds.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        {catIds.map(cid => <CatBadge key={cid} id={cid} />)}
                      </div>
                    )}
                  </div>
                  <span style={{
                    background: pub.status === 'published' ? '#dcfce7' : pub.status === 'draft' ? '#fef9c3' : 'var(--bg)',
                    color: pub.status === 'published' ? '#16a34a' : pub.status === 'draft' ? '#92400e' : 'var(--text-2)',
                    fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                  }}>
                    {STATUS_OPTIONS.find(s => s.value === pub.status)?.label || pub.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
