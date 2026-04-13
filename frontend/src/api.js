const BASE = '/api';

function sortCategoriesByName(categories) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

async function get(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

async function put(path, body) {
  const r = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

async function post(path, body = {}) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`);
  return r.json();
}

export const api = {
  categories:    () => get('/categories').then(sortCategoriesByName),

  tasks:         (params = {}) => get('/tasks?' + new URLSearchParams(params)),
  searchTasks:   (params = {}) => get('/tasks/search?' + new URLSearchParams(params)),
  tasksToday:    () => get('/tasks/today'),
  tasksWeek:     () => get('/tasks/week'),
  tasksNow:      () => get('/tasks/now'),
  taskById:      (id) => get(`/tasks/${id}`),
  createTask:    (body) => post('/tasks', body),
  updateTask:    (id, body) => put(`/tasks/${id}`, body),
  deleteTask:    (id) => fetch(BASE + `/tasks/${id}`, { method: 'DELETE' }).then(r => r.json()),

  createCategory:   (body) => post('/categories', body),
  updateCategory:   (id, body) => put(`/categories/${id}`, body),
  deleteCategory:   (id) => fetch(BASE + `/categories/${id}`, { method: 'DELETE' }).then(r => r.json()),

  objectives:      (params = {}) => get('/objectives?' + new URLSearchParams(params)),
  createObjective: (body) => post('/objectives', body),
  updateObjective: (id, body) => put(`/objectives/${id}`, body),
  deleteObjective: (id) => fetch(BASE + `/objectives/${id}`, { method: 'DELETE' }).then(r => r.json()),

  milestones:      () => get('/milestones'),
  createMilestone: (body) => post('/milestones', body),
  updateMilestone: (id, body) => put(`/milestones/${id}`, body),
  deleteMilestone: (id) => fetch(BASE + `/milestones/${id}`, { method: 'DELETE' }).then(r => r.json()),

  events:        (params = {}) => get('/events?' + new URLSearchParams(params)),
  createEvent:   (body) => post('/events', body),
  updateEvent:   (id, body) => put(`/events/${id}`, body),
  deleteEvent:   (id) => fetch(BASE + `/events/${id}`, { method: 'DELETE' }).then(r => r.json()),

  publications:  (params = {}) => get('/publications?' + new URLSearchParams(params)),
  createPublication: (body) => post('/publications', body),
  updatePublication: (id, body) => put(`/publications/${id}`, body),
  deletePublication: (id) => fetch(BASE + `/publications/${id}`, { method: 'DELETE' }).then(r => r.json()),

  certifications: (params = {}) => get('/certifications?' + new URLSearchParams(params)),
  createCertification: (body) => post('/certifications', body),
  updateCertification: (id, body) => put(`/certifications/${id}`, body),
  deleteCertification: (id) => fetch(BASE + `/certifications/${id}`, { method: 'DELETE' }).then(r => r.json()),

  repos:         (params = {}) => get('/repos?' + new URLSearchParams(params)),
  createRepo:    (body) => post('/repos', body),
  updateRepo:    (id, body) => put(`/repos/${id}`, body),
  deleteRepo:    (id) => fetch(BASE + `/repos/${id}`, { method: 'DELETE' }).then(r => r.json()),

  prs:           (params = {}) => get('/prs?' + new URLSearchParams(params)),
  createPR:      (body) => post('/prs', body),
  updatePR:      (id, body) => put(`/prs/${id}`, body),
  deletePR:      (id) => fetch(BASE + `/prs/${id}`, { method: 'DELETE' }).then(r => r.json()),

  readingList:         () => get('/reading-list'),
  createReadingItem:   (body) => post('/reading-list', body),
  updateReadingItem:   (id, body) => put(`/reading-list/${id}`, body),
  deleteReadingItem:   (id) => fetch(BASE + `/reading-list/${id}`, { method: 'DELETE' }).then(r => r.json()),
  reorderReadingList:  (ids) => post('/reading-list/reorder', { ids }),

  documents:     (params = {}) => get('/documents?' + new URLSearchParams(params)),
  uploadDocument: (formData) => fetch('/api/documents', { method: 'POST', body: formData }).then(r => r.json()),
  updateDocument: (id, body) => put(`/documents/${id}`, body),
  deleteDocument: (id) => fetch('/api/documents/' + id, { method: 'DELETE' }).then(r => r.json()),

  workBlocks:    () => get('/work-blocks'),

  dashboard:     () => get('/dashboard'),

  importData:    (body) => post('/import', body),
};
