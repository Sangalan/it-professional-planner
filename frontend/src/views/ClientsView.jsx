import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, fmtShortDate } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import CatBadge, { CategoryBadges, CategorySelector, ColorPicker } from '../components/CatBadge.jsx';
import TaskModal from '../components/TaskModal.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';
import { canCompleteTask } from '../utils/taskUtils.js';
import { PUBLICATION_TYPE_OPTIONS } from '../utils/publicationTypes.js';

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const fieldW  = { marginBottom: 14 };

const STATUS_OPTS = [
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed',   label: 'Completado' },
  { value: 'blocked',     label: 'Bloqueado' },
];

const PROJECT_STATUS_OPTS = [
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En desarrollo' },
  { value: 'completed', label: 'Publicado ✓' },
];
const PROJECT_TYPE_OPTS = [
  { value: 'client', label: 'Cliente' },
  { value: 'sangalan', label: 'Sangalan' },
  { value: 'personal', label: 'Personal' },
];

const STATUS_ICONS = { not_started: '⚪', in_progress: '🔵', completed: '✅', blocked: '🔴' };
const MILESTONE_KIND_OPTS = [
  { value: 'classic', label: '🏁 Hito clásico' },
  { value: 'publication', label: '✍️ Publicación' },
  { value: 'certification', label: '🏆 Certificación' },
  { value: 'repo', label: '📦 Proyecto' },
  { value: 'pr', label: '🔀 Pull Request' },
  { value: 'event', label: '🎪 Evento' },
];

