import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../utils/dateUtils.js';
import { CategoryBadges, CategoryOption, useCats } from '../components/CatBadge.jsx';
import SpanishDateInput from '../components/SpanishDateInput.jsx';
import ContentSearchFilters from '../components/ContentSearchFilters.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';
import useEscapeClose from '../hooks/useEscapeClose.js';
import { buildCertificationStatsMap, formatCertificationStats } from '../utils/certificationMetrics.js';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'No iniciado' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed',   label: 'Aprobada ✓' },
  { value: 'failed',      label: 'Fallida' },
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

export function DetailDialog({ cert, objectives, onClose, onSaved, onDeleted }) {
  useEscapeClose(onClose);
  const isNew = !cert;
  const initCatIds = parseCatIds(cert?.category_ids, cert?.category_id);
  const [form, setForm] = useState({
    title: cert?.title || '',
    target_date: cert?.target_date || '',
    status: cert?.status || 'not_started',
    objective_id: cert?.objective_id || '',
    notes: cert?.notes || '',
    percentage_completed: cert?.percentage_completed ?? 0,
  });
  const [catIds, setCatIds] = useState(initCatIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    if (isNew) {
      await api.createCertification({ ...form, objective_id: form.objective_id || null, category_ids: catIds, category_id: catIds[0] || null, percentage_completed: Number(form.percentage_completed) });
    } else {
      await api.updateCertification(cert.id, { ...form, objective_id: form.objective_id || null, category_ids: catIds, category_id: catIds[0] || null, percentage_completed: Number(form.percentage_completed) });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const days = cert?.days_remaining;
  const cls = days < 0 ? 'overdue' : days <= 14 ? 'soon' : 'ok';

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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>🏆 {isNew ? 'Nueva certificación' : 'Certificación'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        {isNew ? (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Título *</label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} style={{ width: '100%' }} autoFocus />
            </div>
            <div>
              <label style={labelSt}>Fecha objetivo</label>
              <SpanishDateInput value={form.target_date} onChange={v => set('target_date', v)} style={{ width: '100%' }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{cert.title}</div>
            <div className="task-meta" style={{ marginBottom: 16 }}>
              <span className="task-time">{fmtDate(cert.target_date)}</span>
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
              if (!confirm('¿Eliminar esta certificación?')) return;
              setDeleting(true);
              const r = await api.deleteCertification(cert.id);
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

export default function CertificationsView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [certs, setCerts] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filterCats, setFilterCats] = useState([]);
  const [searchTitle, setSearchTitle] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  async function load() {
    Promise.all([
      api.certifications(),
      api.objectives(),
      api.tasks(),
    ]).then(([loadedCerts, loadedObjectives, loadedTasks]) => {
      setCerts(loadedCerts);
      setObjectives(loadedObjectives);
      setTasks(loadedTasks);
    });
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const intent = location.state;
    if (!intent?.fromSearch || intent.itemKind !== 'certification') return;
    const target = certs.find(c => String(c.id) === String(intent.itemId));
    if (!target) return;
    setSelected(target);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, certs]);

  const usedCatIds = [...new Set(certs.flatMap(c => parseCatIds(c.category_ids, c.category_id)))];
  const certStatsById = useMemo(() => buildCertificationStatsMap(certs, tasks), [certs, tasks]);
  const normalizedSearch = searchTitle.trim().toLowerCase();
  const dateMatches = (value) => {
    if (!value) return !fromDate && !toDate;
    if (fromDate && value < fromDate) return false;
    if (toDate && value > toDate) return false;
    return true;
  };
  const filteredBySearch = certs
    .filter(c => !normalizedSearch || (c.title || '').toLowerCase().includes(normalizedSearch))
    .filter(c => dateMatches(c.target_date))
    .filter(c => filterCats.length === 0 || filterCats.some(fc => parseCatIds(c.category_ids, c.category_id).includes(fc)));
  const activeCerts = filteredBySearch
    .filter(c => c.status !== 'completed');
  const completedCerts = filteredBySearch.filter(c => c.status === 'completed');
  const totalCerts = certs.length;
  const completedTotal = certs.filter(c => c.status === 'completed').length;
  const inProgressTotal = certs.filter(c => c.status === 'in_progress').length;
  const progressPct = totalCerts > 0 ? Math.round((completedTotal / totalCerts) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Certificaciones</div>
          <div className="page-subtitle">{activeCerts.length} activas · {completedCerts.length} aprobadas</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Nueva</button>
      </div>

      {creating && (
        <DetailDialog cert={null} objectives={objectives} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} onDeleted={() => {}} />
      )}
      {selected && (
        <DetailDialog cert={selected} objectives={objectives} onClose={() => setSelected(null)} onSaved={load} onDeleted={() => { setSelected(null); load(); }} />
      )}

      <ContentMetricsSummary
        title="Resumen de certificaciones"
        metrics={[
          { label: 'Totales', value: totalCerts, sub: 'certificaciones registradas' },
          { label: 'Aprobadas', value: completedTotal, sub: `de ${totalCerts} total`, valueStyle: { color: 'var(--success)' } },
          { label: 'En curso', value: inProgressTotal, sub: 'actualmente activas', valueStyle: { color: '#2563eb' } },
          { label: 'Progreso global', value: `${progressPct}%`, sub: `${completedTotal}/${totalCerts} completadas`, valueStyle: { color: 'var(--accent)' } },
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

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>En progreso / pendientes</div>
      {activeCerts.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          Sin certificaciones activas con estos filtros
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {activeCerts.map(cert => {
              const days = cert.days_remaining;
              const cls = days < 0 ? 'overdue' : days <= 14 ? 'soon' : 'ok';
              const catIds = parseCatIds(cert.category_ids, cert.category_id);
              const pct = cert.percentage_completed || 0;
              const statsLabel = formatCertificationStats(certStatsById[cert.id]);
              return (
                <div key={cert.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(cert)}>
                  <div className="task-info">
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      🏆 {cert.title}
                      {statsLabel && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{statsLabel}</span>}
                    </div>
                    <div className="task-meta">
                      <span className={`milestone-days ${cls}`}>
                        {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}
                      </span>
                      <span className="task-time">{fmtDate(cert.target_date)}</span>
                    </div>
                    {catIds.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        <CategoryBadges ids={catIds} />
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
                    background: cert.status === 'completed' ? '#dcfce7' : cert.status === 'failed' ? '#fee2e2' : cert.status === 'in_progress' ? '#dbeafe' : 'var(--bg)',
                    color: cert.status === 'completed' ? '#16a34a' : cert.status === 'failed' ? '#dc2626' : cert.status === 'in_progress' ? '#2563eb' : 'var(--text-2)',
                  }}>
                    {STATUS_OPTIONS.find(s => s.value === cert.status)?.label || cert.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: '18px 0 8px' }}>Aprobadas</div>
      {completedCerts.length === 0 ? (
        <div className="empty-state card" style={{ padding: 32 }}>
          No hay certificaciones aprobadas con estos filtros
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '0 18px' }}>
            {completedCerts.map(cert => {
              const catIds = parseCatIds(cert.category_ids, cert.category_id);
              const pct = cert.percentage_completed || 0;
              const statsLabel = formatCertificationStats(certStatsById[cert.id]);
              return (
                <div key={cert.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(cert)}>
                  <div className="task-info">
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      🏆 {cert.title}
                      {statsLabel && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{statsLabel}</span>}
                    </div>
                    <div className="task-meta">
                      <span className="task-time">{fmtDate(cert.target_date)}</span>
                    </div>
                    {catIds.length > 0 && (
                      <div className="task-meta" style={{ marginTop: 3 }}>
                        <CategoryBadges ids={catIds} />
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
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', background: '#dcfce7', color: '#16a34a' }}>
                    Aprobada ✓
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
