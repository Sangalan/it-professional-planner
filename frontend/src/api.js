const BASE = '/api';
const ACTIVE_USER_KEY = 'active_user_id';
let activeUserId = localStorage.getItem(ACTIVE_USER_KEY) || 'pepito';
const DEFAULT_CONTENT_SECTIONS = {
  clients: true,
  publications: true,
  certifications: true,
  repos: true,
  prs: true,
  events: true,
  reading_list: true,
  documents: true,
};

export function getActiveUserId() {
  return activeUserId;
}

export function setActiveUserId(userId) {
  activeUserId = userId || 'pepito';
  localStorage.setItem(ACTIVE_USER_KEY, activeUserId);
  window.dispatchEvent(new CustomEvent('active-user-changed', { detail: activeUserId }));
}

function withUser(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${BASE}${path}${sep}user_id=${encodeURIComponent(activeUserId)}`;
}

function authHeaders(extra = {}) {
  return { 'x-user-id': activeUserId, ...extra };
}

function sortCategoriesByName(categories) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeUser(user) {
  let contentSections = DEFAULT_CONTENT_SECTIONS;
  try {
    const raw = typeof user?.content_sections === 'string'
      ? JSON.parse(user.content_sections)
      : (user?.content_sections || {});
    contentSections = { ...DEFAULT_CONTENT_SECTIONS, ...raw };
  } catch (_) {
    contentSections = { ...DEFAULT_CONTENT_SECTIONS };
  }
  return { ...user, content_sections: contentSections };
}

async function get(path) {
  const r = await fetch(withUser(path), { headers: authHeaders() });
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

async function put(path, body) {
  const r = await fetch(withUser(path), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

async function post(path, body = {}) {
  const r = await fetch(withUser(path), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

export const api = {
  users:         () => get('/users').then(rows => (rows || []).map(normalizeUser)),
  createUser:    (body) => post('/users', body),
  updateUser:    (id, body) => put(`/users/${id}`, body),

  categories:    () => get('/categories').then(sortCategoriesByName),

  tasks:         (params = {}) => get('/tasks?' + new URLSearchParams(params)),
  searchTasks:   (params = {}) => get('/tasks/search?' + new URLSearchParams(params)),
  tasksToday:    () => get('/tasks/today'),
  tasksWeek:     () => get('/tasks/week'),
  tasksNow:      () => get('/tasks/now'),
  taskById:      (id) => get(`/tasks/${id}`),
  createTask:    (body) => post('/tasks', body),
  updateTask:    (id, body) => put(`/tasks/${id}`, body),
  deleteTask:    (id) => fetch(withUser(`/tasks/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  createCategory:   (body) => post('/categories', body),
  updateCategory:   (id, body) => put(`/categories/${id}`, body),
  deleteCategory:   (id) => fetch(withUser(`/categories/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  objectives:      (params = {}) => get('/objectives?' + new URLSearchParams(params)),
  createObjective: (body) => post('/objectives', body),
  updateObjective: (id, body) => put(`/objectives/${id}`, body),
  deleteObjective: (id) => fetch(withUser(`/objectives/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  milestones:      () => get('/milestones'),
  createMilestone: (body) => post('/milestones', body),
  updateMilestone: (id, body) => put(`/milestones/${id}`, body),
  deleteMilestone: (id) => fetch(withUser(`/milestones/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  events:        (params = {}) => get('/events?' + new URLSearchParams(params)),
  createEvent:   (body) => post('/events', body),
  updateEvent:   (id, body) => put(`/events/${id}`, body),
  deleteEvent:   (id) => fetch(withUser(`/events/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  publications:  (params = {}) => get('/publications?' + new URLSearchParams(params)),
  createPublication: (body) => post('/publications', body),
  updatePublication: (id, body) => put(`/publications/${id}`, body),
  deletePublication: (id) => fetch(withUser(`/publications/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  certifications: (params = {}) => get('/certifications?' + new URLSearchParams(params)),
  createCertification: (body) => post('/certifications', body),
  updateCertification: (id, body) => put(`/certifications/${id}`, body),
  deleteCertification: (id) => fetch(withUser(`/certifications/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  repos:         (params = {}) => get('/repos?' + new URLSearchParams(params)),
  createRepo:    (body) => post('/repos', body),
  updateRepo:    (id, body) => put(`/repos/${id}`, body),
  deleteRepo:    (id) => fetch(withUser(`/repos/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  prs:           (params = {}) => get('/prs?' + new URLSearchParams(params)),
  createPR:      (body) => post('/prs', body),
  updatePR:      (id, body) => put(`/prs/${id}`, body),
  deletePR:      (id) => fetch(withUser(`/prs/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  readingList:         () => get('/reading-list'),
  createReadingItem:   (body) => post('/reading-list', body),
  updateReadingItem:   (id, body) => put(`/reading-list/${id}`, body),
  deleteReadingItem:   (id) => fetch(withUser(`/reading-list/${id}`), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),
  reorderReadingList:  (ids) => post('/reading-list/reorder', { ids }),

  documents:     (params = {}) => get('/documents?' + new URLSearchParams(params)),
  uploadDocument: (formData) => fetch(withUser('/documents'), { method: 'POST', headers: authHeaders(), body: formData }).then(r => r.json()),
  updateDocument: (id, body) => put(`/documents/${id}`, body),
  deleteDocument: (id) => fetch(withUser('/documents/' + id), { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  workBlocks:    () => get('/work-blocks'),

  dashboard:     () => get('/dashboard'),

  importData:    (body) => post('/import', body),
};
