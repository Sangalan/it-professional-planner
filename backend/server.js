const express = require('express');
const cors = require('cors');
const { db, initSchema } = require('./db');

initSchema();

const app = express();
app.use(cors());
app.use(express.json());

// ── helpers ─────────────────────────────────────────────────────────────────

function computeTaskProgress(objectiveId) {
  if (!objectiveId) return 0;
  const all = db.prepare('SELECT status FROM tasks WHERE objective_id = ? AND is_fixed = 0').all(objectiveId);
  if (!all.length) return 0;
  const done = all.filter(t => t.status === 'completed').length;
  return Math.round((done / all.length) * 100);
}

// Expand fixed-recurrence tasks into virtual instances within [from, to]
function expandFixedTasks(from, to, filters = {}) {
  let sql = `SELECT * FROM tasks WHERE is_fixed = 1 AND fixed_days IS NOT NULL
    AND (fixed_end_date IS NULL OR fixed_end_date >= ?)
    AND (fixed_start_date IS NULL OR fixed_start_date <= ?)`;
  const params = [from, to];
  if (filters.objective_id) { sql += ' AND objective_id = ?'; params.push(filters.objective_id); }
  if (filters.milestone_id) { sql += ' AND milestone_id = ?'; params.push(filters.milestone_id); }

  const templates = db.prepare(sql).all(...params);
  const instances = [];
  for (const ft of templates) {
    const days = JSON.parse(ft.fixed_days || '[]');
    let d = new Date(from + 'T12:00:00');
    const end = new Date(to + 'T12:00:00');
    const startBound = ft.fixed_start_date ? new Date(ft.fixed_start_date + 'T12:00:00') : null;
    const endBound   = ft.fixed_end_date   ? new Date(ft.fixed_end_date   + 'T12:00:00') : null;
    while (d <= end) {
      if (days.includes(d.getDay())) {
        if ((!startBound || d >= startBound) && (!endBound || d <= endBound)) {
          instances.push({ ...ft, date: d.toISOString().slice(0, 10), is_overdue: 0 });
        }
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return instances;
}

function computeMilestoneProgress(milestoneId) {
  if (!milestoneId) return 0;
  const all = db.prepare('SELECT status FROM tasks WHERE milestone_id = ? AND is_fixed = 0').all(milestoneId);
  if (!all.length) return 0;
  const done = all.filter(t => t.status === 'completed').length;
  return Math.round((done / all.length) * 100);
}

function deriveMilestoneStatus(currentStatus, pct) {
  if (currentStatus === 'blocked') return 'blocked';
  if (pct === 100) return 'completed';
  if (pct > 0)    return 'in_progress';
  return 'not_started';
}

function recomputeForTask(milestoneId, objectiveId) {
  if (milestoneId) {
    const pct = computeMilestoneProgress(milestoneId);
    const ms  = db.prepare('SELECT status FROM milestones WHERE id = ?').get(milestoneId);
    if (ms) {
      db.prepare('UPDATE milestones SET percentage_completed = ?, status = ? WHERE id = ?')
        .run(pct, deriveMilestoneStatus(ms.status, pct), milestoneId);
    }
  }
  if (objectiveId) {
    const pct = computeTaskProgress(objectiveId);
    const obj = db.prepare('SELECT status FROM objectives WHERE id = ?').get(objectiveId);
    if (obj) {
      db.prepare('UPDATE objectives SET percentage_completed = ?, status = ? WHERE id = ?')
        .run(pct, deriveObjectiveStatus(obj.status, pct), objectiveId);
    }
  }
}

function deriveObjectiveStatus(currentStatus, pct) {
  if (currentStatus === 'blocked') return 'blocked';
  if (pct === 100) return 'completed';
  if (pct > 0)    return 'in_progress';
  return 'not_started';
}

function daysRemaining(dateStr) {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = Math.ceil((target - now) / 86400000);
  return diff;
}

function isOverdue(dateStr, status) {
  if (status === 'completed') return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ── CATEGORIES ──────────────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories').all());
});

app.post('/api/categories', (req, res) => {
  const { id, name, color } = req.body;
  if (!id || !name || !color) return res.status(400).json({ error: 'id, name y color son obligatorios' });
  if (db.prepare('SELECT id FROM categories WHERE id = ?').get(id))
    return res.status(409).json({ error: 'Ya existe una categoría con ese id' });
  db.prepare('INSERT INTO categories (id, name, color) VALUES (?, ?, ?)').run(id, name, color);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

app.put('/api/categories/:id', (req, res) => {
  const { name, color } = req.body;
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE categories SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?')
    .run(name ?? null, color ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

app.delete('/api/categories/:id', (req, res) => {
  const id = req.params.id;
  const checks = [
    ['tasks',          'tareas'],
    ['objectives',     'objetivos'],
    ['events',         'eventos'],
    ['publications',   'publicaciones'],
    ['certifications', 'certificaciones'],
    ['repos',          'repositorios'],
    ['prs',            'PRs'],
    ['work_blocks',    'bloques de trabajo'],
  ];
  const usages = checks
    .map(([t, l]) => ({ l, n: db.prepare(`SELECT COUNT(*) as n FROM ${t} WHERE category_id = ?`).get(id).n }))
    .filter(u => u.n > 0);
  if (usages.length > 0) {
    return res.status(409).json({ error: `Categoría en uso: ${usages.map(u => `${u.n} ${u.l}`).join(', ')}` });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ── TASKS ────────────────────────────────────────────────────────────────────
app.get('/api/tasks/search', (req, res) => {
  const { q, from, to, category_id, status, objective_id } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (q)            { sql += ' AND title LIKE ?';       params.push(`%${q}%`); }
  if (from)         { sql += ' AND date >= ?';           params.push(from); }
  if (to)           { sql += ' AND date <= ?';           params.push(to); }
  if (category_id)  { sql += ' AND category_id = ?';    params.push(category_id); }
  if (status)       { sql += ' AND status = ?';         params.push(status); }
  if (objective_id) { sql += ' AND objective_id = ?';   params.push(objective_id); }

  sql += ' ORDER BY date, start_time LIMIT 200';
  const tasks = db.prepare(sql).all(...params);
  const today = new Date().toISOString().slice(0, 10);
  tasks.forEach(t => { t.is_overdue = isOverdue(t.date, t.status) ? 1 : 0; });
  res.json(tasks);
});

app.get('/api/tasks', (req, res) => {
  const { date, category_id, status, from, to, objective_id } = req.query;
  // Non-fixed tasks
  let sql = 'SELECT * FROM tasks WHERE is_fixed = 0';
  const params = [];

  if (date)         { sql += ' AND date = ?';           params.push(date); }
  if (from)         { sql += ' AND date >= ?';           params.push(from); }
  if (to)           { sql += ' AND date <= ?';           params.push(to); }
  if (category_id)  { sql += ' AND category_id = ?';    params.push(category_id); }
  if (status)       { sql += ' AND status = ?';         params.push(status); }
  if (objective_id)               { sql += ' AND objective_id = ?';                    params.push(objective_id); }
  if (req.query.milestone_id)     { sql += ' AND milestone_id = ?';                    params.push(req.query.milestone_id); }
  if (req.query.no_milestone === '1') { sql += ' AND (milestone_id IS NULL OR milestone_id = \'\')'; }

  sql += ' ORDER BY date, start_time';
  const tasks = db.prepare(sql).all(...params);
  tasks.forEach(t => { t.is_overdue = isOverdue(t.date, t.status) ? 1 : 0; });

  // Expand fixed tasks when querying a date range
  const fixed = (from && to) ? expandFixedTasks(from, to, {
    objective_id: objective_id || null,
    milestone_id: req.query.milestone_id || null,
  }) : (date ? expandFixedTasks(date, date) : []);

  res.json([...tasks, ...fixed]);
});

app.get('/api/tasks/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = db.prepare('SELECT * FROM tasks WHERE is_fixed = 0 AND date = ? ORDER BY start_time').all(today);
  tasks.forEach(t => { t.is_overdue = isOverdue(t.date, t.status) ? 1 : 0; });
  const fixed = expandFixedTasks(today, today);
  res.json([...tasks, ...fixed].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
});

app.get('/api/tasks/week', (req, res) => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = monday.toISOString().slice(0, 10);
  const to = sunday.toISOString().slice(0, 10);
  const tasks = db.prepare('SELECT * FROM tasks WHERE is_fixed = 0 AND date BETWEEN ? AND ? ORDER BY date, start_time').all(from, to);
  tasks.forEach(t => { t.is_overdue = isOverdue(t.date, t.status) ? 1 : 0; });
  const fixed = expandFixedTasks(from, to);
  res.json([...tasks, ...fixed]);
});

app.get('/api/tasks/now', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 5);
  const regular = db.prepare('SELECT * FROM tasks WHERE is_fixed = 0 AND date = ? AND start_time IS NOT NULL ORDER BY start_time').all(today);
  const fixed = expandFixedTasks(today, today).filter(t => t.start_time);
  const tasks = [...regular, ...fixed].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const active = tasks.find(t => t.start_time <= timeStr && t.end_time > timeStr);
  const upcoming = tasks.filter(t => t.start_time > timeStr).sort((a, b) => a.start_time.localeCompare(b.start_time));

  res.json({ current: active || null, upcoming: upcoming[0] || null, time: timeStr, date: today });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  task.is_overdue = isOverdue(task.date, task.status) ? 1 : 0;
  res.json(task);
});

function parseCategoryIds(category_ids, category_id) {
  if (Array.isArray(category_ids) && category_ids.length) return category_ids;
  if (typeof category_ids === 'string') {
    try { const p = JSON.parse(category_ids); if (Array.isArray(p)) return p; } catch (_) {}
  }
  return category_id ? [category_id] : [];
}

app.post('/api/tasks', (req, res) => {
  const { title, description, category_id, category_ids, date, start_time, end_time,
    duration_estimated, priority, objective_id, milestone_id, is_fixed,
    fixed_days, fixed_start_date, fixed_end_date, notes, label } = req.body;

  const isFixed = is_fixed ? 1 : 0;
  // For fixed tasks, date defaults to fixed_start_date; for regular tasks date is required
  const effectiveDate = date || (isFixed ? fixed_start_date : null);
  if (!title || !effectiveDate) return res.status(400).json({ error: 'title y date son obligatorios' });

  const cats = parseCategoryIds(category_ids, category_id);
  const primaryCat = cats[0] || null;

  function timeDiff(s, e) {
    if (!s || !e) return null;
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  const id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  db.prepare(`INSERT INTO tasks
    (id,title,description,category_id,category_ids,subcategory,date,start_time,end_time,
     duration_estimated,status,priority,objective_id,milestone_id,is_fixed,
     fixed_days,fixed_start_date,fixed_end_date,notes,label,percentage_completed)
    VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,0)`)
    .run(id, title, description || '', primaryCat, JSON.stringify(cats), '',
      effectiveDate, start_time || null, end_time || null,
      duration_estimated ?? timeDiff(start_time, end_time),
      priority ?? 2, objective_id || null, milestone_id || null,
      isFixed,
      isFixed && fixed_days ? JSON.stringify(fixed_days) : null,
      isFixed ? (fixed_start_date || null) : null,
      isFixed ? (fixed_end_date || null) : null,
      notes || '', label || '');

  recomputeForTask(milestone_id || null, objective_id || null);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

app.put('/api/tasks/:id', (req, res) => {
  const { title, description, category_id, category_ids, date, start_time, end_time,
    duration_estimated, priority, objective_id, milestone_id, is_fixed,
    fixed_days, fixed_start_date, fixed_end_date,
    status, percentage_completed, notes, label } = req.body;

  const cats = category_ids !== undefined ? parseCategoryIds(category_ids, category_id) : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  function timeDiff(s, e) {
    if (!s || !e) return null;
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  db.prepare(`UPDATE tasks SET
    title               = COALESCE(@title,       title),
    description         = COALESCE(@description, description),
    category_id         = COALESCE(@category_id, category_id),
    category_ids        = COALESCE(@category_ids,category_ids),
    date                = COALESCE(@date,        date),
    start_time          = COALESCE(@start_time,  start_time),
    end_time            = COALESCE(@end_time,    end_time),
    duration_estimated  = COALESCE(@dur,         duration_estimated),
    priority            = COALESCE(@priority,    priority),
    objective_id        = COALESCE(@objective_id, objective_id),
    milestone_id        = COALESCE(@milestone_id, milestone_id),
    is_fixed            = COALESCE(@is_fixed,    is_fixed),
    fixed_days          = COALESCE(@fixed_days,  fixed_days),
    fixed_start_date    = COALESCE(@fixed_start_date, fixed_start_date),
    fixed_end_date      = COALESCE(@fixed_end_date,   fixed_end_date),
    status              = COALESCE(@status,      status),
    percentage_completed= COALESCE(@pct,         percentage_completed),
    notes               = COALESCE(@notes,       notes),
    label               = COALESCE(@label,       label)
    WHERE id = @id`).run({
      title: title ?? null,
      description: description ?? null,
      category_id: primaryCat,
      category_ids: cats ? JSON.stringify(cats) : null,
      date: date ?? null,
      start_time: start_time ?? null,
      end_time: end_time ?? null,
      dur: duration_estimated ?? (start_time && end_time ? timeDiff(start_time, end_time) : null),
      priority: priority ?? null,
      objective_id: objective_id ?? null,
      milestone_id: milestone_id ?? null,
      is_fixed: is_fixed !== undefined ? (is_fixed ? 1 : 0) : null,
      fixed_days: fixed_days !== undefined ? (Array.isArray(fixed_days) ? JSON.stringify(fixed_days) : fixed_days) : null,
      fixed_start_date: fixed_start_date ?? null,
      fixed_end_date: fixed_end_date ?? null,
      status: status ?? null,
      pct: percentage_completed ?? null,
      notes: notes ?? null,
      label: label ?? null,
      id: req.params.id,
    });

  // Allow explicit null for milestone_id (COALESCE ignores nulls)
  if ('milestone_id' in req.body) {
    db.prepare('UPDATE tasks SET milestone_id = ? WHERE id = ?').run(milestone_id ?? null, req.params.id);
  }

  // Recompute milestone + objective (both old and new ids in case they changed)
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  const milestoneIds = [...new Set([task.milestone_id, updatedTask.milestone_id].filter(Boolean))];
  const objectiveIds = [...new Set([task.objective_id, updatedTask.objective_id].filter(Boolean))];
  for (const mid of milestoneIds) recomputeForTask(mid, null);
  for (const oid of objectiveIds) recomputeForTask(null, oid);

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

app.delete('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  recomputeForTask(task.milestone_id, task.objective_id);
  res.json({ ok: true });
});

// ── OBJECTIVES ───────────────────────────────────────────────────────────────
app.get('/api/objectives', (req, res) => {
  const objectives = db.prepare('SELECT * FROM objectives ORDER BY priority, start_date').all();
  for (const obj of objectives) {
    obj.milestones = db.prepare(`
      SELECT * FROM milestones WHERE objective_id = ?
      ORDER BY
        CASE WHEN status = 'completed' THEN 1 ELSE 0 END ASC,
        target_date ASC NULLS LAST
    `).all(obj.id);
    obj.task_count = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE objective_id = ?').get(obj.id).n;
    obj.done_count = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE objective_id = ? AND status = 'completed'").get(obj.id).n;
    const orphanRows = db.prepare("SELECT status FROM tasks WHERE objective_id = ? AND (milestone_id IS NULL OR milestone_id = '')").all(obj.id);
    obj.orphan_count = orphanRows.length;
    obj.orphan_done  = orphanRows.filter(t => t.status === 'completed').length;
    for (const m of obj.milestones) {
      m.days_remaining = daysRemaining(m.target_date);
      const mTasks = db.prepare('SELECT status FROM tasks WHERE milestone_id = ?').all(m.id);
      m.task_total = mTasks.length;
      m.task_done  = mTasks.filter(t => t.status === 'completed').length;
      m.percentage_completed = m.task_total > 0
        ? Math.round((m.task_done / m.task_total) * 100)
        : 0;
      m.status = deriveMilestoneStatus(m.status, m.percentage_completed);
    }
    obj.days_remaining = daysRemaining(obj.end_date);
    const pct = computeTaskProgress(obj.id);
    obj.percentage_completed = pct;
    obj.status = deriveObjectiveStatus(obj.status, pct);
  }
  res.json(objectives);
});

app.post('/api/objectives', (req, res) => {
  const { title, description, category_id, start_date, end_date, target_value, progress_mode, priority, status, notes, color } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'obj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  db.prepare(`INSERT INTO objectives (id,title,description,category_id,start_date,end_date,target_value,progress_mode,percentage_completed,status,priority,notes,color)
    VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?)`)
    .run(id, title, description || '', category_id || null, start_date || null, end_date || null,
      target_value || null, progress_mode || 'task_based', status || 'not_started', priority ?? 2, notes || '', color || null);
  res.status(201).json(db.prepare('SELECT * FROM objectives WHERE id = ?').get(id));
});

app.delete('/api/objectives/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE objective_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Este objetivo tiene ${tasks} tareas asignadas` });
  const milestones = db.prepare('SELECT COUNT(*) as n FROM milestones WHERE objective_id = ?').get(req.params.id).n;
  if (milestones > 0) return res.status(409).json({ error: `Este objetivo tiene ${milestones} hitos asociados. Elimínalos primero.` });
  db.prepare('DELETE FROM objectives WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.put('/api/objectives/:id', (req, res) => {
  const { title, description, target_value, start_date, end_date, priority, status, notes, color } = req.body;
  // percentage_completed is always computed from tasks — never manually set
  const pct = computeTaskProgress(req.params.id);
  const obj = db.prepare('SELECT status FROM objectives WHERE id = ?').get(req.params.id);
  const derivedStatus = status !== undefined ? deriveObjectiveStatus(status, pct) : deriveObjectiveStatus(obj?.status, pct);
  db.prepare(`UPDATE objectives SET
    title                = COALESCE(@title,        title),
    description          = COALESCE(@description,  description),
    target_value         = COALESCE(@target_value, target_value),
    start_date           = COALESCE(@start_date,   start_date),
    end_date             = COALESCE(@end_date,      end_date),
    priority             = COALESCE(@priority,     priority),
    status               = @status,
    percentage_completed = @pct,
    notes                = COALESCE(@notes,        notes),
    color                = COALESCE(@color,        color)
    WHERE id = @id`).run({
      title: title ?? null, description: description ?? null,
      target_value: target_value ?? null, start_date: start_date ?? null,
      end_date: end_date ?? null, priority: priority ?? null,
      status: derivedStatus, pct, notes: notes ?? null,
      color: color ?? null,
      id: req.params.id,
    });
  res.json(db.prepare('SELECT * FROM objectives WHERE id = ?').get(req.params.id));
});

// ── MILESTONES ───────────────────────────────────────────────────────────────
app.get('/api/milestones', (req, res) => {
  const ms = db.prepare('SELECT * FROM milestones ORDER BY target_date').all();
  ms.forEach(m => { m.days_remaining = daysRemaining(m.target_date); });
  res.json(ms);
});

app.post('/api/milestones', (req, res) => {
  const { objective_id, title, description, target_date, weight, status } = req.body;
  if (!title || !objective_id) return res.status(400).json({ error: 'title y objective_id son obligatorios' });
  const id = 'ms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  db.prepare('INSERT INTO milestones (id,objective_id,title,description,target_date,percentage_completed,status,weight) VALUES (?,?,?,?,?,0,?,?)')
    .run(id, objective_id, title, description || '', target_date || null, status || 'not_started', weight ?? 10);
  res.status(201).json(db.prepare('SELECT * FROM milestones WHERE id = ?').get(id));
});

app.delete('/api/milestones/:id', (req, res) => {
  const inUse = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (inUse > 0) return res.status(409).json({ error: `Este hito tiene ${inUse} tareas asignadas` });
  db.prepare('DELETE FROM milestones WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.put('/api/milestones/:id', (req, res) => {
  const { title, description, target_date, status } = req.body;
  // percentage_completed and weight are no longer manually set — always computed from tasks
  const pct = computeMilestoneProgress(req.params.id);
  const ms  = db.prepare('SELECT status FROM milestones WHERE id = ?').get(req.params.id);
  const derivedStatus = status ? deriveMilestoneStatus(status, pct) : (ms ? deriveMilestoneStatus(ms.status, pct) : 'not_started');
  db.prepare(`UPDATE milestones SET
    title                = COALESCE(@title,       title),
    description          = COALESCE(@description, description),
    target_date          = COALESCE(@target_date, target_date),
    status               = @status,
    percentage_completed = @pct
    WHERE id = @id`).run({
      title: title ?? null, description: description ?? null,
      target_date: target_date ?? null, status: derivedStatus, pct, id: req.params.id,
    });
  res.json(db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.id));
});

// ── EVENTS ───────────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  const { from, to, objective_id } = req.query;
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  if (from)         { sql += ' AND end_date >= ?';    params.push(from); }
  if (to)           { sql += ' AND start_date <= ?';  params.push(to); }
  if (objective_id) { sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY start_date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(e => { e.days_remaining = daysRemaining(e.end_date || e.start_date); });
  res.json(rows);
});

app.post('/api/events', (req, res) => {
  const { title, start_date, end_date, location, format, estimated_cost, status, notes, objective_id, category_id, category_ids, percentage_completed, registered, hotel_booked, flight_booked } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  db.prepare('INSERT INTO events (id,title,start_date,end_date,location,format,estimated_cost,status,notes,objective_id,category_id,category_ids,percentage_completed,registered,hotel_booked,flight_booked) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, start_date||null, end_date||null, location||null, format||null, estimated_cost||0, status||'not_started', notes||null, objective_id||null, primaryCat, cats.length ? JSON.stringify(cats) : null, percentage_completed||0, registered?1:0, hotel_booked?1:0, flight_booked?1:0);
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  ev.days_remaining = daysRemaining(ev.end_date || ev.start_date);
  res.status(201).json(ev);
});

app.put('/api/events/:id', (req, res) => {
  const { title, start_date, end_date, location, format, estimated_cost, status, notes, objective_id, category_id, category_ids, percentage_completed, registered, hotel_booked, flight_booked } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  db.prepare(`UPDATE events SET
    title                = COALESCE(@title, title),
    start_date           = COALESCE(@sd,    start_date),
    end_date             = COALESCE(@ed,    end_date),
    location             = COALESCE(@loc,   location),
    format               = COALESCE(@fmt,   format),
    estimated_cost       = COALESCE(@cost,  estimated_cost),
    status               = COALESCE(@s,     status),
    notes                = COALESCE(@n,     notes),
    objective_id         = COALESCE(@oid,   objective_id),
    category_id          = COALESCE(@cat,   category_id),
    category_ids         = COALESCE(@cids,  category_ids),
    percentage_completed = COALESCE(@pct,   percentage_completed),
    registered           = COALESCE(@reg,   registered),
    hotel_booked         = COALESCE(@htl,   hotel_booked),
    flight_booked        = COALESCE(@flt,   flight_booked)
    WHERE id = @id`)
    .run({ title: title??null, sd: start_date??null, ed: end_date??null, loc: location??null,
      fmt: format??null, cost: estimated_cost??null, s: status??null, n: notes??null,
      oid: objective_id??null, cat: primaryCat, cids: cats ? JSON.stringify(cats) : null,
      pct: percentage_completed??null,
      reg: registered !== undefined ? (registered ? 1 : 0) : null,
      htl: hotel_booked !== undefined ? (hotel_booked ? 1 : 0) : null,
      flt: flight_booked !== undefined ? (flight_booked ? 1 : 0) : null,
      id: req.params.id });
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  ev.days_remaining = daysRemaining(ev.end_date || ev.start_date);
  res.json(ev);
});

app.delete('/api/events/:id', (req, res) => {
  const linked = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (linked > 0) return res.status(409).json({ error: `Este evento tiene ${linked} tareas asociadas` });
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── PUBLICATIONS ─────────────────────────────────────────────────────────────
app.get('/api/publications', (req, res) => {
  const { from, to, objective_id } = req.query;
  let sql = 'SELECT * FROM publications WHERE 1=1';
  const params = [];
  if (from)        { sql += ' AND date >= ?';        params.push(from); }
  if (to)          { sql += ' AND date <= ?';        params.push(to); }
  if (objective_id){ sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(p => { p.days_remaining = daysRemaining(p.date); });
  res.json(rows);
});

app.post('/api/publications', (req, res) => {
  const { title, type, date, status, notes, objective_id, category_id, category_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'pub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  db.prepare('INSERT INTO publications (id,title,type,date,status,notes,objective_id,category_id,category_ids) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, title, type || 'post', date || null, status || 'pending', notes || null, objective_id || null, primaryCat, cats.length ? JSON.stringify(cats) : null);
  const pub = db.prepare('SELECT * FROM publications WHERE id = ?').get(id);
  pub.days_remaining = daysRemaining(pub.date);
  res.status(201).json(pub);
});

app.put('/api/publications/:id', (req, res) => {
  const { status, notes, objective_id, title, type, date, category_id, category_ids } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  db.prepare(`UPDATE publications SET
    title        = COALESCE(@title,       title),
    type         = COALESCE(@type,        type),
    date         = COALESCE(@date,        date),
    status       = COALESCE(@status,      status),
    notes        = COALESCE(@notes,       notes),
    objective_id = COALESCE(@oid,         objective_id),
    category_id  = COALESCE(@cat,         category_id),
    category_ids = COALESCE(@cids,        category_ids)
    WHERE id = @id`)
    .run({
      title: title ?? null, type: type ?? null, date: date ?? null,
      status: status ?? null, notes: notes ?? null, oid: objective_id ?? null,
      cat: primaryCat, cids: cats ? JSON.stringify(cats) : null,
      id: req.params.id,
    });
  const pub = db.prepare('SELECT * FROM publications WHERE id = ?').get(req.params.id);
  pub.days_remaining = daysRemaining(pub.date);
  res.json(pub);
});

app.delete('/api/publications/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Esta publicación tiene ${tasks} tareas asociadas` });
  db.prepare('DELETE FROM publications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── CERTIFICATIONS ───────────────────────────────────────────────────────────
app.get('/api/certifications', (req, res) => {
  const { objective_id } = req.query;
  let sql = 'SELECT * FROM certifications WHERE 1=1';
  const params = [];
  if (objective_id) { sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY target_date';
  const certs = db.prepare(sql).all(...params);
  certs.forEach(c => { c.days_remaining = daysRemaining(c.target_date); });
  res.json(certs);
});

app.post('/api/certifications', (req, res) => {
  const { title, target_date, status, notes, objective_id, category_id, category_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'cert-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  db.prepare('INSERT INTO certifications (id,title,target_date,status,notes,objective_id,category_id,category_ids) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, title, target_date || null, status || 'not_started', notes || null, objective_id || null, primaryCat, cats.length ? JSON.stringify(cats) : null);
  const cert = db.prepare('SELECT * FROM certifications WHERE id = ?').get(id);
  cert.days_remaining = daysRemaining(cert.target_date);
  res.status(201).json(cert);
});

app.put('/api/certifications/:id', (req, res) => {
  const { status, notes, objective_id, category_id, category_ids, percentage_completed } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  db.prepare(`UPDATE certifications SET
    status               = COALESCE(@s,   status),
    notes                = COALESCE(@n,   notes),
    objective_id         = COALESCE(@oid, objective_id),
    category_id          = COALESCE(@cat, category_id),
    category_ids         = COALESCE(@cids,category_ids),
    percentage_completed = COALESCE(@pct, percentage_completed)
    WHERE id = @id`)
    .run({ s: status ?? null, n: notes ?? null, oid: objective_id ?? null,
      cat: primaryCat, cids: cats ? JSON.stringify(cats) : null,
      pct: percentage_completed ?? null, id: req.params.id });
  const cert = db.prepare('SELECT * FROM certifications WHERE id = ?').get(req.params.id);
  cert.days_remaining = daysRemaining(cert.target_date);
  res.json(cert);
});

app.delete('/api/certifications/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Esta certificación tiene ${tasks} tareas asociadas` });
  db.prepare('DELETE FROM certifications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── REPOS ─────────────────────────────────────────────────────────────────────
app.get('/api/repos', (req, res) => {
  const { objective_id } = req.query;
  let sql = 'SELECT * FROM repos WHERE 1=1';
  const params = [];
  if (objective_id) { sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY target_date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => { r.days_remaining = daysRemaining(r.target_date); });
  res.json(rows);
});

app.post('/api/repos', (req, res) => {
  const { title, target_date, status, notes, objective_id, url, category_id, category_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'repo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  db.prepare('INSERT INTO repos (id,title,target_date,status,notes,objective_id,url,category_id,category_ids) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, title, target_date || null, status || 'not_started', notes || null, objective_id || null, url || null, primaryCat, cats.length ? JSON.stringify(cats) : null);
  const repo = db.prepare('SELECT * FROM repos WHERE id = ?').get(id);
  repo.days_remaining = daysRemaining(repo.target_date);
  res.status(201).json(repo);
});

app.put('/api/repos/:id', (req, res) => {
  const { status, notes, objective_id, category_id, category_ids, url } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats !== null ? (cats[0] || null) : (category_id ?? null);
  // Use direct assignment for category fields when explicitly provided (allows clearing to null)
  const catClause = cats !== null
    ? 'category_id = @cat, category_ids = @cids,'
    : 'category_id = COALESCE(@cat, category_id), category_ids = COALESCE(@cids, category_ids),';
  db.prepare(`UPDATE repos SET
    status       = COALESCE(@s,   status),
    notes        = COALESCE(@n,   notes),
    objective_id = COALESCE(@oid, objective_id),
    ${catClause}
    url          = COALESCE(@url, url)
    WHERE id = @id`)
    .run({ s: status ?? null, n: notes ?? null, oid: objective_id ?? null,
      cat: primaryCat, cids: cats !== null ? JSON.stringify(cats) : null,
      url: url ?? null, id: req.params.id });
  const repo = db.prepare('SELECT * FROM repos WHERE id = ?').get(req.params.id);
  repo.days_remaining = daysRemaining(repo.target_date);
  res.json(repo);
});

app.delete('/api/repos/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Este repositorio tiene ${tasks} tareas asociadas` });
  db.prepare('DELETE FROM repos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── PRs ──────────────────────────────────────────────────────────────────────
app.get('/api/prs', (req, res) => {
  const { objective_id } = req.query;
  let sql = 'SELECT * FROM prs WHERE 1=1';
  const params = [];
  if (objective_id) { sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY start_date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => { r.days_remaining = daysRemaining(r.end_date); });
  res.json(rows);
});

app.post('/api/prs', (req, res) => {
  const { title, start_date, end_date, status, notes, objective_id, category_id, category_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  db.prepare('INSERT INTO prs (id,title,start_date,end_date,status,notes,objective_id,category_id,category_ids) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, title, start_date || null, end_date || null, status || 'not_started', notes || null, objective_id || null, primaryCat, cats.length ? JSON.stringify(cats) : null);
  const pr = db.prepare('SELECT * FROM prs WHERE id = ?').get(id);
  pr.days_remaining = daysRemaining(pr.end_date);
  res.status(201).json(pr);
});

app.put('/api/prs/:id', (req, res) => {
  const { status, notes, objective_id, category_id, category_ids, percentage_completed } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  db.prepare(`UPDATE prs SET
    status               = COALESCE(@s,   status),
    notes                = COALESCE(@n,   notes),
    objective_id         = COALESCE(@oid, objective_id),
    category_id          = COALESCE(@cat, category_id),
    category_ids         = COALESCE(@cids,category_ids),
    percentage_completed = COALESCE(@pct, percentage_completed)
    WHERE id = @id`)
    .run({ s: status ?? null, n: notes ?? null, oid: objective_id ?? null,
      cat: primaryCat, cids: cats ? JSON.stringify(cats) : null,
      pct: percentage_completed ?? null, id: req.params.id });
  const pr = db.prepare('SELECT * FROM prs WHERE id = ?').get(req.params.id);
  pr.days_remaining = daysRemaining(pr.end_date);
  res.json(pr);
});

app.delete('/api/prs/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Este PR tiene ${tasks} tareas asociadas` });
  db.prepare('DELETE FROM prs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── READING LIST ─────────────────────────────────────────────────────────────
app.get('/api/reading-list', (req, res) => {
  const rows = db.prepare('SELECT * FROM reading_list ORDER BY sort_order ASC, created_at DESC').all();
  res.json(rows);
});

app.post('/api/reading-list', (req, res) => {
  const { title, urls, category_ids, category_id, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'rl-' + Date.now();
  const minOrder = db.prepare('SELECT MIN(sort_order) as m FROM reading_list').get().m ?? 0;
  const sortOrder = minOrder - 1;
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  const urlsJson = Array.isArray(urls) ? JSON.stringify(urls) : (urls || null);
  db.prepare(`INSERT INTO reading_list (id, title, urls, category_ids, category_id, notes, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`)
    .run(id, title, urlsJson, cats.length ? JSON.stringify(cats) : null, primaryCat, notes || null, sortOrder);
  res.json(db.prepare('SELECT * FROM reading_list WHERE id = ?').get(id));
});

// IMPORTANT: /reorder must be before /:id to avoid route conflict
app.post('/api/reading-list/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids debe ser un array' });
  const update = db.prepare('UPDATE reading_list SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(() => {
    ids.forEach((id, i) => update.run(i, id));
  });
  tx();
  res.json({ ok: true });
});

app.put('/api/reading-list/:id', (req, res) => {
  const { title, urls, category_ids, category_id, notes, status } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  const urlsJson = urls !== undefined ? (Array.isArray(urls) ? JSON.stringify(urls) : urls) : undefined;
  db.prepare(`UPDATE reading_list SET
    title        = COALESCE(@title,  title),
    urls         = COALESCE(@urls,   urls),
    category_ids = COALESCE(@cids,   category_ids),
    category_id  = COALESCE(@cat,    category_id),
    notes        = COALESCE(@notes,  notes),
    status       = COALESCE(@status, status)
    WHERE id = @id`)
    .run({
      title: title ?? null, urls: urlsJson ?? null,
      cids: cats ? JSON.stringify(cats) : null, cat: primaryCat,
      notes: notes ?? null, status: status ?? null, id: req.params.id,
    });
  res.json(db.prepare('SELECT * FROM reading_list WHERE id = ?').get(req.params.id));
});

app.delete('/api/reading-list/:id', (req, res) => {
  db.prepare('DELETE FROM reading_list WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── WORK BLOCKS ───────────────────────────────────────────────────────────────
app.get('/api/work-blocks', (req, res) => {
  res.json(db.prepare('SELECT * FROM work_blocks ORDER BY start_time').all());
});

// ── DASHBOARD ────────────────────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks  = db.prepare('SELECT * FROM tasks WHERE date = ? ORDER BY start_time').all(today);
  const totalTasks  = db.prepare('SELECT COUNT(*) as n FROM tasks').get().n;
  const doneTasks   = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status = 'completed'").get().n;
  const overdueTasks= db.prepare(`SELECT * FROM tasks WHERE date < ? AND status != 'completed' ORDER BY date`).all(today);

  const nextMilestones = db.prepare(`SELECT m.*, o.title as obj_title FROM milestones m
    JOIN objectives o ON m.objective_id = o.id
    WHERE m.status != 'completed' AND m.target_date >= ?
    ORDER BY m.target_date LIMIT 5`).all(today);
  nextMilestones.forEach(m => { m.days_remaining = daysRemaining(m.target_date); });

  // Next 7 days events
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 7);
  const nextWeek = nextDate.toISOString().slice(0, 10);
  const nextEvents = db.prepare('SELECT * FROM events WHERE start_date BETWEEN ? AND ? ORDER BY start_date').all(today, nextWeek);

  // Progress by objective (filled after objHoursMap is ready below)
  const objectives = db.prepare('SELECT * FROM objectives ORDER BY priority').all();

  // Tasks by category (last 30 days)
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const catStats = db.prepare(`
    SELECT category_id,
      COUNT(*) as total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done
    FROM tasks WHERE date >= ? GROUP BY category_id
  `).all(thirtyAgo.toISOString().slice(0, 10));

  // Hours per objective (completed tasks, all time)
  const objHoursRows = db.prepare(`
    SELECT objective_id,
      SUM(
        CASE
          WHEN duration_estimated IS NOT NULL AND duration_estimated > 0 THEN duration_estimated
          WHEN start_time IS NOT NULL AND end_time IS NOT NULL THEN
            (CAST(substr(end_time,1,2) AS INTEGER)*60 + CAST(substr(end_time,4,2) AS INTEGER)) -
            (CAST(substr(start_time,1,2) AS INTEGER)*60 + CAST(substr(start_time,4,2) AS INTEGER))
          ELSE 0
        END
      ) / 60.0 as hours
    FROM tasks
    WHERE status = 'completed' AND objective_id IS NOT NULL
    GROUP BY objective_id
  `).all();
  const objHoursMap = {};
  for (const row of objHoursRows) objHoursMap[row.objective_id] = row.hours;

  for (const obj of objectives) {
    obj.task_count = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE objective_id = ?').get(obj.id).n;
    obj.done_count = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE objective_id = ? AND status = 'completed'").get(obj.id).n;
    obj.days_remaining = daysRemaining(obj.end_date);
    obj.hours_completed = Math.round((objHoursMap[obj.id] || 0) * 10) / 10;
  }

  // Publications progress
  const pubTotal = db.prepare('SELECT COUNT(*) as n FROM publications').get().n;
  const pubDone  = db.prepare("SELECT COUNT(*) as n FROM publications WHERE status = 'published'").get().n;

  // Certifications progress
  const certTotal = db.prepare('SELECT COUNT(*) as n FROM certifications').get().n;
  const certDone  = db.prepare("SELECT COUNT(*) as n FROM certifications WHERE status = 'completed'").get().n;

  const globalPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  res.json({
    today,
    today_tasks: { total: todayTasks.length, done: todayTasks.filter(t=>t.status==='completed').length, tasks: todayTasks },
    global_progress: globalPct,
    tasks_total: totalTasks,
    tasks_done: doneTasks,
    overdue_tasks: overdueTasks,
    next_milestones: nextMilestones,
    next_events: nextEvents,
    objectives,
    category_stats: catStats,
    publications: { total: pubTotal, done: pubDone },
    certifications: { total: certTotal, done: certDone },
  });
});


// ── EXPORT / IMPORT ──────────────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  const data = {
    exported_at: new Date().toISOString(),
    version: 1,
    categories:     db.prepare('SELECT * FROM categories').all(),
    objectives:     db.prepare('SELECT * FROM objectives').all(),
    milestones:     db.prepare('SELECT * FROM milestones').all(),
    tasks:          db.prepare('SELECT * FROM tasks').all(),
    events:         db.prepare('SELECT * FROM events').all(),
    publications:   db.prepare('SELECT * FROM publications').all(),
    certifications: db.prepare('SELECT * FROM certifications').all(),
    repos:          db.prepare('SELECT * FROM repos').all(),
    prs:            db.prepare('SELECT * FROM prs').all(),
    work_blocks:    db.prepare('SELECT * FROM work_blocks').all(),
  };
  const filename = `planner-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

app.post('/api/import', (req, res) => {
  const { strategy = 'skip', ...data } = req.body;
  if (!data || !data.categories || !data.tasks) {
    return res.status(400).json({ error: 'JSON inválido. Debe contener al menos categories y tasks.' });
  }

  // Returns the ID to use, or null if the item should be skipped.
  function resolveId(table, originalId) {
    const exists = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(originalId);
    if (!exists) return originalId;
    if (strategy === 'skip') return null;
    // rename: find next available suffix
    let n = 2, candidate;
    do { candidate = `${originalId}-${n++}`; }
    while (db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(candidate));
    return candidate;
  }

  const stats = { inserted: {}, skipped: {} };
  function track(table, inserted) {
    const key = inserted ? 'inserted' : 'skipped';
    stats[key][table] = (stats[key][table] || 0) + 1;
  }

  const doImport = db.transaction(() => {
    for (const c of (data.categories || [])) {
      const id = resolveId('categories', c.id);
      if (!id) { track('categories', false); continue; }
      db.prepare('INSERT INTO categories (id,name,color) VALUES (?,?,?)').run(id, c.name, c.color);
      track('categories', true);
    }
    for (const o of (data.objectives || [])) {
      const id = resolveId('objectives', o.id);
      if (!id) { track('objectives', false); continue; }
      db.prepare('INSERT INTO objectives (id,title,description,category_id,start_date,end_date,target_value,progress_mode,percentage_completed,status,priority,notes,color) VALUES (@id,@title,@description,@category_id,@start_date,@end_date,@target_value,@progress_mode,@percentage_completed,@status,@priority,@notes,@color)')
        .run({ color: null, ...o, id });
      track('objectives', true);
    }
    for (const m of (data.milestones || [])) {
      const id = resolveId('milestones', m.id);
      if (!id) { track('milestones', false); continue; }
      db.prepare('INSERT INTO milestones (id,objective_id,title,description,target_date,percentage_completed,status,weight) VALUES (@id,@objective_id,@title,@description,@target_date,@percentage_completed,@status,@weight)')
        .run({ ...m, id });
      track('milestones', true);
    }
    for (const t of (data.tasks || [])) {
      const id = resolveId('tasks', t.id);
      if (!id) { track('tasks', false); continue; }
      db.prepare('INSERT INTO tasks (id,title,description,category_id,category_ids,subcategory,date,start_time,end_time,duration_estimated,status,priority,objective_id,milestone_id,is_fixed,notes,label,percentage_completed) VALUES (@id,@title,@description,@category_id,@category_ids,@subcategory,@date,@start_time,@end_time,@duration_estimated,@status,@priority,@objective_id,@milestone_id,@is_fixed,@notes,@label,@percentage_completed)')
        .run({ subcategory: '', category_ids: null, ...t, id });
      track('tasks', true);
    }
    for (const e of (data.events || [])) {
      const id = resolveId('events', e.id);
      if (!id) { track('events', false); continue; }
      db.prepare('INSERT INTO events (id,title,start_date,end_date,location,format,estimated_cost,category_id,notes) VALUES (@id,@title,@start_date,@end_date,@location,@format,@estimated_cost,@category_id,@notes)')
        .run({ ...e, id });
      track('events', true);
    }
    for (const p of (data.publications || [])) {
      const id = resolveId('publications', p.id);
      if (!id) { track('publications', false); continue; }
      db.prepare('INSERT INTO publications (id,date,type,title,category_id,status,notes) VALUES (@id,@date,@type,@title,@category_id,@status,@notes)')
        .run({ ...p, id });
      track('publications', true);
    }
    for (const c of (data.certifications || [])) {
      const id = resolveId('certifications', c.id);
      if (!id) { track('certifications', false); continue; }
      db.prepare('INSERT INTO certifications (id,title,target_date,category_id,status,notes) VALUES (@id,@title,@target_date,@category_id,@status,@notes)')
        .run({ ...c, id });
      track('certifications', true);
    }
    for (const r of (data.repos || [])) {
      const id = resolveId('repos', r.id);
      if (!id) { track('repos', false); continue; }
      db.prepare('INSERT INTO repos (id,title,target_date,category_id,status,notes) VALUES (@id,@title,@target_date,@category_id,@status,@notes)')
        .run({ ...r, id });
      track('repos', true);
    }
    for (const p of (data.prs || [])) {
      const id = resolveId('prs', p.id);
      if (!id) { track('prs', false); continue; }
      db.prepare('INSERT INTO prs (id,title,start_date,end_date,category_id,objective_id,status,notes) VALUES (@id,@title,@start_date,@end_date,@category_id,@objective_id,@status,@notes)')
        .run({ ...p, id });
      track('prs', true);
    }
    for (const b of (data.work_blocks || [])) {
      const id = resolveId('work_blocks', b.id);
      if (!id) { track('work_blocks', false); continue; }
      db.prepare('INSERT INTO work_blocks (id,name,type,start_time,end_time,category_id,weekday) VALUES (@id,@name,@type,@start_time,@end_time,@category_id,@weekday)')
        .run({ ...b, id });
      track('work_blocks', true);
    }
  });

  try {
    doImport();
    res.json({ ok: true, strategy, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