function fmtMoney(n) {
  if (!n) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function daysLeft(dateStr) {
  if (!dateStr) return 9999;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(dateStr + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
}

// ── Dialog base ──────────────────────────────────────────────────────────────
function Dialog({ title, onClose, children }) {
  useEscapeClose(onClose);
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

function MilestoneTypeDialog({ onClose, onPick }) {
  const [kind, setKind] = useState('classic');
  return (
    <Dialog title="Tipo de hito" onClose={onClose}>
      <div style={fieldW}>
        <label style={labelSt}>Selecciona el tipo</label>
        <select value={kind} onChange={e => setKind(e.target.value)} style={{ width: '100%' }}>
          {MILESTONE_KIND_OPTS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onPick(kind)}>Continuar</button>
      </div>
    </Dialog>
  );
}

// ── Client dialog (create/edit) — idéntico a ObjectiveDialog con Es cliente fijo
function ClientDialog({ client, onClose, onSaved }) {
  const isNew = !client;
  const [form, setForm] = useState({
    title:        client?.title        || '',
    description:  client?.description  || '',
    category_ids: parseCatIds(client?.category_ids, client?.category_id),
    start_date:   client?.start_date   || '',
    end_date:     client?.end_date     || '',
    target_value: client?.target_value || '',
    priority:     client?.priority     ?? 2,
    status:       client?.status       || 'not_started',
    notes:        client?.notes        || '',
    color:        client?.color        || '',
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        priority:    Number(form.priority),
        category_ids: form.category_ids,
        category_id: form.category_ids[0] || null,
        color:       form.color || null,
        type:        'client',
      };
      if (isNew) await api.createObjective(payload);
      else       await api.updateObjective(client.id, payload);
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function del() {
    if (!window.confirm(`¿Eliminar cliente "${client.title}"?`)) return;
    setDeleting(true);
    const r = await api.deleteObjective(client.id);
    setDeleting(false);
    if (r.error) { setError(r.error); return; }
    onSaved(); onClose();
  }

  return (
    <Dialog title={isNew ? 'Nuevo objetivo' : `Editar — ${client.title}`} onClose={onClose}>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'not-allowed', opacity: 0.6 }}>
          <input type="checkbox" checked disabled />
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
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Milestone dialog (create/edit) with billed_amount ────────────────────────
function MilestoneDialog({ milestone, clientId, onClose, onSaved }) {
  const isNew = !milestone;
  const [form, setForm] = useState({
    title:         milestone?.title        || '',
    description:   milestone?.description  || '',
    target_date:   milestone?.target_date  || '',
    status:        milestone?.status       || 'not_started',
    billed_amount: milestone?.billed_amount ?? 0,
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    const payload = { ...form, objective_id: clientId, billed_amount: Number(form.billed_amount) || 0 };
    if (isNew) await api.createMilestone(payload);
    else       await api.updateMilestone(milestone.id, payload);
    setSaving(false);
    onSaved();
    onClose();
  }

  async function del() {
    if (!confirm(`¿Eliminar hito "${milestone.title}"?`)) return;
    setDeleting(true);
    const r = await api.deleteMilestone(milestone.id);
    setDeleting(false);
    if (r.error) { setError(r.error); return; }
    onSaved();
    onClose();
  }

  return (
    <Dialog title={isNew ? 'Nuevo hito' : `Editar — ${milestone.title}`} onClose={onClose}>
      <div style={fieldW}>
        <label style={labelSt}>Título *</label>
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
          style={{ width: '100%' }} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Fecha objetivo</label>
          <SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
            {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Facturado ($)</label>
          <input type="text" inputMode="decimal" value={form.billed_amount}
            onChange={e => set('billed_amount', e.target.value)}
            style={{ width: '100%' }} placeholder="0.00" />
        </div>
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Descripción</label>
        <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
          style={{ width: '100%' }} />
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!isNew ? (
          <button className="btn btn-ghost" onClick={del} disabled={deleting}
            style={{ color: '#dc2626', borderColor: '#dc2626' }}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Crear hito' : 'Guardar'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Project dialog (create) for clients ─────────────────────────────────────
function ProjectDialog({ clientId, project, onClose, onSaved }) {
  const isNew = !project;
  const [form, setForm] = useState({
    title: project?.title || '',
    target_date: project?.target_date || '',
    type: project?.type || 'client',
    status: project?.status || 'not_started',
    url: project?.url || '',
    notes: project?.notes || '',
  });
  const [catIds, setCatIds] = useState(parseCatIds(project?.category_ids, project?.category_id));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await api.createRepo({
          ...form,
          objective_id: clientId,
          url: form.url || null,
          category_ids: catIds,
          category_id: catIds[0] || null,
        });
      } else {
        await api.updateRepo(project.id, {
          ...form,
          objective_id: clientId,
          url: form.url || null,
          category_ids: catIds,
          category_id: catIds[0] || null,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!project) return;
    if (!window.confirm(`¿Eliminar proyecto "${project.title}"?`)) return;
    setDeleting(true);
    const r = await api.deleteRepo(project.id);
    setDeleting(false);
    if (r.error) { setError(r.error); return; }
    onSaved();
    onClose();
  }

  return (
    <Dialog title={isNew ? 'Nuevo proyecto' : `Editar — ${project.title}`} onClose={onClose}>
      <div style={fieldW}>
        <label style={labelSt}>Título *</label>
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelSt}>Tipo</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%' }}>
            {PROJECT_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Fecha objetivo</label>
          <SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
            {PROJECT_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div style={fieldW}>
        <label style={labelSt}>URL GitHub</label>
        <input
          type="url"
          value={form.url}
          onChange={e => set('url', e.target.value)}
          placeholder="https://github.com/usuario/proyecto"
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
        />
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Categorías</label>
        <CategorySelector selected={catIds} onChange={setCatIds} />
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Notas</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }}
        />
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {!isNew ? (
          <button className="btn btn-ghost" onClick={del} disabled={deleting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>
            {saving ? 'Guardando…' : isNew ? 'Crear proyecto' : 'Guardar'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function CreatePublicationDialog({ objectiveId, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', date: '', type: 'idea', status: 'pending', notes: '', publication_text: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const isIdea = form.type === 'idea';
      await api.createPublication({
        ...form,
        date: isIdea ? null : (form.date || null),
        objective_id: isIdea ? null : objectiveId,
      });
      onSaved(); onClose();
    }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title="Nueva publicación" onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        {form.type === 'idea' ? (
          <div>
            <label style={labelSt}>Fecha</label>
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Sin fecha para ideas</div>
          </div>
        ) : (
          <div><label style={labelSt}>Fecha</label><SpanishDateInput value={form.date} onChange={v => set('date', v)} style={{ width: '100%' }} /></div>
        )}
        <div><label style={labelSt}>Tipo</label><select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%' }}>{PUBLICATION_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
        <div><label style={labelSt}>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}><option value="pending">Pendiente</option><option value="published">Publicado</option><option value="failed">Fallida</option><option value="cancelled">Cancelada</option></select></div>
      </div>
      <div style={fieldW}><label style={labelSt}>Notas</label><input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} /></div>
      <div style={fieldW}><label style={labelSt}>Texto de la publicación</label><textarea value={form.publication_text} onChange={e => set('publication_text', e.target.value)} rows={4} style={{ width: '100%', resize: 'vertical' }} /></div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button></div>
    </Dialog>
  );
}

function CreateCertificationDialog({ objectiveId, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', target_date: '', status: 'not_started', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try { await api.createCertification({ ...form, objective_id: objectiveId }); onSaved(); onClose(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title="Nueva certificación" onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Fecha objetivo</label><SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}><option value="not_started">No iniciado</option><option value="in_progress">En curso</option><option value="completed">Completada</option><option value="blocked">Bloqueada</option></select></div>
      </div>
      <div style={fieldW}><label style={labelSt}>Notas</label><input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} /></div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button></div>
    </Dialog>
  );
}

function CreatePRDialog({ objectiveId, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', start_date: '', end_date: '', status: 'not_started', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try { await api.createPR({ ...form, objective_id: objectiveId }); onSaved(); onClose(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title="Nuevo Pull Request" onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Inicio</label><SpanishDateInput value={form.start_date} onChange={v => set('start_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Fin</label><SpanishDateInput value={form.end_date} onChange={v => set('end_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}><option value="not_started">No iniciado</option><option value="in_progress">En curso</option><option value="review">En review</option><option value="merged">Merged</option><option value="closed">Cerrado</option></select></div>
      </div>
      <div style={fieldW}><label style={labelSt}>Notas</label><input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} /></div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button></div>
    </Dialog>
  );
}

function CreateEventDialog({ objectiveId, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', start_date: '', end_date: '', status: 'not_started', format: 'online', location: '', estimated_cost: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (form.start_date && form.end_date && form.end_date < form.start_date) { setError('Fecha de fin no puede ser anterior a inicio'); return; }
    setSaving(true); setError('');
    try {
      await api.createEvent({
        ...form,
        objective_id: objectiveId,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : 0,
      });
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title="Nuevo evento" onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Inicio</label><SpanishDateInput value={form.start_date} onChange={v => set('start_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Fin</label><SpanishDateInput value={form.end_date} onChange={v => set('end_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}><option value="not_started">No iniciado</option><option value="in_progress">En curso</option><option value="completed">Completado</option><option value="cancelled">Cancelado</option></select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Formato</label><select value={form.format} onChange={e => set('format', e.target.value)} style={{ width: '100%' }}><option value="online">Online</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option></select></div>
        <div><label style={labelSt}>Lugar</label><input type="text" value={form.location} onChange={e => set('location', e.target.value)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Coste (€)</label><input type="number" min="0" step="0.01" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} style={{ width: '100%' }} /></div>
      </div>
      <div style={fieldW}><label style={labelSt}>Notas</label><input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} /></div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button></div>
    </Dialog>
  );
}

// ── Client item row (milestone/project) — expandable tasks ──────────────────
function ClientMilestoneRow({ m, kind = 'milestone', clientId, clientColor, onReload, newTaskFor, setNewTaskFor, version }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks,    setTasks]    = useState([]);
  const [editing,  setEditing]  = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const isMilestone = kind === 'milestone';
  const days = m.days_remaining ?? daysLeft(m.target_date);
  const cls  = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
  const dayLabel = days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d restantes`;
  const pct  = m.task_total > 0 ? Math.round((m.task_done / m.task_total) * 100) : null;

  async function fetchTasks() {
    const data = await api.tasks({ milestone_id: m.id });
    setTasks(data.sort((a, b) => a.date.localeCompare(b.date)));
  }

  useEffect(() => { if (expanded) fetchTasks(); }, [version]);

  async function toggle(e) {
    e.stopPropagation();
    if (!expanded) await fetchTasks();
    setExpanded(v => !v);
  }

  async function toggleTask(task) {
    if (!canCompleteTask(task)) return;
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns });
    await fetchTasks();
    onReload();
  }

  return (
    <>
      {editing && isMilestone && (
        <MilestoneDialog
          milestone={m}
          clientId={clientId}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onReload(); }}
        />
      )}
      {editingProject && !isMilestone && (
        <ProjectDialog
          project={m}
          clientId={clientId}
          onClose={() => setEditingProject(false)}
          onSaved={() => { setEditingProject(false); onReload(); }}
        />
      )}
      {editingTask && (
        <TaskModal
          initial={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={async () => {
            setEditingTask(null);
            await fetchTasks();
            onReload();
          }}
        />
      )}

      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer', flexWrap: 'wrap', gap: 6 }}
        onClick={toggle}>
        <span style={{ fontSize: 13 }}>{STATUS_ICONS[m.status] || '⚪'}</span>
        <div className="milestone-title" style={{ fontSize: 13, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{isMilestone ? m.title : `📦 ${m.title}`}</span>
            {!isMilestone && (
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>Proyecto</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {fmtDate(m.target_date)}{' '}{expanded ? '▲' : '▼'}
          </div>
          {pct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div className="progress-bar" style={{ flex: 1, maxWidth: 120, height: 4 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: clientColor }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{m.task_done}/{m.task_total} · {pct}%</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div className="milestone-date">{fmtShortDate(m.target_date)}</div>
          <div className={`milestone-days ${cls}`}>{dayLabel}</div>
        </div>
        {/* Billed amount badge */}
        {m.billed_amount > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
            background: '#dcfce7', color: '#15803d', whiteSpace: 'nowrap',
          }}>
            {fmtMoney(m.billed_amount)}
          </span>
        )}
      </div>

      {expanded && (
        <div
          style={{
            marginLeft: 24, marginBottom: 6, paddingLeft: 12,
            borderLeft: '2px solid var(--border)',
            minHeight: 32,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', gap: 8, padding: '0 0 8px', borderBottom: '1px dashed var(--border)', marginBottom: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => { e.stopPropagation(); setNewTaskFor({ id: m.id, objective_id: clientId }); }}
            >
              + Tarea
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => {
                e.stopPropagation();
                if (isMilestone) setEditing(true);
                else setEditingProject(true);
              }}
            >
              ✎ Editar hito
            </button>
          </div>
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>
              Sin tareas para este {isMilestone ? 'hito' : 'proyecto'}
            </div>
          ) : tasks.map(task => (
            <div
              key={task.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}
            >
              {canCompleteTask(task) ? (
                <div className={`task-check ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(task)}>
                  {task.status === 'completed' ? '✓' : ''}
                </div>
              ) : (
                <div style={{ width: 22, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditingTask(task)}>
                <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`} style={{ fontSize: 12 }}>{task.title}</div>
                <div className="task-meta">
                  <span className="task-time" style={{ fontSize: 10 }}>{fmtShortDate(task.date)}</span>
                  {task.start_time && <span className="task-time" style={{ fontSize: 10 }}>{task.start_time}</span>}
                  <CatBadge id={task.category_id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Client card ──────────────────────────────────────────────────────────────
function ClientCard({ client, onReload }) {
  const [expanded,    setExpanded]    = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [choosingMilestoneType, setChoosingMilestoneType] = useState(false);
  const [creatingKind, setCreatingKind] = useState(null);
  const [newTaskFor,  setNewTaskFor]  = useState(null);
  const [version,     setVersion]     = useState(0);
  const [projects,    setProjects]    = useState([]);

  const color = client.color || '#0ea5e9';
  const pct   = Math.round(client.percentage_completed || 0);
  const days  = client.days_remaining;

  useEffect(() => {
    if (!expanded) return;
    api.repos({ objective_id: client.id }).then(setProjects).catch(() => setProjects([]));
  }, [expanded, client.id, version]);

  // Sort milestones: incomplete by date asc, completed last
  const sortedItems = [
    ...(client.milestones || []).map(m => ({ ...m, _kind: 'milestone' })),
    ...(projects || []).map(p => ({ ...p, _kind: 'project' })),
  ].sort((a, b) => {
    const doneStatuses = ['completed', 'published', 'merged', 'closed', 'failed', 'cancelled'];
    const aDone = doneStatuses.includes(a.status) ? 1 : 0;
    const bDone = doneStatuses.includes(b.status) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (!a.target_date && !b.target_date) return 0;
    if (!a.target_date) return 1;
    if (!b.target_date) return -1;
    return a.target_date.localeCompare(b.target_date);
  });

  function handleTaskMoved() {
    setVersion(v => v + 1);
    onReload();
  }

  return (
    <div className="obj-card" onClick={() => setExpanded(v => !v)}>
      {editing && (
        <div onClick={e => e.stopPropagation()}>
          <ClientDialog client={client} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onReload(); }} />
        </div>
      )}
      {choosingMilestoneType && (
        <div onClick={e => e.stopPropagation()}>
          <MilestoneTypeDialog
            onClose={() => setChoosingMilestoneType(false)}
            onPick={(kind) => {
              setChoosingMilestoneType(false);
              setCreatingKind(kind);
            }}
          />
        </div>
      )}
      {creatingKind === 'classic' && (
        <div onClick={e => e.stopPropagation()}>
          <MilestoneDialog clientId={client.id} onClose={() => setCreatingKind(null)} onSaved={() => { setCreatingKind(null); onReload(); }} />
        </div>
      )}
      {creatingKind === 'repo' && (
        <div onClick={e => e.stopPropagation()}>
          <ProjectDialog
            clientId={client.id}
            onClose={() => setCreatingKind(null)}
            onSaved={() => {
              setCreatingKind(null);
              api.repos({ objective_id: client.id }).then(setProjects).catch(() => setProjects([]));
              onReload();
            }}
          />
        </div>
      )}
      {creatingKind === 'publication' && (
        <div onClick={e => e.stopPropagation()}>
          <CreatePublicationDialog
            objectiveId={client.id}
            onClose={() => setCreatingKind(null)}
            onSaved={() => { setCreatingKind(null); onReload(); }}
          />
        </div>
      )}
      {creatingKind === 'certification' && (
        <div onClick={e => e.stopPropagation()}>
          <CreateCertificationDialog
            objectiveId={client.id}
            onClose={() => setCreatingKind(null)}
            onSaved={() => { setCreatingKind(null); onReload(); }}
          />
        </div>
      )}
      {creatingKind === 'pr' && (
        <div onClick={e => e.stopPropagation()}>
          <CreatePRDialog
            objectiveId={client.id}
            onClose={() => setCreatingKind(null)}
            onSaved={() => { setCreatingKind(null); onReload(); }}
          />
        </div>
      )}
      {creatingKind === 'event' && (
        <div onClick={e => e.stopPropagation()}>
          <CreateEventDialog
            objectiveId={client.id}
            onClose={() => setCreatingKind(null)}
            onSaved={() => { setCreatingKind(null); onReload(); }}
          />
        </div>
      )}
      {newTaskFor && (
        <div onClick={e => e.stopPropagation()}>
          <TaskModal
            initial={{ objective_id: newTaskFor.objective_id, milestone_id: newTaskFor.id }}
            onClose={() => setNewTaskFor(null)}
            onSave={() => { setNewTaskFor(null); onReload(); }}
          />
        </div>
      )}

      {/* Header */}
      <div className="obj-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {client.notes && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{client.notes}</div>
          )}
          <div className="obj-title" style={{ color }}>👤 {client.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {days != null && <span className={`milestone-days ${days < 0 ? 'overdue' : days <= 14 ? 'soon' : 'ok'}`}>{days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}</span>}
            {client.end_date && <span className="task-time">{client.end_date}</span>}
            <span className="task-time">{client.task_count - client.done_count} tareas restantes</span>
          </div>
          {(() => { const ids = client.category_ids?.length ? client.category_ids : (client.category_id ? [client.category_id] : []); return ids.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><CategoryBadges ids={ids} keyPrefix={`${client.id}-`} /></div>; })()}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div className="obj-pct" style={{ color }}>{pct}%</div>
          {client.total_billed > 0 && (
            <div style={{ fontSize: 15, fontWeight: 700, color: '#15803d' }}>
              {fmtMoney(client.total_billed)}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {expanded ? '▲' : '▼'} {statusLabel(client.status)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: 12 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>

      {/* Expanded: milestones */}
      {expanded && (
        <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px', borderBottom: '1px dashed var(--border)', marginBottom: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setChoosingMilestoneType(true); }}>
              + Hito
            </button>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditing(true); }}>
              ✎ Editar cliente
            </button>
          </div>

          {sortedItems.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 12px' }}>Sin hitos ni proyectos</div>
          ) : sortedItems.map(m => (
            <ClientMilestoneRow
              key={`${m._kind}-${m.id}`}
              m={m}
              kind={m._kind}
              clientId={client.id}
              clientColor={color}
              onReload={() => { handleTaskMoved(); }}
              newTaskFor={newTaskFor}
              setNewTaskFor={setNewTaskFor}
              version={version}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────
export default function ClientsView() {
  const [clients,   setClients]   = useState([]);
  const [creating,  setCreating]  = useState(false);

  async function load() {
    api.objectives({ type: 'client' }).then(setClients);
  }

  useEffect(() => { load(); }, []);

  const totalBilled = clients.reduce((s, c) => s + (c.total_billed || 0), 0);
  const totalTasks  = clients.reduce((s, c) => s + (c.task_count  || 0), 0);
  const doneTasks   = clients.reduce((s, c) => s + (c.done_count  || 0), 0);
  const globalPct   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-subtitle">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''}
            {totalBilled > 0 && <> · Total facturado: <strong style={{ color: '#15803d' }}>{fmtMoney(totalBilled)}</strong></>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nuevo cliente</button>
      </div>

      {creating && (
        <ClientDialog
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}

      <ContentMetricsSummary
        title="Resumen de clientes"
        metrics={[
          { label: 'Clientes activos', value: clients.filter(c => c.status === 'in_progress').length, sub: `de ${clients.length} total` },
          { label: 'Total facturado', value: fmtMoney(totalBilled), sub: 'todos los clientes', valueStyle: { color: '#15803d', fontSize: 20 } },
          { label: 'Progreso tareas', value: `${globalPct}%`, sub: `${doneTasks}/${totalTasks} completadas`, valueStyle: { color: 'var(--accent)' } },
          { label: 'Hitos totales', value: clients.reduce((s, c) => s + (c.milestones?.length || 0), 0), sub: 'en todos los clientes' },
        ]}
      />

      {clients.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
          Sin clientes. Crea el primero con el botón "+ Nuevo cliente".
        </div>
      ) : (
        clients.map(client => <ClientCard key={client.id} client={client} onReload={load} />)
      )}
    </div>
  );
}
