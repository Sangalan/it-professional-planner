import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate } from '../utils/dateUtils.js';
import CatBadge, { useCats } from '../components/CatBadge.jsx';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En desarrollo' },
  { value: 'completed',   label: 'Publicado ✓' },
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

function CategorySelector({ selected, onChange }) {
  const cats = useCats();
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {cats.map(cat => {
        const active = selected.includes(cat.id);
        return (
          <span key={cat.id} onClick={() => toggle(cat.id)} style={{
            cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 10,
            background: active ? cat.color + '33' : 'var(--bg)',
            color: active ? cat.color : 'var(--text-3)',
            border: `1px solid ${active ? cat.color : 'var(--border)'}`,
            fontWeight: active ? 600 : 400,
          }}>
            {cat.name}
          </span>
        );
      })}
    </div>
  );
}

function DetailDialog({ repo, objectives, onClose, onSaved, onDeleted }) {
  const isNew = !repo;
  const initCatIds = parseCatIds(repo?.category_ids, repo?.category_id);
  const [form, setForm] = useState({
    title: repo?.title || '',
    target_date: repo?.target_date || '',
    status: repo?.status || 'not_started',
    objective_id: repo?.objective_id || '',
    url: repo?.url || '',
    notes: repo?.notes || '',
  });
  const [catIds, setCatIds] = useState(initCatIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    if (isNew) {
      await api.createRepo({ ...form, objective_id: form.objective_id || null, url: form.url || null, category_ids: catIds, category_id: catIds[0] || null });
    } else {
      await api.updateRepo(repo.id, { ...form, objective_id: form.objective_id || null, url: form.url || null, category_ids: catIds, category_id: catIds[0] || null });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const days = repo?.days_remaining;
  const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';

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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>📦 {isNew ? 'Nuevo repositorio' : 'Repositorio'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        {isNew ? (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Título *</label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} autoFocus />
            </div>
            <div>
              <label style={labelSt}>Fecha objetivo</label>
              <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace', marginBottom: 4 }}>{repo.title}</div>
            <div className="task-meta" style={{ marginBottom: 16 }}>
              <span className="task-time">Publicar antes del {fmtDate(repo.target_date)}</span>
              {days != null && <span className={`milestone-days ${cls}`}>
                {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}
              </span>}
            </div>
          </>
        )}

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
          <label style={labelSt}>URL GitHub</label>
          <input type="url" value={form.url} onChange={e => set('url', e.target.value)}
            placeholder="https://github.com/usuario/repo"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
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
              if (!confirm('¿Eliminar este repositorio?')) return;
              setDeleting(true);
              const r = await api.deleteRepo(repo.id);
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

export default function ReposView() {
  const [repos, setRepos] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const cats = useCats();

  async function load() {
    api.repos().then(setRepos);
    api.objectives().then(setObjectives);
  }

  useEffect(() => { load(); }, []);

  // Categories used by at least one repo
  const usedCatIds = [...new Set(repos.flatMap(r => parseCatIds(r.category_ids, r.category_id)))];
  const usedCats = cats.filter(c => usedCatIds.includes(c.id));

  const visible = filterCat
    ? repos.filter(r => parseCatIds(r.category_ids, r.category_id).includes(filterCat))
    : repos;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Repositorios</div>
          <div className="page-subtitle">{visible.length} repositorios</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nuevo</button>
      </div>

      {creating && (
        <DetailDialog repo={null} objectives={objectives} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} onDeleted={() => {}} />
      )}
      {selected && (
        <DetailDialog repo={selected} objectives={objectives} onClose={() => setSelected(null)} onSaved={load} onDeleted={() => { setSelected(null); load(); }} />
      )}

      {/* Filters */}
      {usedCats.length > 0 && (
        <div className="filter-row" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Categoría:</span>
          <span className={`chip ${!filterCat ? 'active' : ''}`} onClick={() => setFilterCat('')}>Todos</span>
          {usedCats.map(c => (
            <span key={c.id} className={`chip ${filterCat === c.id ? 'active' : ''}`}
              onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}>{c.name}</span>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          {filterCat ? 'Sin repositorios en esta categoría' : 'Sin repositorios'}
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {visible.map(repo => {
              const days = repo.days_remaining;
              const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
              const catIds = parseCatIds(repo.category_ids, repo.category_id);
              return (
                <div key={repo.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(repo)}>
                  <div className="task-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>📦 {repo.title}</span>
                      {repo.url && (
                        <a href={repo.url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace' }}>
                          ↗ GitHub
                        </a>
                      )}
                    </div>
                    <div className="task-meta">
                      <span className="task-time">{fmtDate(repo.target_date)}</span>
                      <span className={`milestone-days ${cls}`}>
                        {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}
                      </span>
                      {catIds.map(cid => <CatBadge key={cid} id={cid} />)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                    background: repo.status === 'completed' ? '#dcfce7' : repo.status === 'in_progress' ? '#dbeafe' : 'var(--bg)',
                    color: repo.status === 'completed' ? '#16a34a' : repo.status === 'in_progress' ? '#2563eb' : 'var(--text-2)',
                  }}>
                    {STATUS_OPTIONS.find(s => s.value === repo.status)?.label || repo.status}
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
