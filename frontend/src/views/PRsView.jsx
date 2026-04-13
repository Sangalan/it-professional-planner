import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtShortDate } from '../utils/dateUtils.js';
import CatBadge, { CategoryOption, useCats } from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'review',      label: 'En review' },
  { value: 'merged',      label: 'Merged ✓' },
  { value: 'closed',      label: 'Cerrada' },
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
        return <CategoryOption key={cat.id} cat={cat} active={active} onClick={() => toggle(cat.id)} />;
      })}
    </div>
  );
}

function DetailDialog({ pr, objectives, onClose, onSaved, onDeleted }) {
  const isNew = !pr;
  const initCatIds = parseCatIds(pr?.category_ids, pr?.category_id);
  const [form, setForm] = useState({
    title: pr?.title || '',
    start_date: pr?.start_date || '',
    end_date: pr?.end_date || '',
    status: pr?.status || 'not_started',
    objective_id: pr?.objective_id || '',
    notes: pr?.notes || '',
    percentage_completed: pr?.percentage_completed ?? 0,
  });
  const [catIds, setCatIds] = useState(initCatIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    if (isNew) {
      await api.createPR({ ...form, objective_id: form.objective_id || null, category_ids: catIds, category_id: catIds[0] || null, percentage_completed: Number(form.percentage_completed) });
    } else {
      await api.updatePR(pr.id, { ...form, objective_id: form.objective_id || null, category_ids: catIds, category_id: catIds[0] || null, percentage_completed: Number(form.percentage_completed) });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const today = new Date().toISOString().slice(0, 10);
  const isActive = pr && pr.start_date <= today && pr.end_date >= today;

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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>🔀 {isNew ? 'Nuevo Pull Request' : 'Pull Request'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Título *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus={isNew} />
          </div>
          <div>
            <label style={labelSt}>Inicio</label>
            <SpanishDateInput value={form.start_date} onChange={v => set('start_date', v)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={labelSt}>Fin</label>
            <SpanishDateInput value={form.end_date} onChange={v => set('end_date', v)} style={{ width: '100%' }} />
          </div>
        </div>
        {!isNew && isActive && (
          <div className="task-meta" style={{ marginBottom: 14 }}>
            <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }}>Activa ahora</span>
          </div>
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
          <label style={labelSt}>% completado</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min="0" max="100" step="5"
              value={form.percentage_completed}
              onChange={e => set('percentage_completed', Number(e.target.value))}
              style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 36, color: 'var(--accent)' }}>{form.percentage_completed}%</span>
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
              if (!confirm('¿Eliminar este PR?')) return;
              setDeleting(true);
              const r = await api.deletePR(pr.id);
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

export default function PRsView() {
  const [prs, setPrs] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const cats = useCats();

  async function load() {
    api.prs().then(setPrs);
    api.objectives().then(setObjectives);
  }

  useEffect(() => { load(); }, []);

  const usedCatIds = [...new Set(prs.flatMap(p => parseCatIds(p.category_ids, p.category_id)))];
  const usedCats = cats.filter(c => usedCatIds.includes(c.id));
  const visible = filterCat ? prs.filter(p => parseCatIds(p.category_ids, p.category_id).includes(filterCat)) : prs;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Pull Requests</div>
          <div className="page-subtitle">{visible.length} PRs</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nuevo</button>
      </div>

      {creating && (
        <DetailDialog pr={null} objectives={objectives} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} onDeleted={() => {}} />
      )}
      {selected && (
        <DetailDialog pr={selected} objectives={objectives} onClose={() => setSelected(null)} onSaved={load} onDeleted={() => { setSelected(null); load(); }} />
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
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔀</div>
          {filterCat ? 'Sin PRs en esta categoría' : 'Sin pull requests'}
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {visible.map(pr => {
              const isActive = pr.start_date <= today && pr.end_date >= today;
              const catIds = parseCatIds(pr.category_ids, pr.category_id);
              const days = pr.days_remaining;
              const pct = pr.percentage_completed || 0;
              const daysCls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
              return (
                <div key={pr.id} className="task-row"
                  style={{ cursor: 'pointer', background: isActive ? 'var(--accent-light)' : 'transparent', margin: isActive ? '0 -18px' : 0, padding: isActive ? '10px 18px' : '10px 0' }}
                  onClick={() => setSelected(pr)}>
                  <div className="task-info">
                    <div style={{ fontWeight: 500, fontSize: 13 }}>🔀 {pr.title}</div>
                    <div className="task-meta">
                      {days != null && <span className={`milestone-days ${daysCls}`}>{days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}</span>}
                      <span className="task-time">{fmtShortDate(pr.start_date)} → {fmtShortDate(pr.end_date)}</span>
                      {isActive && <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }}>Activa</span>}
                    </div>
                    {catIds.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        {catIds.map(cid => <CatBadge key={cid} id={cid} />)}
                      </div>
                    )}
                    {pct > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <div className="progress-bar" style={{ flex: 1, maxWidth: 140, height: 4 }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 28 }}>{pct}%</span>
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                    background: pr.status === 'merged' ? '#dcfce7' : pr.status === 'review' ? '#fef9c3' : pr.status === 'in_progress' ? '#dbeafe' : pr.status === 'closed' ? '#fee2e2' : 'var(--bg)',
                    color: pr.status === 'merged' ? '#16a34a' : pr.status === 'review' ? '#92400e' : pr.status === 'in_progress' ? '#2563eb' : pr.status === 'closed' ? '#dc2626' : 'var(--text-2)',
                  }}>
                    {STATUS_OPTIONS.find(s => s.value === pr.status)?.label || pr.status}
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
