import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, fmtShortDate } from '../utils/dateUtils.js';
import { statusLabel } from '../utils/categoryUtils.js';
import CatBadge, { CategorySelector, ColorPicker } from '../components/CatBadge.jsx';
import TaskModal from '../components/TaskModal.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';

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

const STATUS_ICONS = { not_started: '⚪', in_progress: '🔵', completed: '✅', blocked: '🔴' };

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
function ProjectDialog({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    target_date: '',
    status: 'not_started',
    url: '',
    notes: '',
  });
  const [catIds, setCatIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createRepo({
        ...form,
        objective_id: clientId,
        url: form.url || null,
        category_ids: catIds,
        category_id: catIds[0] || null,
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
    <Dialog title="Nuevo proyecto" onClose={onClose}>
      <div style={fieldW}>
        <label style={labelSt}>Título *</label>
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>
          {saving ? 'Guardando…' : 'Crear proyecto'}
        </button>
      </div>
    </Dialog>
  );
}

// ── Milestone row — expandable tasks, drag-drop, billed_amount ───────────────
function ClientMilestoneRow({ m, clientId, clientColor, onReload, newTaskFor, setNewTaskFor, version }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks,    setTasks]    = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [editing,  setEditing]  = useState(false);

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
    const ns = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: ns });
    await fetchTasks();
    onReload();
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    await api.updateTask(taskId, { milestone_id: m.id });
    await fetchTasks();
    onReload();
  }

  return (
    <>
      {editing && (
        <MilestoneDialog
          milestone={m}
          clientId={clientId}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onReload(); }}
        />
      )}

      <div className="milestone-row" style={{ paddingLeft: 12, cursor: 'pointer', flexWrap: 'wrap', gap: 6 }}
        onClick={toggle}>
        <span style={{ fontSize: 13 }}>{STATUS_ICONS[m.status] || '⚪'}</span>
        <div className="milestone-title" style={{ fontSize: 13, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{m.title}</span>
            <button
              onClick={e => { e.stopPropagation(); setEditing(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-3)', padding: '0 4px' }}
            >✎</button>
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
            borderLeft: `2px solid ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            background: dragOver ? 'var(--accent-bg, #eff6ff)' : 'transparent',
            borderRadius: dragOver ? 6 : 0,
            transition: 'background 0.15s, border-color 0.15s',
            minHeight: 32,
          }}
          onClick={e => e.stopPropagation()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={handleDrop}
        >
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>
              Sin tareas para este hito ·{' '}
              <span
                style={{ textDecoration: 'underline', cursor: 'pointer', color: 'var(--accent)' }}
                onClick={e => { e.stopPropagation(); setNewTaskFor({ id: m.id, objective_id: clientId }); }}
              >
                Añadir tarea
              </span>
            </div>
          ) : tasks.map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('taskId', task.id); e.dataTransfer.effectAllowed = 'move'; }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'grab' }}
            >
              <div className={`task-check ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(task)}>
                {task.status === 'completed' ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
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
  const [addMs,       setAddMs]       = useState(false);
  const [addProject,  setAddProject]  = useState(false);
  const [newTaskFor,  setNewTaskFor]  = useState(null);
  const [version,     setVersion]     = useState(0);

  const color = client.color || '#0ea5e9';
  const pct   = Math.round(client.percentage_completed || 0);
  const days  = client.days_remaining;

  // Sort milestones: incomplete by date asc, completed last
  const sortedMs = [...(client.milestones || [])].sort((a, b) => {
    const aDone = a.status === 'completed' ? 1 : 0;
    const bDone = b.status === 'completed' ? 1 : 0;
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
      {addMs && (
        <div onClick={e => e.stopPropagation()}>
          <MilestoneDialog clientId={client.id} onClose={() => setAddMs(false)} onSaved={() => { setAddMs(false); onReload(); }} />
        </div>
      )}
      {addProject && (
        <div onClick={e => e.stopPropagation()}>
          <ProjectDialog clientId={client.id} onClose={() => setAddProject(false)} onSaved={() => { setAddProject(false); onReload(); }} />
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
          {(() => { const ids = client.category_ids?.length ? client.category_ids : (client.category_id ? [client.category_id] : []); return ids.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{ids.map(id => <CatBadge key={id} id={id} />)}</div>; })()}
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
          {sortedMs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 12px' }}>Sin hitos</div>
          ) : sortedMs.map(m => (
            <ClientMilestoneRow
              key={m.id}
              m={m}
              clientId={client.id}
              clientColor={color}
              onReload={() => { handleTaskMoved(); }}
              newTaskFor={newTaskFor}
              setNewTaskFor={setNewTaskFor}
              version={version}
            />
          ))}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px 4px', borderTop: '1px dashed var(--border)', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setAddMs(true); }}>
              + Hito
            </button>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setAddProject(true); }}>
              + Proyecto
            </button>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditing(true); }}>
              ✎ Editar cliente
            </button>
          </div>
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
