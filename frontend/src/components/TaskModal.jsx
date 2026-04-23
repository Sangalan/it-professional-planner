import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CategorySelector } from './CatBadge.jsx';
import SpanishDateInput from './SpanishDateInput.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';
import { getEditableTaskStatuses } from '../utils/taskUtils.js';
import { getPublicationTypeMeta } from '../utils/publicationTypes.js';

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

export default function TaskModal({ initial = {}, onSave, onClose, onDeleted }) {
  useEscapeClose(onClose);
  const isEdit = !!initial.id;
  const openedInstanceDate = initial.date || initial.fixed_start_date || '';
  const canCloneRecurringTask = isEdit && Number(initial.is_fixed) === 1;
  const normalizedFixedDays = (() => {
    const raw = initial.fixed_days;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (_) {}
    }
    return [];
  })();
  const [form, setForm] = useState({
    title: '', description: '', date: '', start_time: '', end_time: '',
    priority: 2, objective_id: '', milestone_id: '', is_fixed: false,
    fixed_start_date: '', fixed_end_date: '',
    notes: '', status: 'pending',
    isCloned: !!initial.isCloned || !!initial.is_cloned,
    clonedFrom: initial.clonedFrom || initial.cloned_from || null,
    ...initial,
    category_ids: parseCatIds(initial.category_ids, initial.category_id),
    fixed_days: normalizedFixedDays,
  });
  const [objectives, setObjectives] = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [fixedSectionCollapsed, setFixedSectionCollapsed] = useState(true);

  useEffect(() => {
    api.objectives().then(setObjectives);
    api.milestones().then(setAllMilestones);
    Promise.all([
      api.publications(),
      api.certifications(),
      api.repos(),
      api.prs(),
    api.events(),
    ]).then(([pubs, certs, repos, prs, events]) => {
      setAllContent([
        ...pubs.map(p  => ({ id: p.id,  title: p.title  + ` ${getPublicationTypeMeta(p.type).icon}`,  objective_id: p.objective_id })),
        ...certs.map(c => ({ id: c.id,  title: c.title  + ' 🏆',  objective_id: c.objective_id })),
        ...repos.map(r => ({ id: r.id,  title: r.title  + ' 📦',  objective_id: r.objective_id })),
        ...prs.map(p   => ({ id: p.id,  title: p.title  + ' 🔀',  objective_id: p.objective_id })),
        ...events.map(e => ({ id: e.id, title: e.title + ' 🎪', objective_id: e.objective_id })),
      ]);
    });
  }, []);

  useEffect(() => {
    if (!form.is_fixed) return;
    setFixedSectionCollapsed(true);
  }, [form.is_fixed]);

  const milestones = [
    ...allMilestones.filter(m => m.objective_id === form.objective_id),
    ...allContent.filter(c => c.objective_id === form.objective_id),
  ];
  const selectedMilestone = [...allMilestones, ...allContent].find(m => m.id === form.milestone_id);
  if (selectedMilestone && !milestones.some(m => m.id === selectedMilestone.id)) {
    milestones.push(selectedMilestone);
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function buildTaskPayload({ cloneAsRegular = false } = {}) {
    const isFixedTask = cloneAsRegular ? false : !!form.is_fixed;
    const effectiveDate = cloneAsRegular
      ? (openedInstanceDate || form.date || form.fixed_start_date || '')
      : form.date;

    return {
      title:        form.title.trim(),
      description:  form.description || '',
      category_ids: form.category_ids,
      category_id:  form.category_ids[0] || null,
      date:         effectiveDate,
      start_time:   form.start_time || null,
      end_time:     form.end_time || null,
      priority:     Number(form.priority),
      objective_id: form.objective_id || null,
      milestone_id: form.milestone_id || null,
      is_fixed:     isFixedTask ? 1 : 0,
      fixed_days:        isFixedTask ? form.fixed_days : null,
      fixed_start_date:  isFixedTask ? (form.fixed_start_date || null) : null,
      fixed_end_date:    isFixedTask ? (form.fixed_end_date || null) : null,
      notes:        form.notes || '',
      status:       form.status || 'pending',
      isCloned:     cloneAsRegular ? true : !!(form.isCloned || form.is_cloned),
      clonedFrom:   cloneAsRegular ? initial.id : (form.clonedFrom || form.cloned_from || null),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (!form.is_fixed && !form.date) { setError('La fecha es obligatoria'); return; }
    if (form.is_fixed && form.fixed_days.length === 0) { setError('Selecciona al menos un día de la semana'); return; }
    if (form.is_fixed && !form.fixed_start_date) { setError('La fecha de inicio es obligatoria para tareas fijas'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = buildTaskPayload();
      if (isEdit) {
        await api.updateTask(initial.id, payload);
      } else {
        await api.createTask(payload);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCloneAsNewTask() {
    if (!canCloneRecurringTask) return;
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    const cloneDate = openedInstanceDate || form.date || form.fixed_start_date;
    if (!cloneDate) { setError('No se pudo determinar la fecha de la nueva tarea'); return; }
    setCloning(true);
    setError('');
    try {
      await api.createTask(buildTaskPayload({ cloneAsRegular: true }));
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setCloning(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: 20,
      }}
     
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 12,
        padding: 28, maxWidth: 520, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>
            {isEdit ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Nombre de la tarea"
              style={{ width: '100%' }}
              autoFocus
            />
          </div>

          {/* Date + times */}
          <div style={{ display: 'grid', gridTemplateColumns: form.is_fixed ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {!form.is_fixed && (
              <div>
                <label style={labelStyle}>Fecha *</label>
                <SpanishDateInput value={form.date} onChange={v => set('date', v)} style={{ width: '100%' }} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Hora inicio</label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Hora fin</label>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* Categories */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Categorías</label>
            <CategorySelector selected={form.category_ids} onChange={ids => set('category_ids', ids)} />
          </div>

          {/* Objective + Priority + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: isEdit ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Objetivo</label>
              <select value={form.objective_id}
                onChange={e => { set('objective_id', e.target.value); set('milestone_id', ''); }}
                style={{ width: '100%' }}>
                <option value="">Sin objetivo</option>
                {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Prioridad</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} style={{ width: '100%' }}>
                <option value={1}>Alta ★</option>
                <option value={2}>Normal</option>
                <option value={3}>Baja</option>
              </select>
            </div>

            {isEdit && (
              <div>
                <label style={labelStyle}>Estado</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
                  {getEditableTaskStatuses(form).map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Milestone + Fixed */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, marginBottom: 14, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Hito</label>
              <select value={form.milestone_id} onChange={e => set('milestone_id', e.target.value)} style={{ width: '100%' }}
                disabled={!form.objective_id || milestones.length === 0}>
                <option value="">Sin hito</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 7, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={!!form.is_fixed} onChange={e => set('is_fixed', e.target.checked)} />
                Tarea fija 📌
              </label>
            </div>
          </div>

          {/* Fixed task recurrence options */}
          {!!form.is_fixed && (
            <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setFixedSectionCollapsed(v => !v)}
                style={{ marginBottom: fixedSectionCollapsed ? 0 : 12, border: 'none', padding: 0, fontWeight: 600 }}
              >
                {fixedSectionCollapsed ? '▸' : '▾'} Días de la semana
              </button>
              {!fixedSectionCollapsed && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[
                      { day: 1, label: 'Lun' }, { day: 2, label: 'Mar' }, { day: 3, label: 'Mié' },
                      { day: 4, label: 'Jue' }, { day: 5, label: 'Vie' }, { day: 6, label: 'Sáb' },
                      { day: 0, label: 'Dom' },
                    ].map(({ day, label }) => {
                      const active = form.fixed_days.includes(day);
                      return (
                        <span key={day} onClick={() => {
                          set('fixed_days', active
                            ? form.fixed_days.filter(d => d !== day)
                            : [...form.fixed_days, day]);
                        }} style={{
                          cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 8,
                          background: active ? 'var(--accent)' : 'var(--surface)',
                          color: active ? 'white' : 'var(--text-2)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          fontWeight: active ? 600 : 400, userSelect: 'none',
                        }}>
                          {label}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Fecha inicio</label>
                      <SpanishDateInput value={form.fixed_start_date} onChange={v => set('fixed_start_date', v)} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Fecha fin</label>
                      <SpanishDateInput value={form.fixed_end_date} onChange={v => set('fixed_end_date', v)} style={{ width: '100%' }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Descripción</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Detalles opcionales…"
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>

          {/* Notes */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Notas</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Notas rápidas…" style={{ width: '100%' }} />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10, padding: '6px 10px', background: 'var(--danger-bg)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            {isEdit ? (
              <button type="button" className="btn btn-ghost" disabled={deleting}
                style={{ color: '#dc2626', borderColor: '#dc2626' }}
                onClick={async () => {
                  if (!confirm('¿Eliminar esta tarea?')) return;
                  setDeleting(true);
                  const r = await api.deleteTask(initial.id);
                  setDeleting(false);
                  if (r.error) { setError(r.error); return; }
                  (onDeleted || onSave)();
                }}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              {canCloneRecurringTask && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: '#dc2626', borderColor: '#dc2626' }}
                  onClick={handleCloneAsNewTask}
                  disabled={saving || cloning}
                >
                  {cloning ? 'Creando…' : 'Clonar'}
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const fieldWrap = { marginBottom: 14 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
