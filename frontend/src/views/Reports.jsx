import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getCatColor, getCatLabel } from '../utils/categoryUtils.js';
import { fmtShortDate } from '../utils/dateUtils.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts';

export default function Reports() {
  const [dash, setDash] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [certs, setCerts] = useState([]);
  const [pubs, setPubs] = useState([]);
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [d, o, t, c, p, pr] = await Promise.all([
      api.dashboard(),
      api.objectives(),
      api.tasks({ from: '2026-04-01', to: '2026-06-30' }),
      api.certifications(),
      api.publications(),
      api.prs(),
    ]);
    setDash(d); setObjectives(o); setTasks(t); setCerts(c); setPubs(p); setPrs(pr);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  if (loading || !dash) return <div className="empty-state">Cargando reportes...</div>;

  // Objective progress chart
  const objChartData = objectives.map(o => ({
    name: o.title.length > 20 ? o.title.slice(0, 18) + '…' : o.title,
    Completado: Math.round(o.percentage_completed || 0),
    Restante: 100 - Math.round(o.percentage_completed || 0),
    color: getCatColor(o.category_id),
  }));

  // Weekly tasks chart (build from all tasks)
  const weeks = [];
  const weekMap = {};
  for (const task of tasks) {
    const d = new Date(task.date + 'T12:00:00');
    const wstart = new Date(d);
    const wd = d.getDay();
    wstart.setDate(d.getDate() - (wd === 0 ? 6 : wd - 1));
    const key = wstart.toISOString().slice(0, 10);
    if (!weekMap[key]) weekMap[key] = { week: fmtShortDate(key), total: 0, done: 0 };
    weekMap[key].total++;
    if (task.status === 'completed') weekMap[key].done++;
  }
  const weekChartData = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));

  // Category breakdown
  const catMap = {};
  for (const task of tasks) {
    if (!catMap[task.category_id]) catMap[task.category_id] = { name: getCatLabel(task.category_id), total: 0, done: 0, color: getCatColor(task.category_id) };
    catMap[task.category_id].total++;
    if (task.status === 'completed') catMap[task.category_id].done++;
  }
  const catChartData = Object.values(catMap);
  const pieCatData = catChartData.map(c => ({ name: c.name, value: c.total, color: c.color }));

  // Burnup: cumulative completed tasks by date
  const burnData = [];
  const sortedTasks = [...tasks].sort((a, b) => a.date.localeCompare(b.date));
  let cumDone = 0, cumTotal = 0;
  const burnMap = {};
  for (const t of sortedTasks) {
    if (!burnMap[t.date]) burnMap[t.date] = { date: fmtShortDate(t.date), planned: 0, done: 0 };
    burnMap[t.date].planned++;
    if (t.status === 'completed') burnMap[t.date].done++;
  }
  let runningTotal = 0, runningDone = 0;
  for (const entry of Object.values(burnMap)) {
    runningTotal += entry.planned;
    runningDone  += entry.done;
    burnData.push({ date: entry.date, Planificadas: runningTotal, Completadas: runningDone });
  }

  // Monthly progress
  const monthData = [
    { month: 'Abril',  total: tasks.filter(t => t.date.startsWith('2026-04')).length, done: tasks.filter(t => t.date.startsWith('2026-04') && t.status === 'completed').length },
    { month: 'Mayo',   total: tasks.filter(t => t.date.startsWith('2026-05')).length, done: tasks.filter(t => t.date.startsWith('2026-05') && t.status === 'completed').length },
    { month: 'Junio',  total: tasks.filter(t => t.date.startsWith('2026-06')).length, done: tasks.filter(t => t.date.startsWith('2026-06') && t.status === 'completed').length },
  ].map(m => ({ ...m, pct: m.total > 0 ? Math.round(m.done / m.total * 100) : 0 }));

  // Certifications pie
  const certDone = certs.filter(c => c.status === 'completed').length;
  const certPieData = [
    { name: 'Aprobadas', value: certDone, color: '#059669' },
    { name: 'Pendientes', value: certs.length - certDone, color: '#e2e8f0' },
  ];

  // Publications pie
  const pubDone = pubs.filter(p => p.status === 'published').length;
  const pubPieData = [
    { name: 'Publicadas', value: pubDone, color: '#7c3aed' },
    { name: 'Pendientes', value: pubs.length - pubDone, color: '#e2e8f0' },
  ];

  // PRs status
  const prsByStatus = {};
  for (const pr of prs) {
    prsByStatus[pr.status] = (prsByStatus[pr.status] || 0) + 1;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reportes y gráficas</div>
          <div className="page-subtitle">Análisis completo del plan Q2 2026</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Progreso global</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{dash.global_progress}%</div>
          <div style={{ marginTop: 6 }} className="progress-bar"><div className="progress-fill" style={{ width: `${dash.global_progress}%` }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tareas totales</div>
          <div className="stat-value">{dash.tasks_total}</div>
          <div className="stat-sub">{dash.tasks_done} completadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Publicaciones</div>
          <div className="stat-value">{dash.publications.done}/{dash.publications.total}</div>
          <div className="stat-sub">{Math.round(dash.publications.done/dash.publications.total*100)||0}% publicadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Certificaciones</div>
          <div className="stat-value">{dash.certifications.done}/{dash.certifications.total}</div>
          <div className="stat-sub">aprobadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vencidas</div>
          <div className="stat-value" style={{ color: dash.overdue_tasks.length > 0 ? 'var(--danger)' : 'inherit' }}>
            {dash.overdue_tasks.length}
          </div>
        </div>
      </div>

      {/* Burnup */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Burnup acumulado — Q2 2026</span></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={burnData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Planificadas" stroke="#cbd5e1" fill="url(#gradPlanned)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Completadas"  stroke="#2563eb" fill="url(#gradDone)"    strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash-grid-2">
        {/* Monthly progress */}
        <div className="card">
          <div className="card-header"><span className="card-title">Completado por mes</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="Planificadas" fill="#e2e8f0" radius={[3,3,0,0]} />
                <Bar dataKey="done"  name="Completadas"  fill="#2563eb" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category pie */}
        <div className="card">
          <div className="card-header"><span className="card-title">Distribución por categoría</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieCatData} cx="50%" cy="50%" outerRadius={75} dataKey="value">
                  {pieCatData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Objective progress bars */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Avance por objetivo</span></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={objChartData} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
              <Tooltip formatter={(v) => [`${v}%`]} />
              <Bar dataKey="Completado" stackId="a" radius={[0,4,4,0]}>
                {objChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
              <Bar dataKey="Restante" stackId="a" fill="#f1f5f9" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash-grid-3">
        {/* Weekly completions */}
        <div className="card">
          <div className="card-header"><span className="card-title">Tareas completadas por semana</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekChartData.slice(-8)} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="done" name="Completadas" fill="#059669" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cert progress */}
        <div className="card">
          <div className="card-header"><span className="card-title">Certificaciones</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={certPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                  {certPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
              {certDone} / {certs.length} aprobadas
            </div>
          </div>
        </div>

        {/* Publications progress */}
        <div className="card">
          <div className="card-header"><span className="card-title">Publicaciones</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={pubPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                  {pubPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cat-contenido)' }}>
              {pubDone} / {pubs.length} publicadas
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
