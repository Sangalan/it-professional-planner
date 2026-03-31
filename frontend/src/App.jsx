import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './views/Dashboard.jsx';
import NowView from './views/NowView.jsx';
import DailyList from './views/DailyList.jsx';
import WeeklyCalendar from './views/WeeklyCalendar.jsx';
import MonthlyCalendar from './views/MonthlyCalendar.jsx';
import ObjectivesView from './views/ObjectivesView.jsx';
import PublicationsView from './views/PublicationsView.jsx';
import CertificationsView from './views/CertificationsView.jsx';
import ReposView from './views/ReposView.jsx';
import PRsView from './views/PRsView.jsx';
import EventsView from './views/EventsView.jsx';
import ReadingListView from './views/ReadingListView.jsx';
import Reports from './views/Reports.jsx';
import Search from './views/Search.jsx';
import Settings from './views/Settings.jsx';
import ImportExport from './views/ImportExport.jsx';
import { CategoriesProvider } from './components/CatBadge.jsx';

const navMain = [
  { path: '/',          icon: '📊', label: 'Dashboard' },
  { path: '/now',       icon: '⏱',  label: 'Ahora mismo' },
  { path: '/today',     icon: '📋',  label: 'Hoy' },
  { path: '/week',      icon: '🗓',  label: 'Semana' },
  { path: '/month',     icon: '📅',  label: 'Mes' },
  { path: '/objectives',icon: '🎯',  label: 'Objetivos' },
  { path: '/reports',   icon: '📈',  label: 'Reportes' },
];

const navContent = [
  { path: '/publications',   icon: '✍️',  label: 'Publicaciones' },
  { path: '/certifications', icon: '🏆', label: 'Certificaciones' },
  { path: '/repos',          icon: '📦', label: 'Repositorios' },
  { path: '/prs',            icon: '🔀', label: 'Pull Requests' },
  { path: '/events',         icon: '🎪', label: 'Eventos' },
  { path: '/reading-list',   icon: '📚', label: 'Para Leer' },
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
            <span>Q2 2026 · Abr–Jun</span>
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
            <Route path="/publications"   element={<PublicationsView />} />
            <Route path="/certifications" element={<CertificationsView />} />
            <Route path="/repos"          element={<ReposView />} />
            <Route path="/prs"            element={<PRsView />} />
            <Route path="/reading-list"   element={<ReadingListView />} />
            <Route path="/events"         element={<EventsView />} />
            <Route path="/reports"    element={<Reports />} />
            <Route path="/search"        element={<Search />} />
            <Route path="/import-export" element={<ImportExport />} />
            <Route path="/settings"      element={<Settings />} />
          </Routes>
        </main>
      </div>
    </CategoriesProvider>
  );
}
