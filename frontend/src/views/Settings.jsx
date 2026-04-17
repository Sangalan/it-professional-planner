import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CategorySelector, ColorPicker } from '../components/CatBadge.jsx';
import { statusLabel } from '../utils/categoryUtils.js';
import SpanishDateInput from '../components/SpanishDateInput.jsx';

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const rowBorder = { padding: '10px 0', borderBottom: '1px solid var(--border)' };
const fieldW = { marginBottom: 14 };
const LINKED_MILESTONE_STATUS_LABELS = {
  pending: 'Pendiente',
  draft: 'Borrador',
  published: 'Publicado',
  not_started: 'No iniciado',
  in_progress: 'En curso',
  completed: 'Completado',
  blocked: 'Bloqueado',
  review: 'En review',
  failed: 'Fallido',
  merged: 'Merged',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
  read: 'Leído',
};

function linkedStatusLabel(status) {
  if (!status) return 'Sin estado';
  return LINKED_MILESTONE_STATUS_LABELS[status] || statusLabel(status);
}

// ── SHARED ────────────────────────────────────────────────────────────────────

function Dialog({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 28,
        maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionCard({ title, count, children, onNew }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ maxWidth: 760, marginBottom: 20 }}>
      <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }} onClick={() => setOpen(o => !o)}>
          <span className="card-title">{title} ({count})</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{open ? '▲' : '▼'}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onNew}>+ Nuevo</button>
      </div>
      {open && <div className="card-body">{children}</div>}
    </div>
  );
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────

