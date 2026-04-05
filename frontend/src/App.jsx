import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { api } from './api.js';
import { toDateStr, timeToMinutes, formatCountdown, secondsUntilTime } from './utils/dateUtils.js';
import Dashboard from './views/Dashboard.jsx';
import NowView from './views/NowView.jsx';
import DailyList from './views/DailyList.jsx';
import WeeklyCalendar from './views/WeeklyCalendar.jsx';
import MonthlyCalendar from './views/MonthlyCalendar.jsx';
import ObjectivesView from './views/ObjectivesView.jsx';
import ClientsView from './views/ClientsView.jsx';
import PublicationsView from './views/PublicationsView.jsx';
import CertificationsView from './views/CertificationsView.jsx';
import ReposView from './views/ReposView.jsx';
import PRsView from './views/PRsView.jsx';
import EventsView from './views/EventsView.jsx';
import ReadingListView from './views/ReadingListView.jsx';
import DocumentsView from './views/DocumentsView.jsx';
import Search from './views/Search.jsx';
import Settings from './views/Settings.jsx';
import ImportExport from './views/ImportExport.jsx';
import { CategoriesProvider } from './components/CatBadge.jsx';

// Compute total free minutes within 9:00–20:00 by merging task intervals
function computeFreeHours(tasks) {
  const workStart = 9 * 60;
  const workEnd   = 20 * 60;
  const intervals = tasks
    .filter(t => t.start_time && t.end_time)
    .map(t => [
      Math.max(timeToMinutes(t.start_time), workStart),
      Math.min(timeToMinutes(t.end_time),   workEnd),
    ])
    .filter(([s, e]) => s < e)
    .sort(([a], [b]) => a - b);
  let covered = 0, cursor = workStart;
  for (const [s, e] of intervals) {
    if (s > cursor) cursor = s;
    covered += Math.max(0, e - cursor);
    cursor = Math.max(cursor, e);
  }
  return Math.max(0, (workEnd - workStart - covered) / 60);
}

function SidebarStatus() {
  const [, setTick] = useState(0);
  const [nowData,   setNowData]  = useState(null);
  const [freeH,     setFreeH]    = useState(null);

  // 1-second tick for clock + countdown
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Refresh task data every minute
  useEffect(() => {
    function load() {
      api.tasksNow().then(setNowData).catch(() => {});
      api.tasks({ date: toDateStr(new Date()) })
        .then(tasks => setFreeH(computeFreeHours(tasks)))
        .catch(() => {});
    }
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  const timeStr = new Date().toTimeString().slice(0, 5);

  // Countdown: remaining time in current task, or time until next task
  let nextLabel = null;
  let nextTitle = '';
  if (nowData) {
    const { current, upcoming } = nowData;
    const target = current?.end_time ?? upcoming?.start_time;
    if (target) {
      const secs = secondsUntilTime(target);
      if (secs > 0) {
        nextLabel = formatCountdown(secs);
        nextTitle = current ? 'Tiempo restante en tarea actual' : 'Tiempo hasta próxima tarea';
      }
    }
  }

  return (
    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '0 10px', alignItems: 'center' }}>
      <span style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
        {timeStr}
      </span>
      {nextLabel && (
        <span title={nextTitle} style={{ fontVariantNumeric: 'tabular-nums' }}>
          ⏭ {nextLabel}
        </span>
      )}
      {freeH !== null && (
        <span title="Tiempo libre hoy (9:00–20:00)">
          {freeH.toFixed(1)}h libres
        </span>
      )}
    </div>
  );
}

const navMain = [
  { path: '/',          icon: '📊', label: 'Dashboard' },
  { path: '/now',       icon: '⏱',  label: 'Ahora mismo' },
  { path: '/today',     icon: '📋',  label: 'Hoy' },
  { path: '/week',      icon: '🗓',  label: 'Semana' },
  { path: '/month',     icon: '📅',  label: 'Mes' },
  { path: '/objectives',icon: '🎯',  label: 'Objetivos' },
];

const navContent = [
  { path: '/clients',        icon: '👤', label: 'Clientes' },
  { path: '/publications',   icon: '✍️',  label: 'Publicaciones' },
  { path: '/certifications', icon: '🏆', label: 'Certificaciones' },
  { path: '/repos',          icon: '📦', label: 'Repositorios' },
  { path: '/prs',            icon: '🔀', label: 'Pull Requests' },
  { path: '/events',         icon: '🎪', label: 'Eventos' },
  { path: '/reading-list',   icon: '📚', label: 'Para Leer' },
  { path: '/documents',      icon: '📁', label: 'Documentos' },
];

const navTools = [
  { path: '/search',        icon: '🔍', label: 'Búsqueda' },
  { path: '/settings',      icon: '⚙️',  label: 'Configuración' },
  { path: '/import-export', icon: '💾', label: 'Importar/Exportar' },
];

export default function App() {
  return (
    <CategoriesProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <h1>Plan Maestro</h1>
            <SidebarStatus />
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section">Plan</div>
            {navMain.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            <div className="nav-section">Contenido</div>
            {navContent.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            <div className="nav-section">Herramientas</div>
            {navTools.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/now"        element={<NowView />} />
            <Route path="/today"      element={<DailyList />} />
            <Route path="/week"       element={<WeeklyCalendar />} />
            <Route path="/month"      element={<MonthlyCalendar />} />
            <Route path="/objectives" element={<ObjectivesView />} />
            <Route path="/clients"    element={<ClientsView />} />
            <Route path="/publications" element={<PublicationsView />} />
            <Route path="/certifications" element={<CertificationsView />} />
            <Route path="/repos"          element={<ReposView />} />
            <Route path="/prs"            element={<PRsView />} />
            <Route path="/reading-list"   element={<ReadingListView />} />
            <Route path="/documents"      element={<DocumentsView />} />
            <Route path="/events"         element={<EventsView />} />
            <Route path="/search"     element={<Search />} />
            <Route path="/import-export" element={<ImportExport />} />
            <Route path="/settings"      element={<Settings />} />
          </Routes>
        </main>
      </div>
    </CategoriesProvider>
  );
}
