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

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  if (response.status === 401) window.dispatchEvent(new Event('auth-required'));
  return response;
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `API error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const authApi = {
  config: () => request(`${BASE}/auth/config`).then(readJson),
  me: () => request(`${BASE}/auth/me`).then(readJson),
  login: credential => request(`${BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  }).then(readJson),
  logout: () => request(`${BASE}/auth/logout`, { method: 'POST' }).then(readJson),
};

function notifyTaskChange() {
  window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { userId: activeUserId } }));
}

function withTaskChange(promise) {
  return promise.then(result => {
    notifyTaskChange();
    return result;
  });
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
  const r = await request(withUser(path), { headers: authHeaders() });
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

async function put(path, body) {
  const r = await request(withUser(path), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

async function post(path, body = {}) {
  const r = await request(withUser(path), {
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
  moneyPlanningToday: () => get('/money-planning/today'),
  taskById:      (id) => get(`/tasks/${id}`),
  createTask:    (body) => withTaskChange(post('/tasks', body)),
  updateTask:    (id, body) => withTaskChange(put(`/tasks/${id}`, body)),
  taskTimer:     (id, action) => withTaskChange(post(`/tasks/${id}/timer`, { action })),
  completeScheduledTask: (task) => withTaskChange(post(`/tasks/${task.id}/complete-scheduled`, {
    date: task.date, start_time: task.start_time, end_time: task.end_time,
  })),
  reorderTodoDay: (date, ids) => post('/tasks/todo-day-reorder', { date, ids }),
  reorderTodos:  (objectiveId, ids) => post('/tasks/todo-reorder', { objective_id: objectiveId, ids }),
  deleteTask:    (id) => withTaskChange(request(withUser(`/tasks/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson)),

  deadlines:      (params = {}) => get('/deadlines?' + new URLSearchParams(params)),
  createDeadline: (body) => post('/deadlines', body),
  updateDeadline: (id, body) => put(`/deadlines/${id}`, body),
  deleteDeadline: (id) => request(withUser(`/deadlines/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  createCategory:   (body) => post('/categories', body),
  updateCategory:   (id, body) => put(`/categories/${id}`, body),
  deleteCategory:   (id) => request(withUser(`/categories/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  objectives:      (params = {}) => get('/objectives?' + new URLSearchParams(params)),
  createObjective: (body) => post('/objectives', body),
  updateObjective: (id, body) => put(`/objectives/${id}`, body),
  reorderTodoObjectives: (ids) => post('/objectives/todo-reorder', { ids }),
  deleteObjective: (id) => request(withUser(`/objectives/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  milestones:      () => get('/milestones'),
  createMilestone: (body) => post('/milestones', body),
  updateMilestone: (id, body) => put(`/milestones/${id}`, body),
  deleteMilestone: (id) => request(withUser(`/milestones/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  events:        (params = {}) => get('/events?' + new URLSearchParams(params)),
  createEvent:   (body) => post('/events', body),
  updateEvent:   (id, body) => put(`/events/${id}`, body),
  deleteEvent:   (id) => request(withUser(`/events/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  publications:  (params = {}) => get('/publications?' + new URLSearchParams(params)),
  createPublication: (body) => post('/publications', body),
  updatePublication: (id, body) => put(`/publications/${id}`, body),
  deletePublication: (id) => request(withUser(`/publications/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  certifications: (params = {}) => get('/certifications?' + new URLSearchParams(params)),
  createCertification: (body) => post('/certifications', body),
  updateCertification: (id, body) => put(`/certifications/${id}`, body),
  deleteCertification: (id) => request(withUser(`/certifications/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  repos:         (params = {}) => get('/repos?' + new URLSearchParams(params)),
  createRepo:    (body) => post('/repos', body),
  updateRepo:    (id, body) => put(`/repos/${id}`, body),
  deleteRepo:    (id) => request(withUser(`/repos/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  prs:           (params = {}) => get('/prs?' + new URLSearchParams(params)),
  createPR:      (body) => post('/prs', body),
  updatePR:      (id, body) => put(`/prs/${id}`, body),
  deletePR:      (id) => request(withUser(`/prs/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  readingList:         () => get('/reading-list'),
  createReadingItem:   (body) => post('/reading-list', body),
  updateReadingItem:   (id, body) => put(`/reading-list/${id}`, body),
  deleteReadingItem:   (id) => request(withUser(`/reading-list/${id}`), { method: 'DELETE', headers: authHeaders() }).then(readJson),
  reorderReadingList:  (ids) => post('/reading-list/reorder', { ids }),

  documents:     (params = {}) => get('/documents?' + new URLSearchParams(params)),
  uploadDocument: (formData) => request(withUser('/documents'), { method: 'POST', headers: authHeaders(), body: formData }).then(readJson),
  updateDocument: (id, body) => put(`/documents/${id}`, body),
  deleteDocument: (id) => request(withUser('/documents/' + id), { method: 'DELETE', headers: authHeaders() }).then(readJson),

  workBlocks:    () => get('/work-blocks'),

  dashboard:     () => get('/dashboard'),

  importData:    (body) => post('/restore', body),
};