function CategoryDialog({ cat, onClose, onSaved, onDeleted }) {
  const isNew = !cat;
  const [name, setName] = useState(cat?.name || '');
  const [color, setColor] = useState(cat?.color || '#2563eb');
  const [textColor, setTextColor] = useState(cat?.text_color || '#1f2937');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [deleteWarning, setDeleteWarning] = useState(null);

  function nameToId(n) {
    return n.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function save() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true); setError(''); setDeleteWarning(null);
    try {
      if (isNew) await api.createCategory({ id: nameToId(name), name: name.trim(), color, text_color: textColor });
      else await api.updateCategory(cat.id, { name: name.trim(), color, text_color: textColor });
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function del() {
    if (!window.confirm(`¿Eliminar categoría "${cat.name}"?`)) return;
    setDeleting(true);
    try {
      const r = await api.deleteCategory(cat.id);
      if (r.error) { setDeleteWarning(r); return; }
      onDeleted(); onClose();
    } catch (e) {
      setDeleteWarning({ error: e?.message || 'No se pudo eliminar la categoría' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog title={isNew ? 'Nueva categoría' : `Editar categoría — ${cat.name}`} onClose={onClose}>
      <div style={fieldW}>
        <label style={labelSt}>Nombre *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Mi categoría" style={{ width: '100%' }} autoFocus />
        {isNew && name.trim() && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontFamily: 'monospace' }}>
            ID: {nameToId(name)}
          </div>
        )}
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Color de fondo</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Color del texto</label>
        <ColorPicker value={textColor} onChange={setTextColor} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>Vista previa</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="badge" style={{ background: color + '22', color: textColor, border: `1px solid ${textColor}`, fontSize: 13, padding: '4px 12px' }}>
            {name.trim() || 'Ejemplo'}
          </span>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Así se verá la categoría
          </div>
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {deleteWarning && (
        <div style={{
          marginBottom: 12,
          padding: '10px 12px',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          background: '#fff1f2',
          color: '#7f1d1d',
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No se puede eliminar la categoría</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{deleteWarning.error}</div>
          {Array.isArray(deleteWarning.usages) && deleteWarning.usages.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {deleteWarning.usages.map((u) => (
                <div key={u.type} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{u.type} ({u.count})</div>
                  <div style={{ color: '#9f1239' }}>
                    {(u.items || []).slice(0, 5).map(it => it.date ? `${it.title} (${it.date})` : it.title).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!isNew ? (
          <button className="btn btn-ghost" onClick={del} disabled={deleting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}</button>
        </div>
      </div>
    </Dialog>
  );
}

function CategoryRow({ cat, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      {editing && <CategoryDialog cat={cat} onClose={() => setEditing(false)} onSaved={onSaved} onDeleted={onDeleted} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...rowBorder, cursor: 'pointer' }} onClick={() => setEditing(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: cat.color, border: '1px solid var(--border)' }} title="Color de fondo" />
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: cat.text_color || '#1f2937', border: '1px solid var(--border)' }} title="Color del texto" />
        </div>
        <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>
          {cat.name}
        </div>
      </div>
    </>
  );
}

// ── OBJECTIVES ────────────────────────────────────────────────────────────────

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function ObjectiveDialog({ obj, onClose, onSaved, onDeleted }) {
  const isNew = !obj;
  const [form, setForm] = useState({
    title: obj?.title || '', description: obj?.description || '',
    category_ids: parseCatIds(obj?.category_ids, obj?.category_id),
    start_date: obj?.start_date || '',
    end_date: obj?.end_date || '', target_value: obj?.target_value || '',
    priority: obj?.priority ?? 2, status: obj?.status || 'not_started', notes: obj?.notes || '',
    color: obj?.color || '',
    is_client: obj?.type === 'client',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const { is_client, ...rest } = form;
      const payload = {
        ...rest,
        priority: Number(rest.priority),
        category_ids: rest.category_ids,
        category_id: rest.category_ids[0] || null,
        color: rest.color || null,
        type: is_client ? 'client' : 'objective',
      };
      if (isNew) await api.createObjective(payload);
      else await api.updateObjective(obj.id, payload);
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function del() {
    if (!window.confirm(`¿Eliminar objetivo "${obj.title}"?`)) return;
    setDeleting(true);
    const r = await api.deleteObjective(obj.id);
    setDeleting(false);
    if (r.error) { alert(r.error); return; }
    onDeleted(); onClose();
  }

  return (
    <Dialog title={isNew ? 'Nuevo objetivo' : `Editar — ${obj.title}`} onClose={onClose}>
      <div style={fieldW}>
        <label style={labelSt}>Título *</label>
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus />
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Categorías</label>
        <CategorySelector selected={form.category_ids} onChange={ids => set('category_ids', ids)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Inicio</label>
          <SpanishDateInput value={form.start_date} onChange={v => set('start_date', v)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Fin</label>
          <SpanishDateInput value={form.end_date} onChange={v => set('end_date', v)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Prioridad</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} style={{ width: '100%' }}>
            <option value={1}>Alta ★</option>
            <option value={2}>Normal</option>
            <option value={3}>Baja</option>
          </select>
        </div>
        <div>
          <label style={labelSt}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
            <option value="not_started">No iniciado</option>
            <option value="in_progress">En curso</option>
            <option value="completed">Completado</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Meta</label>
          <input type="text" value={form.target_value} onChange={e => set('target_value', e.target.value)} placeholder="ej. 500 seguidores" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Notas</label>
          <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!form.is_client} onChange={e => set('is_client', e.target.checked)} />
          Es cliente 👤
        </label>
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Color de la barra de progreso</label>
        <ColorPicker value={form.color || '#2563eb'} onChange={v => set('color', v)} />
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!isNew ? (
          <button className="btn btn-ghost" onClick={del} disabled={deleting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}</button>
        </div>
      </div>
    </Dialog>
  );
}

function ObjectiveRow({ obj, cats, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const catName = cats.find(c => c.id === obj.category_id)?.name || '—';
  const objectiveColor = obj.color || '#2563eb';

  return (
    <>
      {editing && <ObjectiveDialog obj={obj} onClose={() => setEditing(false)} onSaved={onSaved} onDeleted={onDeleted} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...rowBorder, cursor: 'pointer' }} onClick={() => setEditing(true)}>
        <span
          style={{ width: 12, height: 12, borderRadius: 3, background: objectiveColor, border: '1px solid var(--border)', flexShrink: 0 }}
          title="Color del objetivo"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {obj.type === 'client' && <span style={{ marginRight: 4 }}>👤</span>}
            {obj.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{catName} · {obj.end_date || 'sin fecha'} · {statusLabel(obj.status)}</div>
        </div>
      </div>
    </>
  );
}

// ── MILESTONES ────────────────────────────────────────────────────────────────

function MilestoneDialog({ m, objectives, onClose, onSaved, onDeleted }) {
  const isNew = !m;
  const [form, setForm] = useState({
    title: m?.title || '', description: m?.description || '',
    objective_id: m?.objective_id || '', target_date: m?.target_date || '',
    status: m?.status || 'not_started',
    billed_amount: m?.billed_amount ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  const parentObj = objectives.find(o => o.id === form.objective_id);
  const isClientObj = parentObj?.type === 'client';

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (isNew && !form.objective_id) { setError('El objetivo es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, billed_amount: isClientObj ? (Number(form.billed_amount) || 0) : 0 };
      if (isNew) await api.createMilestone(payload);
      else await api.updateMilestone(m.id, payload);
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function del() {
    if (!window.confirm(`¿Eliminar hito "${m.title}"?`)) return;
    setDeleting(true);
    const r = await api.deleteMilestone(m.id);
    setDeleting(false);
    if (r.error) { alert(r.error); return; }
    onDeleted(); onClose();
  }

  return (
    <Dialog title={isNew ? 'Nuevo hito' : `Editar — ${m.title}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Título *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus />
        </div>
        <div>
          <label style={labelSt}>Objetivo {isNew && '*'}</label>
          <select value={form.objective_id} onChange={e => set('objective_id', e.target.value)} style={{ width: '100%' }}>
            <option value="">Sin objetivo</option>
            {objectives.map(o => <option key={o.id} value={o.id}>{o.type === 'client' ? '👤 ' : ''}{o.title}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isClientObj ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Fecha objetivo</label>
          <SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
            <option value="not_started">No iniciado</option>
            <option value="in_progress">En curso</option>
            <option value="completed">Completado</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
        {isClientObj && (
          <div>
            <label style={labelSt}>Facturado ($)</label>
            <input type="text" inputMode="decimal" value={form.billed_amount}
              onChange={e => set('billed_amount', e.target.value)}
              style={{ width: '100%' }} placeholder="0.00" />
          </div>
        )}
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!isNew ? (
          <button className="btn btn-ghost" onClick={del} disabled={deleting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}</button>
        </div>
      </div>
    </Dialog>
  );
}

function MilestoneSettingsRow({ item, objectives, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const canEdit = item.kind === 'classic';
  const taskCount = item.task_count || 0;
  const taskLabel = `${taskCount} tarea${taskCount === 1 ? '' : 's'} asociada${taskCount === 1 ? '' : 's'}`;

  return (
    <>
      {editing && canEdit && (
        <MilestoneDialog
          m={item.raw}
          objectives={objectives}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, ...rowBorder, paddingLeft: 12, cursor: canEdit ? 'pointer' : 'default' }}
        onClick={() => { if (canEdit) setEditing(true); }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>
            {item.icon ? `${item.icon} ` : ''}{item.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {item.date || 'sin fecha'} · {linkedStatusLabel(item.status)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span
              className="badge"
              style={{
                background: item.kind === 'classic' ? '#e0e7ff' : '#f1f5f9',
                color: item.kind === 'classic' ? '#3730a3' : '#334155',
                border: `1px solid ${item.kind === 'classic' ? '#c7d2fe' : '#cbd5e1'}`,
              }}
            >
              {item.kind === 'classic' ? 'Clásico' : `Especializado · ${item.typeLabel}`}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{taskLabel}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [cats, setCats] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [milestoneItems, setMilestoneItems] = useState([]);
  const [creatingCat, setCreatingCat] = useState(false);
  const [creatingObj, setCreatingObj] = useState(false);
  const [creatingMs, setCreatingMs] = useState(false);

  function loadCats() { api.categories().then(setCats); }
  function loadObjectives() { api.objectives().then(setObjectives); }
  async function loadMilestones() {
    const [classicMilestones, publications, certifications, repos, prs, events, tasks] = await Promise.all([
      api.milestones(),
      api.publications(),
      api.certifications(),
      api.repos(),
      api.prs(),
      api.events(),
      api.tasks(),
    ]);

    const taskCountByMilestone = {};
    for (const task of tasks || []) {
      if (!task?.milestone_id) continue;
      taskCountByMilestone[task.milestone_id] = (taskCountByMilestone[task.milestone_id] || 0) + 1;
    }

    const mergedItems = [
      ...(classicMilestones || []).map(m => ({
        id: m.id,
        title: m.title,
        objective_id: m.objective_id || '',
        date: m.target_date || '',
        status: m.status || '',
        kind: 'classic',
        typeLabel: 'Hito',
        icon: '🏁',
        task_count: taskCountByMilestone[m.id] || 0,
        raw: m,
      })),
      ...(publications || []).map(p => ({
        id: p.id,
        title: p.title,
        objective_id: p.objective_id || '',
        date: p.date || '',
        status: p.status || '',
        kind: 'specialized',
        typeLabel: 'Publicación',
        icon: '✍️',
        task_count: taskCountByMilestone[p.id] || 0,
      })),
      ...(certifications || []).map(c => ({
        id: c.id,
        title: c.title,
        objective_id: c.objective_id || '',
        date: c.target_date || '',
        status: c.status || '',
        kind: 'specialized',
        typeLabel: 'Certificación',
        icon: '🏆',
        task_count: taskCountByMilestone[c.id] || 0,
      })),
      ...(repos || []).map(r => ({
        id: r.id,
        title: r.title,
        objective_id: r.objective_id || '',
        date: r.target_date || '',
        status: r.status || '',
        kind: 'specialized',
        typeLabel: 'Proyecto',
        icon: '📦',
        task_count: taskCountByMilestone[r.id] || 0,
      })),
      ...(prs || []).map(pr => ({
        id: pr.id,
        title: pr.title,
        objective_id: pr.objective_id || '',
        date: pr.end_date || pr.start_date || '',
        status: pr.status || '',
        kind: 'specialized',
        typeLabel: 'Pull Request',
        icon: '🔀',
        task_count: taskCountByMilestone[pr.id] || 0,
      })),
      ...(events || []).map(e => ({
        id: e.id,
        title: e.title,
        objective_id: e.objective_id || '',
        date: e.end_date || e.start_date || '',
        status: e.status || '',
        kind: 'specialized',
        typeLabel: 'Evento',
        icon: '🎪',
        task_count: taskCountByMilestone[e.id] || 0,
      })),
    ].sort((a, b) => {
      const ad = a.date || '9999-99-99';
      const bd = b.date || '9999-99-99';
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.title || '').localeCompare(b.title || '', 'es');
    });

    setMilestoneItems(mergedItems);
  }
  function loadAll() { loadCats(); loadObjectives(); loadMilestones(); }

  useEffect(() => { loadAll(); }, []);

  const objectiveById = objectives.reduce((acc, obj) => {
    acc[obj.id] = obj;
    return acc;
  }, {});
  const milestonesByObj = milestoneItems.reduce((acc, item) => {
    const key = item.objective_id && objectiveById[item.objective_id] ? item.objective_id : '__none__';
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  return (
    <div>
      {creatingCat && <CategoryDialog onClose={() => setCreatingCat(false)} onSaved={loadCats} />}
      {creatingObj && <ObjectiveDialog onClose={() => setCreatingObj(false)} onSaved={loadObjectives} />}
      {creatingMs  && <MilestoneDialog objectives={objectives} onClose={() => setCreatingMs(false)} onSaved={loadMilestones} />}

      <div className="page-header">
        <div>
          <div className="page-title">Configuración</div>
          <div className="page-subtitle">Gestión de categorías, objetivos e hitos</div>
        </div>
      </div>

      <SectionCard title="Categorías" count={cats.length} onNew={() => setCreatingCat(true)}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
          El ID es permanente; el nombre y el color son editables.
        </p>
        {cats.map(cat => <CategoryRow key={cat.id} cat={cat} onSaved={loadCats} onDeleted={loadCats} />)}
      </SectionCard>

      <SectionCard title="Objetivos" count={objectives.length} onNew={() => setCreatingObj(true)}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
          No se puede eliminar un objetivo si tiene tareas o hitos asociados.
        </p>
        {objectives.map(obj => (
          <ObjectiveRow key={obj.id} obj={obj} cats={cats} onSaved={loadObjectives} onDeleted={loadAll} />
        ))}
      </SectionCard>

      <SectionCard title="Hitos" count={milestoneItems.length} onNew={() => setCreatingMs(true)}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
          Agrupados por objetivo. Se muestran hitos clásicos y especializados con su número de tareas asociadas.
        </p>
        {objectives.map(obj => {
          const ms = milestonesByObj[obj.id];
          if (!ms?.length) return null;
          return (
            <div key={obj.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px', padding: '8px 0 2px' }}>
                {obj.title}
              </div>
              {ms.map(item => (
                <MilestoneSettingsRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  objectives={objectives}
                  onSaved={loadMilestones}
                  onDeleted={loadMilestones}
                />
              ))}
            </div>
          );
        })}
        {(milestonesByObj.__none__ || []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px', padding: '8px 0 2px' }}>
              Sin objetivo
            </div>
            {(milestonesByObj.__none__ || []).map(item => (
              <MilestoneSettingsRow
                key={`${item.kind}-${item.id}`}
                item={item}
                objectives={objectives}
                onSaved={loadMilestones}
                onDeleted={loadMilestones}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
