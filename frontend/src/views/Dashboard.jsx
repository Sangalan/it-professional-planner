import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtShortDate, fmtDate, formatDuration } from '../utils/dateUtils.js';
import { getCatColor, getCatLabel } from '../utils/categoryUtils.js';
import CatBadge from '../components/CatBadge.jsx';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts';

function ProgressCard({ label, pct, done, total, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: color || 'var(--accent)', fontWeight: 700 }}>{Math.round(pct || 0)}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct || 0}%`, background: color || 'var(--accent)' }} />
      </div>
      {total !== undefined && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{done} / {total} tareas</div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.dashboard().then(setData);
    api.categories().then(setCats);
    api.events().then(setEvents);
  }, []);

  if (!data) return <div className="empty-state">Cargando dashboard...</div>;

  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

  // Pie chart data for categories
  const pieData = (data.category_stats || [])
    .filter(c => c.total > 0)
    .map(c => ({
      name: catMap[c.category_id]?.name || getCatLabel(c.category_id),
      value: c.total,
      color: catMap[c.category_id]?.color || getCatColor(c.category_id),
    }));

  // Bar chart weekly load
  const weekData = (data.weekly_load || []).map((w, i) => ({
    name: `S${i + 1}`,
    Planificadas: w.total,
    Completadas: w.done,
  }));

  const todayFormatted = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle" style={{ textTransform: 'capitalize' }}>{todayFormatted}</div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Progreso global</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{data.global_progress}%</div>
          <div className="stat-sub">{data.tasks_done} / {data.tasks_total} tareas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hoy completadas</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {data.today_tasks.done}
          </div>
          <div className="stat-sub">de {data.today_tasks.total} previstas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vencidas</div>
          <div className="stat-value" style={{ color: data.overdue_tasks.length > 0 ? 'var(--danger)' : 'var(--text-3)' }}>
            {data.overdue_tasks.length}
          </div>
          <div className="stat-sub">requieren atención</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Publicaciones</div>
          <div className="stat-value">{data.publications.done}</div>
          <div className="stat-sub">de {data.publications.total} previstas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Certificaciones</div>
          <div className="stat-value">{data.certifications.done}</div>
          <div className="stat-sub">de {data.certifications.total} previstas</div>
        </div>
      </div>

      <div className="dash-grid-2">
        {/* Today's tasks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tareas de hoy</span>
            <a href="/today" style={{ fontSize: 12, color: 'var(--accent)' }}>Ver todo →</a>
          </div>
          <div className="card-body" style={{ padding: '8px 18px' }}>
            {data.today_tasks.tasks.length === 0 ? (
              <div className="empty-state">Sin tareas para hoy</div>
            ) : (
              data.today_tasks.tasks.slice(0, 8).map(task => (
                <div key={task.id} className="task-row">
                  <div className="task-check checked" style={{ opacity: task.status === 'completed' ? 1 : 0.3 }}>
                    {task.status === 'completed' ? '✓' : ''}
                  </div>
                  <div className="task-info">
                    <div className={`task-title ${task.status === 'completed' ? 'done' : ''}`}>{task.title}</div>
                    <div className="task-meta">
                      {task.start_time && <span className="task-time">{task.start_time}–{task.end_time}</span>}
                      <CatBadge id={task.category_id} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming milestones */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Próximos hitos</span>
            <a href="/objectives" style={{ fontSize: 12, color: 'var(--accent)' }}>Ver objetivos →</a>
          </div>
          <div className="card-body" style={{ padding: '8px 18px' }}>
            {data.next_milestones.length === 0 ? (
              <div className="empty-state">Sin hitos próximos</div>
            ) : (
              data.next_milestones.map(m => {
                const days = m.days_remaining;
                const cls = days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'ok';
                return (
                  <div key={m.id} className="milestone-row">
                    <div className="dot" style={{ background: days < 0 ? 'var(--danger)' : days <= 7 ? 'var(--warning)' : 'var(--success)' }} />
                    <div className="milestone-title">{m.title}</div>
                    <div className="milestone-date">{fmtShortDate(m.target_date)}</div>
                    <div className={`milestone-days ${cls}`}>
                      {days < 0 ? `${Math.abs(days)}d atrás` : days === 0 ? 'Hoy' : `${days}d`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Progress by objective */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Progreso por objetivo</span>
        </div>
        <div className="card-body">
          {data.objectives.map(obj => (
            <ProgressCard
              key={obj.id}
              label={obj.title}
              pct={obj.percentage_completed}
              done={obj.done_count}
              total={obj.task_count}
              color={obj.color || getCatColor(obj.category_id)}
            />
          ))}
        </div>
      </div>

      <div className="dash-grid-2">
        {/* Weekly load chart */}
        <div className="card">
          <div className="card-header"><span className="card-title">Carga semanal (últimas 4 semanas)</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Planificadas" fill="#cbd5e1" radius={[3,3,0,0]} />
                <Bar dataKey="Completadas"  fill="#2563eb" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category pie */}
        <div className="card">
          <div className="card-header"><span className="card-title">Distribución por categoría</span></div>
          <div className="card-body">
            {pieData.length === 0 ? (
              <div className="empty-state">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Overdue tasks */}
      {data.overdue_tasks.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <div className="card-header" style={{ background: 'var(--danger-bg)' }}>
            <span className="card-title" style={{ color: 'var(--danger)' }}>
              ⚠ Tareas vencidas ({data.overdue_tasks.length})
            </span>
          </div>
          <div className="card-body" style={{ padding: '8px 18px' }}>
            {data.overdue_tasks.slice(0, 6).map(task => (
              <div key={task.id} className="task-row">
                <div className="task-info">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    <span className="overdue-tag">{fmtDate(task.date)}</span>
                    <CatBadge id={task.category_id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {data.next_events.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><span className="card-title">Próximos eventos (7 días)</span></div>
          <div className="card-body" style={{ padding: '8px 18px' }}>
            {data.next_events.map(ev => (
              <div key={ev.id} className="task-row">
                <div className="dot" style={{ background: getCatColor(ev.category_id), marginTop: 4 }} />
                <div className="task-info">
                  <div className="task-title">{ev.title}</div>
                  <div className="task-meta">
                    <span className="task-time">{fmtDate(ev.start_date)}{ev.end_date !== ev.start_date ? ` – ${fmtDate(ev.end_date)}` : ''}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{ev.location}</span>
                    <span className={`badge badge-${ev.format === 'online' ? 'admin' : 'eventos'}`}>{ev.format}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events — pending logistics */}
      {(() => {
        const pending = events.filter(ev => ev.status !== 'cancelled' && ev.status !== 'completed' && (!ev.registered || (ev.format !== 'Online' && (!ev.hotel_booked || !ev.flight_booked))));
        if (pending.length === 0) return null;
        return (
          <div className="card" style={{ marginTop: 20, borderColor: '#fde047' }}>
            <div className="card-header" style={{ background: '#fef9c3' }}>
              <span className="card-title" style={{ color: '#92400e' }}>🎪 Eventos — Cosas pendientes ({pending.length})</span>
              <a href="/events" style={{ fontSize: 12, color: 'var(--accent)' }}>Ver todos →</a>
            </div>
            <div className="card-body" style={{ padding: '8px 18px' }}>
              {pending.map(ev => {
                const missing = [];
                if (!ev.registered) missing.push({ label: 'Registrado', urgent: true });
                if (ev.format !== 'Online' && !ev.hotel_booked) missing.push({ label: 'Hotel', urgent: false });
                if (ev.format !== 'Online' && !ev.flight_booked) missing.push({ label: 'Avión', urgent: false });
                return (
                  <div key={ev.id} className="task-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="dot" style={{ background: getCatColor(ev.category_id), marginTop: 4 }} />
                    <div className="task-info">
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{ev.title}</div>
                      <div className="task-meta" style={{ marginTop: 4 }}>
                        <span className="task-time">{fmtShortDate(ev.start_date)}</span>
                        {missing.map(m => (
                          <span key={m.label} style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                            background: m.urgent ? '#fee2e2' : '#fef9c3',
                            color: m.urgent ? '#dc2626' : '#92400e',
                          }}>
                            ✗ {m.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
