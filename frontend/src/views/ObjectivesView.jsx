import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, fmtShortDate } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import CatBadge, { CategoryBadges, CategorySelector, ColorPicker } from '../components/CatBadge.jsx';
import TaskModal from '../components/TaskModal.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';
import { buildCertificationStatsMap, formatCertificationStats } from '../utils/certificationMetrics.js';
import { DetailDialog as PublicationDetailDialog } from './PublicationsView.jsx';
import { DetailDialog as CertificationDetailDialog } from './CertificationsView.jsx';
import { DetailDialog as RepoDetailDialog } from './ReposView.jsx';
import { DetailDialog as PRDetailDialog } from './PRsView.jsx';
import { DetailDialog as EventDetailDialog } from './EventsView.jsx';
import { canCompleteTask, isFixedTask } from '../utils/taskUtils.js';
import { PUBLICATION_TYPE_OPTIONS } from '../utils/publicationTypes.js';

const STATUS_ICONS = {
  not_started: '⚪',
  in_progress: '🔵',
  completed:   '✅',
  blocked:     '🔴',
};

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const fieldW = { marginBottom: 14 };

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

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

function ObjectiveDialog({ obj, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: obj?.title || '',
    description: obj?.description || '',
    category_ids: parseCatIds(obj?.category_ids, obj?.category_id),
    start_date: obj?.start_date || '',
    end_date: obj?.end_date || '',
    target_value: obj?.target_value || '',
    priority: obj?.priority ?? 2,
    status: obj?.status || 'not_started',
    notes: obj?.notes || '',
    color: obj?.color || '',
    type: obj?.type || 'objective',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      await api.updateObjective(obj.id, {
        ...form,
        priority: Number(form.priority),
        category_ids: form.category_ids,
        category_id: form.category_ids[0] || null,
        color: form.color || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={`Editar — ${obj.title}`} onClose={onClose}>
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
          <input type="text" value={form.target_value} onChange={e => set('target_value', e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Notas</label>
          <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Color de la barra de progreso</label>
        <ColorPicker value={form.color || '#2563eb'} onChange={v => set('color', v)} />
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Dialog>
  );
}

const MILESTONE_KIND_OPTS = [
  { value: 'classic', label: '🏁 Hito clásico' },
  { value: 'publication', label: '✍️ Publicación' },
  { value: 'certification', label: '🏆 Certificación' },
  { value: 'repo', label: '📦 Proyecto' },
  { value: 'pr', label: '🔀 Pull Request' },
  { value: 'event', label: '🎪 Evento' },
];

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

function CreateClassicMilestoneDialog({ objectiveId, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', description: '', target_date: '', status: 'not_started' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      await api.createMilestone({ ...form, objective_id: objectiveId });
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title="Nuevo hito" onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Fecha objetivo</label><SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} /></div>
        <div>
          <label style={labelSt}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
            <option value="not_started">No iniciado</option><option value="in_progress">En curso</option><option value="completed">Completado</option><option value="blocked">Bloqueado</option>
          </select>
        </div>
      </div>
      <div style={fieldW}><label style={labelSt}>Descripción</label><input type="text" value={form.description} onChange={e => set('description', e.target.value)} style={{ width: '100%' }} /></div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button></div>
    </Dialog>
  );
}

function CreatePublicationDialog({ objectiveId, item, onClose, onSaved }) {
  const isNew = !item;
  const [form, setForm] = useState({
    title: item?.title || '',
    date: item?.date || '',
    type: item?.type || 'idea',
    status: item?.status || 'pending',
    notes: item?.notes || '',
    publication_text: item?.publication_text || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const isIdea = form.type === 'idea';
      const payload = {
        ...form,
        date: isIdea ? null : (form.date || null),
        objective_id: isIdea ? null : objectiveId,
      };
      if (isNew) await api.createPublication(payload);
      else await api.updatePublication(item.id, payload);
      onSaved(); onClose();
    }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title={isNew ? 'Nueva publicación' : 'Editar publicación'} onClose={onClose}>
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : (isNew ? 'Crear' : 'Guardar')}</button></div>
    </Dialog>
  );
}

function CreateCertificationDialog({ objectiveId, item, onClose, onSaved }) {
  const isNew = !item;
  const [form, setForm] = useState({
    title: item?.title || '',
    target_date: item?.target_date || '',
    status: item?.status || 'not_started',
    notes: item?.notes || '',
    percentage_completed: item?.percentage_completed ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) await api.createCertification({ ...form, objective_id: objectiveId });
      else await api.updateCertification(item.id, { ...form, objective_id: objectiveId, percentage_completed: Number(form.percentage_completed) || 0 });
      onSaved(); onClose();
    }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title={isNew ? 'Nueva certificación' : 'Editar certificación'} onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Fecha objetivo</label><SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}><option value="not_started">No iniciado</option><option value="in_progress">En curso</option><option value="completed">Completada</option><option value="blocked">Bloqueada</option></select></div>
      </div>
      <div style={fieldW}><label style={labelSt}>Notas</label><input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} /></div>
      {!isNew && (
        <div style={fieldW}>
          <label style={labelSt}>% completado</label>
          <input type="range" min="0" max="100" step="5" value={form.percentage_completed} onChange={e => set('percentage_completed', Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : (isNew ? 'Crear' : 'Guardar')}</button></div>
    </Dialog>
  );
}

function CreateRepoDialog({ objectiveId, item, onClose, onSaved }) {
  const isNew = !item;
  const [form, setForm] = useState({
    title: item?.title || '',
    target_date: item?.target_date || '',
    type: item?.type || 'sangalan',
    status: item?.status || 'not_started',
    url: item?.url || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) await api.createRepo({ ...form, objective_id: objectiveId, url: form.url || null });
      else await api.updateRepo(item.id, { ...form, objective_id: objectiveId, url: form.url || null });
      onSaved(); onClose();
    }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title={isNew ? 'Nuevo proyecto' : 'Editar proyecto'} onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Tipo</label><select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%' }}><option value="client">Cliente</option><option value="sangalan">Sangalan</option><option value="personal">Personal</option></select></div>
        <div><label style={labelSt}>Fecha objetivo</label><SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}><option value="not_started">No iniciado</option><option value="in_progress">En desarrollo</option><option value="completed">Publicado ✓</option></select></div>
      </div>
      <div style={fieldW}><label style={labelSt}>URL GitHub</label><input type="url" value={form.url} onChange={e => set('url', e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} /></div>
      <div style={fieldW}><label style={labelSt}>Notas</label><input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} /></div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : (isNew ? 'Crear' : 'Guardar')}</button></div>
    </Dialog>
  );
}

