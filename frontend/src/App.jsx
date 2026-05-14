import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { api, getActiveUserId, setActiveUserId } from './api.js';
import { toDateStr, timeToMinutes, formatCountdown, secondsUntilTime, getGapHours } from './utils/dateUtils.js';
import Dashboard from './views/Dashboard.jsx';
import NowView from './views/NowView.jsx';
import DailyList from './views/DailyList.jsx';
import WeeklyCalendar from './views/WeeklyCalendar.jsx';
import MonthlyCalendar from './views/MonthlyCalendar.jsx';
import TasksView from './views/TasksView.jsx';
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
import TaskModal from './components/TaskModal.jsx';
import GapPickerDialog from './components/GapPickerDialog.jsx';

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

function playBeep(frequency = 880, duration = 0.6, type = 'sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = type;
    osc2.frequency.setValueAtTime(frequency * 1.2, ctx.currentTime + 0.2);
    gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.8);
  } catch (_) {
    // best effort: audio may be unavailable in some environments
  }
}

function SidebarStatus() {
  const [tick, setTick] = useState(0);
  const [nowData,   setNowData]  = useState(null);
  const [freeH,     setFreeH]    = useState(null);
  const [todayTasks, setTodayTasks] = useState([]);
  const [editTask, setEditTask] = useState(null);
  const [gapDialogOpen, setGapDialogOpen] = useState(false);
  const startedTaskIdsRef = useRef(new Set());
  const endedTaskIdsRef = useRef(new Set());
  const lastKnownCurrentRef = useRef(null);
  const lastCurrentIdRef = useRef(null);

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
        .then(tasks => {
          setTodayTasks(tasks);
          setFreeH(computeFreeHours(tasks));
        })
        .catch(() => {});
    }
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Global sound alerts: start + end of tasks from any page.
  useEffect(() => {
    if (!nowData) return;
    const current = nowData?.current || null;
    const upcoming = nowData?.upcoming || null;
    const previousCurrent = lastKnownCurrentRef.current;

    if (current) {
      // If we switched from one current task to another, emit "end" for previous if due.
      if (
        previousCurrent &&
        previousCurrent.id !== current.id &&
        secondsUntilTime(previousCurrent.end_time) <= 0 &&
        !endedTaskIdsRef.current.has(previousCurrent.id)
      ) {
        endedTaskIdsRef.current.add(previousCurrent.id);
        playBeep();
      }

      // Start alert when a task becomes current.
      if (lastCurrentIdRef.current !== current.id && !startedTaskIdsRef.current.has(current.id)) {
        startedTaskIdsRef.current.add(current.id);
        playBeep();
      }
      lastCurrentIdRef.current = current.id;
      lastKnownCurrentRef.current = current;

      // End alert when current task reaches its end time.
      const secondsLeft = secondsUntilTime(current.end_time);
      if (secondsLeft <= 0 && !endedTaskIdsRef.current.has(current.id)) {
        endedTaskIdsRef.current.add(current.id);
        playBeep();
        api.tasksNow().then(setNowData).catch(() => {});
      }
      return;
    }

    lastCurrentIdRef.current = null;

    // If polling switched current->none, still emit end alert if due.
    if (
      previousCurrent &&
      secondsUntilTime(previousCurrent.end_time) <= 0 &&
      !endedTaskIdsRef.current.has(previousCurrent.id)
    ) {
      endedTaskIdsRef.current.add(previousCurrent.id);
      playBeep();
    }

    // If there is an upcoming task and its start time is reached, emit start alert.
    if (
      upcoming &&
      secondsUntilTime(upcoming.start_time) <= 0 &&
      !startedTaskIdsRef.current.has(upcoming.id)
    ) {
      startedTaskIdsRef.current.add(upcoming.id);
      playBeep();
      api.tasksNow().then(setNowData).catch(() => {});
    }
  }, [nowData, tick]);

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

  const currentTaskLabel = nowData?.current?.title?.trim() || 'Tiempo libre';
  const todayStr = toDateStr(new Date());
  const gapHours = getGapHours(todayTasks);

  function reloadSidebarData() {
    api.tasksNow().then(setNowData).catch(() => {});
    api.tasks({ date: todayStr })
      .then(tasks => {
        setTodayTasks(tasks);
        setFreeH(computeFreeHours(tasks));
      })
      .catch(() => {});
  }

  return (
    <>
      <div style={{ marginTop: 5 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', flexWrap: 'wrap', gap: '0 10px', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {timeStr}
          </span>
        </div>
        <div
          title={nowData?.current ? 'Editar tarea actual' : currentTaskLabel}
          onClick={() => nowData?.current && setEditTask(nowData.current)}
          style={{
            fontSize: 11,
            color: 'var(--text-2)',
            marginTop: 4,
            lineHeight: 1.4,
            display: 'flex',
            flexWrap: 'nowrap',
            gap: '0 8px',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            cursor: nowData?.current ? 'pointer' : 'default',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTaskLabel}</span>
          {nextLabel && (
            <span title={nextTitle} style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)', flexShrink: 0 }}>
              ⏭ {nextLabel}
            </span>
          )}
        </div>
        {freeH !== null && (
          <div
            title={gapHours.length > 0 ? 'Abrir huecos libres de hoy' : 'No hay huecos disponibles'}
            onClick={() => gapHours.length > 0 && setGapDialogOpen(true)}
            style={{
              fontSize: 11,
              color: 'var(--text-3)',
              marginTop: 2,
              cursor: gapHours.length > 0 ? 'pointer' : 'default',
            }}
          >
            Huecos disponibles: {freeH.toFixed(1)}h
          </div>
        )}
      </div>
      {editTask && (
        <TaskModal
          initial={editTask}
          onClose={() => setEditTask(null)}
          onSave={() => {
            setEditTask(null);
            reloadSidebarData();
          }}
          onDeleted={() => {
            setEditTask(null);
            reloadSidebarData();
          }}
        />
      )}
      {gapDialogOpen && (
        <GapPickerDialog
          date={todayStr}
          gapHours={gapHours}
          onClose={() => setGapDialogOpen(false)}
          onCreated={() => {
            setGapDialogOpen(false);
            reloadSidebarData();
          }}
        />
      )}
    </>
  );
}

const navMain = [
  { path: '/',          icon: '📊', label: 'Panel' },
  { path: '/now',       icon: '⏱',  label: 'Ahora mismo' },
  { path: '/today',     icon: '📋',  label: 'Hoy' },
  { path: '/week',      icon: '🗓',  label: 'Semana' },
  { path: '/month',     icon: '📅',  label: 'Mes' },
  { path: '/tasks',     icon: '✅',  label: 'Tareas' },
  { path: '/objectives',icon: '🎯',  label: 'Objetivos' },
];

const navContent = [
  { path: '/clients',        icon: '👤', label: 'Clientes' },
  { path: '/publications',   icon: '✍️',  label: 'Publicaciones' },
  { path: '/certifications', icon: '🏆', label: 'Certificaciones' },
  { path: '/repos',          icon: '📦', label: 'Proyectos' },
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

function SectionGuard({ enabled, sectionLabel, children }) {
  if (enabled) return children;
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Sección deshabilitada</div>
          <div className="page-subtitle">Esta sección está desactivada para el usuario actual</div>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-body">
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
            <strong>{sectionLabel}</strong> no está disponible para este usuario.
            Puedes habilitarla en Configuración → Usuarios.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [activeUserId, setActiveUserState] = useState(getActiveUserId());
  const activeUser = users.find(u => u.id === activeUserId) || null;
  const sections = activeUser?.content_sections || {
    clients: true, publications: true, certifications: true, repos: true, prs: true, events: true, reading_list: true, documents: true,
  };

  useEffect(() => {
    api.users().then(setUsers).catch(() => {});
    const onChanged = (e) => {
      setActiveUserState(e.detail || getActiveUserId());
      api.users().then(setUsers).catch(() => {});
    };
    window.addEventListener('active-user-changed', onChanged);
    return () => window.removeEventListener('active-user-changed', onChanged);
  }, []);

  function switchUser() {
    if (!users.length) return;
    const idx = users.findIndex(u => u.id === activeUserId);
    const next = users[(idx + 1) % users.length];
    if (!next) return;
    setActiveUserId(next.id);
  }

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
            {navContent.filter(item => {
              if (item.path === '/clients') return sections.clients;
              if (item.path === '/publications') return sections.publications;
              if (item.path === '/certifications') return sections.certifications;
              if (item.path === '/repos') return sections.repos;
              if (item.path === '/prs') return sections.prs;
              if (item.path === '/events') return sections.events;
              if (item.path === '/reading-list') return sections.reading_list;
              if (item.path === '/documents') return sections.documents;
              return true;
            }).map(item => (
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
          <div style={{ position: 'fixed', top: 12, right: 18, zIndex: 120 }}>
            <button
              onClick={switchUser}
              title={activeUser ? `Usuario activo: ${activeUser.name}. Clic para cambiar.` : 'Cambiar usuario'}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '2px solid #fff',
                boxShadow: 'var(--shadow-md)',
                background: activeUser?.color || 'var(--accent)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {(activeUser?.name || 'U').trim().charAt(0).toUpperCase()}
            </button>
          </div>
          <Routes key={activeUserId}>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/now"        element={<NowView />} />
            <Route path="/today"      element={<DailyList />} />
            <Route path="/week"       element={<WeeklyCalendar />} />
            <Route path="/month"      element={<MonthlyCalendar />} />
            <Route path="/tasks"      element={<TasksView />} />
            <Route path="/objectives" element={<ObjectivesView />} />
            <Route path="/clients" element={<SectionGuard enabled={sections.clients} sectionLabel="Clientes"><ClientsView /></SectionGuard>} />
            <Route path="/publications" element={<SectionGuard enabled={sections.publications} sectionLabel="Publicaciones"><PublicationsView /></SectionGuard>} />
            <Route path="/certifications" element={<SectionGuard enabled={sections.certifications} sectionLabel="Certificaciones"><CertificationsView /></SectionGuard>} />
            <Route path="/repos" element={<SectionGuard enabled={sections.repos} sectionLabel="Proyectos"><ReposView /></SectionGuard>} />
            <Route path="/prs" element={<SectionGuard enabled={sections.prs} sectionLabel="Pull Requests"><PRsView /></SectionGuard>} />
            <Route path="/reading-list" element={<SectionGuard enabled={sections.reading_list} sectionLabel="Para Leer"><ReadingListView /></SectionGuard>} />
            <Route path="/documents" element={<SectionGuard enabled={sections.documents} sectionLabel="Documentos"><DocumentsView /></SectionGuard>} />
            <Route path="/events" element={<SectionGuard enabled={sections.events} sectionLabel="Eventos"><EventsView /></SectionGuard>} />
            <Route path="/search"     element={<Search />} />
            <Route path="/import-export" element={<ImportExport />} />
            <Route path="/settings"      element={<Settings />} />
          </Routes>
        </main>
      </div>
    </CategoriesProvider>
  );
}
