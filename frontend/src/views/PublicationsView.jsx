import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../utils/dateUtils.js';
import { CategoryBadges, CategoryOption, useCats } from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import ContentSearchFilters from '../components/ContentSearchFilters.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';

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

export function DetailDialog({ pub, objectives, onClose, onSaved, onDeleted }) {
  useEscapeClose(onClose);
  const isNew = !pub;
  const initCatIds = parseCatIds(pub?.category_ids, pub?.category_id);
  const [form, setForm] = useState({
    title: pub?.title || '',
    type: pub?.type || 'post',
    date: pub?.date || '',
    status: pub?.status || 'pending',
    objective_id: pub?.objective_id || '',
    notes: pub?.notes || '',
    publication_text: pub?.publication_text || '',
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
            <SpanishDateInput value={form.date} onChange={v => set('date', v)} style={{ width: '100%' }} />
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
          <label style={labelSt}>Texto de la publicación</label>
          <textarea value={form.publication_text} onChange={e => set('publication_text', e.target.value)} rows={5}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }} />
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
  const location = useLocation();
  const navigate = useNavigate();
  const [pubs, setPubs] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filterCats, setFilterCats] = useState([]);
  const [searchTitle, setSearchTitle] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  async function load() {
    api.publications().then(setPubs);
    api.objectives().then(setObjectives);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const intent = location.state;
    if (!intent?.fromSearch || intent.itemKind !== 'publication') return;
    const target = pubs.find(p => String(p.id) === String(intent.itemId));
    if (!target) return;
    setSelected(target);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, pubs]);

  const usedCatIds = [...new Set(pubs.flatMap(p => parseCatIds(p.category_ids, p.category_id)))];
  const normalizedSearch = searchTitle.trim().toLowerCase();
  const dateMatches = (value) => {
    if (!value) return !fromDate && !toDate;
    if (fromDate && value < fromDate) return false;
    if (toDate && value > toDate) return false;
    return true;
  };

  const filteredBySearch = pubs
    .filter(p => !normalizedSearch || (p.title || '').toLowerCase().includes(normalizedSearch))
    .filter(p => dateMatches(p.date))
    .filter(p => filterCats.length === 0 || filterCats.some(fc => parseCatIds(p.category_ids, p.category_id).includes(fc)))
  const activePubs = filteredBySearch
    .filter(p => p.status !== 'published');
  const publishedPubs = filteredBySearch.filter(p => p.status === 'published');
  const totalPubs = pubs.length;
  const totalPublished = pubs.filter(p => p.status === 'published').length;
  const totalActive = pubs.filter(p => p.status !== 'published').length;
  const progressPct = totalPubs > 0 ? Math.round((totalPublished / totalPubs) * 100) : 0;
  const postCount = pubs.filter(p => p.type === 'post').length;
  const articleCount = pubs.filter(p => p.type === 'article').length;
  const videoCount = pubs.filter(p => p.type === 'video').length;

  const objMap = Object.fromEntries(objectives.map(o => [o.id, o]));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Publicaciones</div>
          <div className="page-subtitle">{activePubs.length} activas · {publishedPubs.length} publicadas</div>
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

      <ContentMetricsSummary
        title="Resumen de publicaciones"
        metrics={[
          { label: 'Publicaciones activas', value: totalActive, sub: 'pendientes o borrador' },
          { label: 'Publicadas', value: totalPublished, sub: `de ${totalPubs} total`, valueStyle: { color: 'var(--success)' } },
          { label: 'Progreso global', value: `${progressPct}%`, sub: `${totalPublished}/${totalPubs} completadas`, valueStyle: { color: 'var(--accent)' } },
          { label: 'Distribución por tipo', value: `📝 ${articleCount} · ✍️ ${postCount} · 🎬 ${videoCount}`, sub: 'artículos, posts y vídeos', valueStyle: { fontSize: 16 } },
        ]}
      />

      <ContentSearchFilters
        title={searchTitle}
        onTitleChange={setSearchTitle}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        selectedCats={filterCats}
        onSelectedCatsChange={setFilterCats}
        availableCatIds={usedCatIds}
      />

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Por publicar</div>
      {activePubs.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✍️</div>
          Sin publicaciones pendientes con estos filtros
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {activePubs.map(pub => {
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
                        <CategoryBadges ids={catIds} />
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

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: '18px 0 8px' }}>Publicadas</div>
      {publishedPubs.length === 0 ? (
        <div className="empty-state card" style={{ padding: 32 }}>
          No hay elementos publicados con estos filtros
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {publishedPubs.map(pub => {
              const icon = TYPE_ICONS[pub.type] || '✍️';
              const obj = objMap[pub.objective_id];
              const catIds = parseCatIds(pub.category_ids, pub.category_id);
              return (
                <div key={pub.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(pub)}>
                  <div className="task-info">
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{icon} {pub.title}</div>
                    <div className="task-meta">
                      <span className="task-time">{fmtDate(pub.date)}</span>
                      {obj && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→ {obj.title}</span>}
                    </div>
                    {catIds.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        <CategoryBadges ids={catIds} />
                      </div>
                    )}
                  </div>
                  <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                    Publicado ✓
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