function CreatePRDialog({ objectiveId, item, onClose, onSaved }) {
  const isNew = !item;
  const [form, setForm] = useState({
    title: item?.title || '',
    start_date: item?.start_date || '',
    end_date: item?.end_date || '',
    status: item?.status || 'not_started',
    notes: item?.notes || '',
    percentage_completed: item?.percentage_completed ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) await api.createPR({ ...form, objective_id: objectiveId });
      else await api.updatePR(item.id, { ...form, objective_id: objectiveId, percentage_completed: Number(form.percentage_completed) || 0 });
      onSaved(); onClose();
    }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title={isNew ? 'Nuevo Pull Request' : 'Editar Pull Request'} onClose={onClose}>
      <div style={fieldW}><label style={labelSt}>Título *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={labelSt}>Inicio</label><SpanishDateInput value={form.start_date} onChange={v => set('start_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Fin</label><SpanishDateInput value={form.end_date} onChange={v => set('end_date', v)} style={{ width: '100%' }} /></div>
        <div><label style={labelSt}>Estado</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}><option value="not_started">No iniciado</option><option value="in_progress">En curso</option><option value="review">En review</option><option value="merged">Merged</option><option value="closed">Cerrado</option></select></div>
      </div>
      <div style={fieldW}><label style={labelSt}>Notas</label><input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%' }} /></div>
      {!isNew && (
        <div style={fieldW}>
          <label style={labelSt}>% completado</label>
          <input type="range" min="0" max="100" step="5" value={form.percentage_completed} onChange={e => set('percentage_completed', Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : (isNew ? 'Crear' : 'Guardar')}</button></div>
    </Dialog>
  );
}

function CreateEventDialog({ objectiveId, item, onClose, onSaved }) {
  const isNew = !item;
  const [form, setForm] = useState({
    title: item?.title || '',
    start_date: item?.start_date || '',
    end_date: item?.end_date || '',
    status: item?.status || 'not_started',
    format: item?.format || 'online',
    location: item?.location || '',
    estimated_cost: item?.estimated_cost || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }
  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (form.start_date && form.end_date && form.end_date < form.start_date) { setError('Fecha de fin no puede ser anterior a inicio'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) {
        await api.createEvent({
          ...form,
          objective_id: objectiveId,
          estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : 0,
        });
      } else {
        await api.updateEvent(item.id, {
          ...form,
          objective_id: objectiveId,
          estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : 0,
        });
      }
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog title={isNew ? 'Nuevo evento' : 'Editar evento'} onClose={onClose}>
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : (isNew ? 'Crear' : 'Guardar')}</button></div>
    </Dialog>
  );
}


function SinHitoRow({ objId, orphanCount, orphanDone, onUpdate, onTaskMoved, version }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);

  async function fetchTasks() {
    const data = await api.tasks({ objective_id: objId, no_milestone: '1' });
    setTasks(data.sort((a, b) => a.date.localeCompare(b.date)));
  }

  useEffect(() => {
    if (expanded) fetchTasks();
  }, [version]);

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
    onUpdate();
  }

  const pct = orphanCount > 0 ? Math.round((orphanDone / orphanCount) * 100) : 0;

  return (
    <>
      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer', flexWrap: 'wrap', gap: 6, opacity: 0.85 }} onClick={toggle}>
        <span style={{ fontSize: 13 }}>⚫</span>
        <div className="milestone-title" style={{ fontSize: 13 }}>
          <span style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>Sin Hito</span>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {orphanCount} tarea{orphanCount !== 1 ? 's' : ''} sin hito asignado
            {' '}{expanded ? '▲' : '▼'}
          </div>
          {orphanCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div className="progress-bar" style={{ flex: 1, maxWidth: 120, height: 4 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--text-3)' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{orphanDone}/{orphanCount} · {pct}%</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginLeft: 24, marginBottom: 6, paddingLeft: 12,
            borderLeft: '2px dashed var(--border)',
            minHeight: 32,
          }}
          onClick={e => e.stopPropagation()}
        >
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Sin tareas</div>
          ) : tasks.map(task => (
            <div
              key={task.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}
            >
              {canCompleteTask(task) ? (
                <div
                  className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
                  onClick={() => toggleTask(task)}
                >
                  {task.status === 'completed' ? '✓' : ''}
                </div>
              ) : (
                <div style={{ width: 22, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditingTask(task)}>
                <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`} style={{ fontSize: 12 }}>
                  {task.title}
                </div>
                <div className="task-meta">
                  <span className="task-time" style={{ fontSize: 10 }}>{fmtShortDate(task.date)}</span>
                  {task.start_time && <span className="task-time" style={{ fontSize: 10 }}>{task.start_time}</span>}
                  <CatBadge id={task.category_id} />
                </div>
              </div>
            </div>
          ))}
          {editingTask && (
            <TaskModal
              initial={editingTask}
              onClose={() => setEditingTask(null)}
              onSave={async () => {
                setEditingTask(null);
                await fetchTasks();
                onUpdate();
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

const LINKED_STATUS_ICONS = {
  not_started: '⚪', in_progress: '🔵', completed: '✅', published: '✅',
  merged: '✅', closed: '🔴', failed: '🔴', review: '🟡', pending: '⚪', draft: '🔵',
  cancelled: '🔴',
};

const LINKED_STATUS_LABELS = {
  not_started: 'No iniciado', in_progress: 'En progreso', completed: 'Completado',
  published: 'Publicado', merged: 'Merged', closed: 'Cerrada',
  failed: 'Fallida', review: 'En review', pending: 'Pendiente', draft: 'Borrador',
  cancelled: 'Cancelado',
};

function daysLeft(dateStr) {
  if (!dateStr) return 9999;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(dateStr + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
}

function EditClassicMilestoneDialog({ milestone, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: milestone?.title || '',
    description: milestone?.description || '',
    target_date: milestone?.date || milestone?.target_date || '',
    status: milestone?.status || 'not_started',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      await api.updateMilestone(milestone.id, {
        title: form.title,
        description: form.description,
        target_date: form.target_date || null,
        status: form.status,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Editar hito" onClose={onClose}>
      <div style={fieldW}>
        <label style={labelSt}>Título *</label>
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
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
      </div>
      <div style={fieldW}>
        <label style={labelSt}>Descripción</label>
        <input type="text" value={form.description} onChange={e => set('description', e.target.value)} style={{ width: '100%' }} />
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Dialog>
  );
}

// Unified row for both simple milestones and content items (pubs, certs, repos, prs, events)
function AnyMilestoneRow({ item, objectives, onUpdate, onAddTask, onTaskMoved, version }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [editingMilestone, setEditingMilestone] = useState(false);
  const [editingLinked, setEditingLinked] = useState(false);

  const days = item.days_remaining ?? daysLeft(item.date);
  const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
  const dayLabel = days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d restantes`;
  const isSimple = item.type === 'milestone';

  async function fetchTasks() {
    const data = await api.tasks({ milestone_id: item.id });
    setTasks(data.sort((a, b) => a.date.localeCompare(b.date)));
  }

  useEffect(() => { if (expanded) fetchTasks(); }, [version]);

  async function toggleExpanded(e) {
    e.stopPropagation();
    if (!expanded) await fetchTasks();
    setExpanded(v => !v);
  }

  async function toggleTask(task) {
    if (!canCompleteTask(task)) return;
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns });
    await fetchTasks();
    onUpdate();
  }

  const pct = item.task_total > 0 ? Math.round((item.task_done / item.task_total) * 100) : null;
  const certStatsLabel = item.type === 'certification' ? formatCertificationStats(item.certStats) : '';

  return (
    <>
      {editingMilestone && isSimple && (
        <EditClassicMilestoneDialog
          milestone={item}
          onClose={() => setEditingMilestone(false)}
          onSaved={() => { setEditingMilestone(false); onUpdate(); }}
        />
      )}
      {editingLinked && item.type === 'publication' && (
        <PublicationDetailDialog
          pub={item}
          objectives={objectives}
          onClose={() => setEditingLinked(false)}
          onSaved={() => { setEditingLinked(false); onUpdate(); }}
          onDeleted={() => { setEditingLinked(false); onUpdate(); }}
        />
      )}
      {editingLinked && item.type === 'certification' && (
        <CertificationDetailDialog
          cert={item}
          objectives={objectives}
          onClose={() => setEditingLinked(false)}
          onSaved={() => { setEditingLinked(false); onUpdate(); }}
          onDeleted={() => { setEditingLinked(false); onUpdate(); }}
        />
      )}
      {editingLinked && item.type === 'repo' && (
        <RepoDetailDialog
          repo={item}
          objectives={objectives}
          onClose={() => setEditingLinked(false)}
          onSaved={() => { setEditingLinked(false); onUpdate(); }}
          onDeleted={() => { setEditingLinked(false); onUpdate(); }}
        />
      )}
      {editingLinked && item.type === 'pr' && (
        <PRDetailDialog
          pr={item}
          objectives={objectives}
          onClose={() => setEditingLinked(false)}
          onSaved={() => { setEditingLinked(false); onUpdate(); }}
          onDeleted={() => { setEditingLinked(false); onUpdate(); }}
        />
      )}
      {editingLinked && item.type === 'event' && (
        <EventDetailDialog
          event={item}
          objectives={objectives}
          onClose={() => setEditingLinked(false)}
          onSaved={() => { setEditingLinked(false); onUpdate(); }}
          onDeleted={() => { setEditingLinked(false); onUpdate(); }}
        />
      )}
      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer', flexWrap: 'wrap', gap: 6 }} onClick={toggleExpanded}>
        <span style={{ fontSize: 13 }}>{isSimple ? (STATUS_ICONS[item.status] || '⚪') : (LINKED_STATUS_ICONS[item.status] || '⚪')}</span>
        <div className="milestone-title" style={{ fontSize: 13 }}>
          <span>{item.title}</span>
          {item.icon && <span style={{ marginLeft: 4 }}>{item.icon}</span>}
          {certStatsLabel && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)' }}>{certStatsLabel}</span>}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {fmtDate(item.date)}{' '}{expanded ? '▲' : '▼'}
          </div>
          {pct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div className="progress-bar" style={{ flex: 1, maxWidth: 120, height: 4 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.task_done}/{item.task_total} · {pct}%</span>
            </div>
          )}
        </div>
        <div>
          <div className="milestone-date">{fmtShortDate(item.date)}</div>
          <div className={`milestone-days ${cls}`}>{dayLabel}</div>
        </div>
        {!isSimple && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', background: 'var(--bg)', color: 'var(--text-2)' }}>
            {LINKED_STATUS_LABELS[item.status] || item.status}
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
              onClick={e => { e.stopPropagation(); onAddTask(item); }}
            >
              + Tarea
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => {
                e.stopPropagation();
                if (isSimple) setEditingMilestone(true);
                else setEditingLinked(true);
              }}
            >
              ✎ Editar hito
            </button>
          </div>
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Sin tareas para este hito</div>
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
                  <CatBadge id={task.category_id} style={{ fontSize: 10 }} />
                </div>
              </div>
            </div>
          ))}
          {editingTask && (
            <TaskModal
              initial={editingTask}
              onClose={() => setEditingTask(null)}
              onSave={async () => {
                setEditingTask(null);
                await fetchTasks();
                onUpdate();
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

function ObjectiveCard({ obj, objectives, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [newTaskFor, setNewTaskFor] = useState(null); // milestone-like object
  const [mvVersion, setMvVersion] = useState(0);
  const [contentItems, setContentItems] = useState([]);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const [editingObjective, setEditingObjective] = useState(false);
  const [choosingMilestoneType, setChoosingMilestoneType] = useState(false);
  const [creatingKind, setCreatingKind] = useState(null);
  const color = obj.color || '#2563eb';

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setContentLoaded(false);
    Promise.all([
      api.certifications({ objective_id: obj.id }),
      api.repos({ objective_id: obj.id }),
      api.prs({ objective_id: obj.id }),
      api.publications({ objective_id: obj.id }),
      api.events({ objective_id: obj.id }),
      api.tasks({ objective_id: obj.id }),
    ]).then(([certs, repos, prs, pubs, evts, objectiveTasks]) => {
      if (cancelled) return;
      const certStatsById = buildCertificationStatsMap(certs, objectiveTasks);
      setContentItems([
        ...certs.map(c => ({ ...c, type: 'certification', icon: '🏆', date: c.target_date, certStats: certStatsById[c.id] })),
        ...repos.map(r => ({ ...r, type: 'repo',          icon: '📦', date: r.target_date })),
        ...prs.map(p =>   ({ ...p, type: 'pr',            icon: '🔀', date: p.end_date })),
        ...pubs.map(p =>  ({ ...p, type: 'publication',   icon: '✍️',  date: p.date })),
        ...evts
          .filter(e => e.status !== 'cancelled')
          .map(e =>  ({ ...e, type: 'event',         icon: '🎪', date: e.end_date || e.start_date })),
      ]);
      setContentLoaded(true);
    });
    return () => { cancelled = true; };
  }, [expanded, obj.id, contentRefreshKey]);

  function handleUpdateAndRefresh() {
    setContentRefreshKey(v => v + 1);
    onUpdate();
  }

  function handleTaskMoved() {
    setMvVersion(v => v + 1);
    onUpdate();
  }

  // Merge simple milestones + content items, sorted by date ascending (nulls last), completed last
  const allMilestones = [
    ...(obj.milestones || []).map(m => ({ ...m, type: 'milestone', icon: null })),
    ...contentItems,
  ].sort((a, b) => {
    const aDone = ['completed', 'published', 'merged', 'closed', 'failed', 'cancelled'].includes(a.status) ? 1 : 0;
    const bDone = ['completed', 'published', 'merged', 'closed', 'failed', 'cancelled'].includes(b.status) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  const pct = Math.round(obj.percentage_completed || 0);
  const days = obj.days_remaining;

  return (
    <div className="obj-card" onClick={() => setExpanded(v => !v)}>
      {editingObjective && (
        <div onClick={e => e.stopPropagation()}>
          <ObjectiveDialog
            obj={obj}
            onClose={() => setEditingObjective(false)}
            onSaved={() => { setEditingObjective(false); handleUpdateAndRefresh(); }}
          />
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
          <CreateClassicMilestoneDialog
            objectiveId={obj.id}
            onClose={() => setCreatingKind(null)}
            onSaved={handleUpdateAndRefresh}
          />
        </div>
      )}
      {creatingKind === 'publication' && (
        <div onClick={e => e.stopPropagation()}>
          <CreatePublicationDialog
            objectiveId={obj.id}
            onClose={() => setCreatingKind(null)}
            onSaved={handleUpdateAndRefresh}
          />
        </div>
      )}
      {creatingKind === 'certification' && (
        <div onClick={e => e.stopPropagation()}>
          <CreateCertificationDialog
            objectiveId={obj.id}
            onClose={() => setCreatingKind(null)}
            onSaved={handleUpdateAndRefresh}
          />
        </div>
      )}
      {creatingKind === 'repo' && (
        <div onClick={e => e.stopPropagation()}>
          <CreateRepoDialog
            objectiveId={obj.id}
            onClose={() => setCreatingKind(null)}
            onSaved={handleUpdateAndRefresh}
          />
        </div>
      )}
      {creatingKind === 'pr' && (
        <div onClick={e => e.stopPropagation()}>
          <CreatePRDialog
            objectiveId={obj.id}
            onClose={() => setCreatingKind(null)}
            onSaved={handleUpdateAndRefresh}
          />
        </div>
      )}
      {creatingKind === 'event' && (
        <div onClick={e => e.stopPropagation()}>
          <CreateEventDialog
            objectiveId={obj.id}
            onClose={() => setCreatingKind(null)}
            onSaved={handleUpdateAndRefresh}
          />
        </div>
      )}

      <div className="obj-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {obj.target_value && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{obj.target_value}</div>
          )}
          <div className="obj-title">{obj.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className={`milestone-days ${days < 0 ? 'overdue' : days <= 14 ? 'soon' : 'ok'}`}>{days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}</span>
            {obj.end_date && <span className="task-time">{obj.end_date}</span>}
            <span className="task-time">{obj.task_count - obj.done_count} tareas restantes</span>
          </div>
          {(() => { const ids = obj.category_ids?.length ? obj.category_ids : (obj.category_id ? [obj.category_id] : []); return ids.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><CategoryBadges ids={ids} keyPrefix={`${obj.id}-`} /></div>; })()}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div className="obj-pct" style={{ color }}>{pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {expanded ? '▲' : '▼'} {statusLabel(obj.status)}
          </div>
        </div>
      </div>

      <div className="progress-bar" style={{ marginBottom: 12 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>

      {newTaskFor && (
        <div onClick={e => e.stopPropagation()}>
          <TaskModal
            initial={{ objective_id: obj.id, milestone_id: newTaskFor.id }}
            onClose={() => setNewTaskFor(null)}
            onSave={() => { setNewTaskFor(null); handleUpdateAndRefresh(); }}
          />
        </div>
      )}

      {/* All milestones (simple + content items) sorted by date */}
      {expanded && (
        <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px', borderBottom: '1px dashed var(--border)', marginBottom: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => { e.stopPropagation(); setChoosingMilestoneType(true); }}
            >
              + Hito
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => { e.stopPropagation(); setEditingObjective(true); }}
            >
              ✎ Editar Objetivo
            </button>
          </div>
          {!contentLoaded && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 12px' }}>Cargando hitos…</div>
          )}
          {contentLoaded && allMilestones.length === 0 && obj.orphan_count === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 12px' }}>Sin hitos</div>
          )}
          {contentLoaded && allMilestones.map(item => (
            <AnyMilestoneRow
              key={item.id}
              item={item}
              objectives={objectives}
              onUpdate={handleUpdateAndRefresh}
              onAddTask={setNewTaskFor}
              onTaskMoved={handleTaskMoved}
              version={mvVersion}
            />
          ))}
          {contentLoaded && obj.orphan_count > 0 && (
            <SinHitoRow
              objId={obj.id}
              orphanCount={obj.orphan_count}
              orphanDone={obj.orphan_done}
              onUpdate={handleUpdateAndRefresh}
              onTaskMoved={handleTaskMoved}
              version={mvVersion}
            />
          )}
        </div>
      )}

    </div>
  );
}

export default function ObjectivesView() {
  const [objectives, setObjectives] = useState([]);

  async function loadAll() {
    const [objectivesData, events, tasks] = await Promise.all([
      api.objectives(),
      api.events(),
      api.tasks(),
    ]);

    const cancelledEventIds = new Set(
      events.filter(e => e.status === 'cancelled').map(e => e.id)
    );
    const effectiveObjectives = objectivesData.map(obj => {
      const objectiveTasks = tasks.filter(
        t => t.objective_id === obj.id && !isFixedTask(t) && !cancelledEventIds.has(t.milestone_id)
      );
      const taskCount = objectiveTasks.length;
      const doneCount = objectiveTasks.filter(t => t.status === 'completed').length;
      const percentageCompleted = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
      return {
        ...obj,
        task_count: taskCount,
        done_count: doneCount,
        percentage_completed: percentageCompleted,
      };
    });

    setObjectives(effectiveObjectives);
  }

  useEffect(() => { loadAll(); }, []);

  const totalTasks = objectives.reduce((s, o) => s + (o.task_count || 0), 0);
  const doneTasks  = objectives.reduce((s, o) => s + (o.done_count  || 0), 0);
  const globalPct  = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Objetivos e hitos</div>
          <div className="page-subtitle">Progreso global: {globalPct}% — Q2 2026</div>
        </div>
      </div>

      {/* Global progress */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>Progreso global del plan</span>
          <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 18 }}>{globalPct}%</span>
        </div>
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <div className="progress-bar" style={{ height: 10 }}>
            <div className="progress-fill" style={{ width: `${globalPct}%`, background: '#16a34a' }} />
          </div>
          <div style={{
            position: 'absolute',
            top: '10%',
            left: `${globalPct}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: 18,
            lineHeight: 1,
            transition: 'left 0.6s ease',
            pointerEvents: 'none',
          }}>🐌</div>
        </div>
      </div>

      {objectives.map(obj => <ObjectiveCard key={obj.id} obj={obj} objectives={objectives} onUpdate={loadAll} />)}
    </div>
  );
}
