import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function parseCatIds(raw, fallback) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (_) {}
  }
  return fallback ? [fallback] : [];
}

export default function TaskModal({ initial = {}, onSave, onClose }) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState({
    title: '', description: '', date: '', start_time: '', end_time: '',
    priority: 2, objective_id: '', milestone_id: '', is_fixed: false, notes: '', label: '', status: 'pending',
    ...initial,
    category_ids: parseCatIds(initial.category_ids, initial.category_id),
  });
  const [categories, setCategories] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.categories().then(setCategories);
    api.objectives().then(setObjectives);
    api.milestones().then(setAllMilestones);
    Promise.all([
      api.publications(),
      api.certifications(),
      api.repos(),
      api.prs(),
    ]).then(([pubs, certs, repos, prs]) => {
      setAllContent([
        ...pubs.map(p  => ({ id: p.id,  title: p.title  + ' ✍️',  objective_id: p.objective_id })),
        ...certs.map(c => ({ id: c.id,  title: c.title  + ' 🏆',  objective_id: c.objective_id })),
        ...repos.map(r => ({ id: r.id,  title: r.title  + ' 📦',  objective_id: r.objective_id })),
        ...prs.map(p   => ({ id: p.id,  title: p.title  + ' 🔀',  objective_id: p.objective_id })),
      ]);
    });
  }, []);

  const milestones = [
    ...allMilestones.filter(m => m.objective_id === form.objective_id),
    ...allContent.filter(c => c.objective_id === form.objective_id),
  ];

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function toggleCat(id) {
    setForm(f => {
      const ids = f.category_ids.includes(id)
        ? f.category_ids.filter(c => c !== id)
        : [...f.category_ids, id];
      return { ...f, category_ids: ids };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (!form.date)         { setError('La fecha es obligatoria');  return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:        form.title.trim(),
        description:  form.description || '',
        category_ids: form.category_ids,
        category_id:  form.category_ids[0] || null,
        date:         form.date,
        start_time:   form.start_time || null,
        end_time:     form.end_time   || null,
        priority:     Number(form.priority),
        objective_id: form.objective_id || null,
        milestone_id: form.milestone_id || null,
        is_fixed:     form.is_fixed ? 1 : 0,
        notes:        form.notes || '',
        label:        form.label || '',
        status:       form.status || 'pending',
      };
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Hora inicio</label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Hora fin</label>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* Categories (multi) + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, marginBottom: 14, alignItems: 'start' }}>
            <div>
              <label style={labelStyle}>
                Categorías
                {form.category_ids.length > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>
                    ({form.category_ids.length} seleccionada{form.category_ids.length > 1 ? 's' : ''})
                  </span>
                )}
              </label>
              <div style={{
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 8px', maxHeight: 130, overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {categories.map(c => {
                  const checked = form.category_ids.includes(c.id);
                  const isPrimary = form.category_ids[0] === c.id;
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCat(c.id)} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span>{c.name}</span>
                      {isPrimary && checked && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>principal</span>}
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{ minWidth: 110 }}>
              <label style={labelStyle}>Prioridad</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} style={{ width: '100%' }}>
                <option value={1}>Alta ★</option>
                <option value={2}>Normal</option>
                <option value={3}>Baja</option>
              </select>
            </div>
          </div>

          {/* Objective + Milestone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
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
              <label style={labelStyle}>Hito</label>
              <select value={form.milestone_id} onChange={e => set('milestone_id', e.target.value)} style={{ width: '100%' }}
                disabled={!form.objective_id || milestones.length === 0}>
                <option value="">Sin hito</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          {isEdit && (
            <div style={fieldWrap}>
              <label style={labelStyle}>Estado</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%' }}>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En curso</option>
                <option value="completed">Completada</option>
                <option value="blocked">Bloqueada</option>
              </select>
            </div>
          )}

          {/* Label + is_fixed */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 14, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Etiqueta visual</label>
              <input type="text" value={form.label} onChange={e => set('label', e.target.value)}
                placeholder="ej. PR3, exam, setup…" style={{ width: '100%' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 7, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={!!form.is_fixed} onChange={e => set('is_fixed', e.target.checked)} />
              Tarea fija 📌
            </label>
          </div>

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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fieldWrap = { marginBottom: 14 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
