import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { toDateStr } from '../utils/dateUtils.js';

const CONTENT_TYPES = [
  { key: 'client', label: 'Clientes', icon: '👤' },
  { key: 'publication', label: 'Publicaciones', icon: '✍️' },
  { key: 'certification', label: 'Certificaciones', icon: '🏆' },
  { key: 'repo', label: 'Proyectos', icon: '📦' },
  { key: 'pr', label: 'Pull Requests', icon: '🔀' },
  { key: 'event', label: 'Eventos', icon: '🎪' },
  { key: 'reading', label: 'Para Leer', icon: '📚' },
];

const DOW_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const OBJECTIVE_TYPE_FALLBACK = {
  'obj-certs': 'certification',
  'obj-eventos': 'event',
  'obj-linkedin': 'publication',
};

function taskHours(task) {
  if (task.duration_estimated && Number(task.duration_estimated) > 0) {
    return Number(task.duration_estimated) / 60;
  }
  if (task.start_time && task.end_time) {
    const [sh, sm] = task.start_time.split(':').map(Number);
    const [eh, em] = task.end_time.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes > 0) return minutes / 60;
  }
  return 0;
}

function fmtHours(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

function weekdayIndexFromDate(dateStr) {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  return (day + 6) % 7; // Monday=0 ... Sunday=6
}

function getTaskContentType(task, maps) {
  if (task.milestone_id && maps.itemTypeById[task.milestone_id]) {
    return maps.itemTypeById[task.milestone_id];
  }

  if (task.milestone_id && maps.objectiveByMilestoneId[task.milestone_id]) {
    const objectiveId = maps.objectiveByMilestoneId[task.milestone_id];
    if (maps.objectiveTypeById[objectiveId]) return maps.objectiveTypeById[objectiveId];
  }

  if (task.objective_id) {
    return maps.objectiveTypeById[task.objective_id] || null;
  }

  return null;
}

function buildRelationMaps({ objectives, milestones, publications, certifications, repos, prs, events, reading }) {
  const itemTypeById = {};
  const typesByObjective = {};
  const objectiveTypeById = { ...OBJECTIVE_TYPE_FALLBACK };
  const objectiveByMilestoneId = {};

  function registerObjectiveType(objectiveId, type) {
    if (!objectiveId) return;
    if (!typesByObjective[objectiveId]) typesByObjective[objectiveId] = new Set();
    typesByObjective[objectiveId].add(type);
  }

  for (const p of publications || []) {
    itemTypeById[p.id] = 'publication';
    registerObjectiveType(p.objective_id, 'publication');
  }
  for (const c of certifications || []) {
    itemTypeById[c.id] = 'certification';
    registerObjectiveType(c.objective_id, 'certification');
  }
  for (const r of repos || []) {
    itemTypeById[r.id] = 'repo';
    registerObjectiveType(r.objective_id, 'repo');
  }
  for (const pr of prs || []) {
    itemTypeById[pr.id] = 'pr';
    registerObjectiveType(pr.objective_id, 'pr');
  }
  for (const e of events || []) {
    itemTypeById[e.id] = 'event';
    registerObjectiveType(e.objective_id, 'event');
  }
  for (const r of reading || []) {
    itemTypeById[r.id] = 'reading';
  }

  for (const m of milestones || []) {
    if (m.id && m.objective_id) objectiveByMilestoneId[m.id] = m.objective_id;
  }

  for (const o of objectives || []) {
    if (o.type === 'client') {
      objectiveTypeById[o.id] = 'client';
      continue;
    }
    if (objectiveTypeById[o.id]) continue;
    const objectiveTypes = typesByObjective[o.id];
    if (objectiveTypes && objectiveTypes.size === 1) {
      objectiveTypeById[o.id] = [...objectiveTypes][0];
    }
  }

  return { itemTypeById, objectiveByMilestoneId, objectiveTypeById };
}

export default function CalendarContentSummary({ mode, date, weekDays = [], monthDate }) {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [maps, setMaps] = useState({ itemTypeById: {}, objectiveByMilestoneId: {}, objectiveTypeById: {} });

  const period = useMemo(() => {
    if (mode === 'day') {
      const day = typeof date === 'string' ? date : toDateStr(date || new Date());
      return { from: day, to: day };
    }
    if (mode === 'week') {
      const from = weekDays.length ? toDateStr(weekDays[0]) : toDateStr(new Date());
      const to = weekDays.length ? toDateStr(weekDays[weekDays.length - 1]) : from;
      return { from, to };
    }

    const base = monthDate || new Date();
    const y = base.getFullYear();
    const m = base.getMonth();
    const from = toDateStr(new Date(y, m, 1));
    const to = toDateStr(new Date(y, m + 1, 0));
    return { from, to };
  }, [mode, date, weekDays, monthDate]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      api.tasks({ from: period.from, to: period.to }),
      api.objectives(),
      api.milestones(),
      api.publications(),
      api.certifications(),
      api.repos(),
      api.prs(),
      api.events(),
      api.readingList(),
    ]).then(([t, objectives, milestones, publications, certifications, repos, prs, events, reading]) => {
      if (!active) return;
      setTasks(t || []);
      setMaps(buildRelationMaps({ objectives, milestones, publications, certifications, repos, prs, events, reading }));
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setTasks([]);
      setMaps({ itemTypeById: {}, objectiveByMilestoneId: {}, objectiveTypeById: {} });
      setLoading(false);
    });

    return () => { active = false; };
  }, [period.from, period.to]);

  const typeRows = useMemo(() => {
    const rows = Object.fromEntries(CONTENT_TYPES.map(t => [t.key, { ...t, total: 0, byDay: {} }]));

    for (const task of tasks) {
      if (!task?.date) continue;
      const type = getTaskContentType(task, maps);
      if (!type || !rows[type]) continue;
      const hours = taskHours(task);
      if (hours <= 0) continue;

      rows[type].total += hours;
      rows[type].byDay[task.date] = (rows[type].byDay[task.date] || 0) + hours;
    }

    return CONTENT_TYPES.map(t => rows[t.key]);
  }, [tasks, maps]);

  if (loading) {
    return <div className="empty-state card">Cargando vista de contenido...</div>;
  }

  if (mode === 'day') {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Horas por tipo de contenido</span>
        </div>
        <div className="card-body" style={{ padding: '10px 18px' }}>
          {typeRows.map(row => (
            <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{row.icon} {row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: row.total > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{fmtHours(row.total)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'week') {
    const dayKeys = weekDays.map(d => toDateStr(d));

    return (
      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-header">
          <span className="card-title">Horas por tipo de contenido (Semana)</span>
        </div>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={thSt}>Tipo</th>
              <th style={thSt}>Total semana</th>
              {weekDays.map((d, idx) => (
                <th key={dayKeys[idx]} style={thSt}>{DOW_SHORT[idx]} {d.getDate()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typeRows.map(row => (
              <tr key={row.key}>
                <td style={tdSt}>{row.icon} {row.label}</td>
                <td style={{ ...tdSt, fontWeight: 700, color: row.total > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{fmtHours(row.total)}</td>
                {dayKeys.map(dayKey => (
                  <td key={`${row.key}-${dayKey}`} style={tdSt}>{fmtHours(row.byDay[dayKey] || 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const monthRows = typeRows.map(row => {
    const byWeekDay = Array(7).fill(0);
    for (const [dateStr, hours] of Object.entries(row.byDay)) {
      const idx = weekdayIndexFromDate(dateStr);
      byWeekDay[idx] += hours;
    }
    return { ...row, byWeekDay };
  });

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div className="card-header">
        <span className="card-title">Horas por tipo de contenido (Mes)</span>
      </div>
      <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            <th style={thSt}>Tipo</th>
            <th style={thSt}>Total mes</th>
            {DOW_SHORT.map(d => <th key={d} style={thSt}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {monthRows.map(row => (
            <tr key={row.key}>
              <td style={tdSt}>{row.icon} {row.label}</td>
              <td style={{ ...tdSt, fontWeight: 700, color: row.total > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{fmtHours(row.total)}</td>
              {row.byWeekDay.map((hours, idx) => (
                <td key={`${row.key}-${idx}`} style={tdSt}>{fmtHours(hours)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thSt = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-2)',
  fontWeight: 700,
};

const tdSt = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-2)',
};
