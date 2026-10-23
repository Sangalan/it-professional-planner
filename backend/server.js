const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { db, initSchema } = require('./db');
const { createBackup, importBackup } = require('./backup');
const { readDocxText, readLegacyDocText } = require('./docx-preview');

initSchema();

const app = express();
app.use(cors());
// Backups can contain base64-encoded document uploads, so they can be much
// larger than regular API payloads.
app.use(express.json({ limit: '250mb' }));

const uploadsDir = path.join(__dirname, 'data', 'uploads');

// Authentication is configured entirely through environment variables so no
// Google credentials or allowlisted addresses are shipped to the browser.
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || '').trim();
const ALLOWED_EMAILS = new Set(
  String(process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
);
const SESSION_COOKIE = 'planner_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function authIsConfigured() {
  return !!GOOGLE_CLIENT_ID && SESSION_SECRET.length >= 32 && ALLOWED_EMAILS.size > 0;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
      const separator = part.indexOf('=');
      if (separator < 0) return [part, ''];
      const name = part.slice(0, separator);
      const rawValue = part.slice(separator + 1);
      try { return [name, decodeURIComponent(rawValue)]; } catch (_) { return [name, '']; }
    }),
  );
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readSession(token) {
  if (!token || !SESSION_SECRET) return null;
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch (_) { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.email || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!ALLOWED_EMAILS.has(String(payload.email).toLowerCase())) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function sessionCookie(value, maxAge = SESSION_TTL_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

app.use('/api/auth', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/auth/config', (_req, res) => {
  if (!authIsConfigured()) {
    return res.status(503).json({
      error: 'Google authentication is not configured',
      missing: [
        !GOOGLE_CLIENT_ID && 'GOOGLE_CLIENT_ID',
        SESSION_SECRET.length < 32 && 'SESSION_SECRET (minimum 32 characters)',
        ALLOWED_EMAILS.size === 0 && 'ALLOWED_EMAILS',
      ].filter(Boolean),
    });
  }
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

app.post('/api/auth/google', async (req, res) => {
  if (!authIsConfigured()) return res.status(503).json({ error: 'Google authentication is not configured' });
  const credential = String(req.body?.credential || '');
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    const email = String(profile?.email || '').trim().toLowerCase();
    if (!profile?.email_verified || !ALLOWED_EMAILS.has(email)) {
      return res.status(403).json({ error: 'Email is not allowed' });
    }
    const user = { email, name: profile.name || email, picture: profile.picture || '' };
    user.planner_user_id = ensureAuthenticatedPlannerUser(user).id;
    const token = signSession({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ user });
  } catch (_) {
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  if (!authIsConfigured()) return res.status(503).json({ error: 'Google authentication is not configured' });
  const session = readSession(parseCookies(req)[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  req.authUser = session;
  req.plannerUser = ensureAuthenticatedPlannerUser(session);
  req.userId = req.plannerUser.id;
  next();
}

app.use('/api', requireAuth);
app.get('/uploads/:filename', requireAuth, (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  const document = db.prepare('SELECT id FROM documents WHERE filename = ? AND user_id = ?').get(filename, req.userId);
  if (!document) return res.status(404).end();
  res.sendFile(path.join(uploadsDir, filename));
});
app.get('/api/auth/me', (req, res) => {
  const { email, name, picture } = req.authUser;
  res.json({ user: { email, name, picture, planner_user_id: req.userId } });
});

app.use('/api', (req, _res, next) => {
  // The authenticated Google account is the only authority for data ownership.
  // Ignore the former browser-selected x-user-id/query parameter.
  req.userId = req.plannerUser.id;
  next();
});

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ── helpers ─────────────────────────────────────────────────────────────────
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

function parseContentSections(raw) {
  if (!raw) return { ...DEFAULT_CONTENT_SECTIONS };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...DEFAULT_CONTENT_SECTIONS, ...(parsed || {}) };
  } catch (_) {
    return { ...DEFAULT_CONTENT_SECTIONS };
  }
}

function normalizeIdentityName(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function ensureAuthenticatedPlannerUser(authUser) {
  const email = String(authUser?.email || '').trim().toLowerCase();
  if (!email) throw new Error('Authenticated user has no email');
  const linked = db.prepare('SELECT * FROM users WHERE LOWER(auth_email) = ?').get(email);
  if (linked) return linked;

  const authName = normalizeIdentityName(authUser.name);
  const unlinked = db.prepare("SELECT * FROM users WHERE auth_email IS NULL OR TRIM(auth_email) = ''").all();
  const nameMatches = unlinked.filter(user => {
    const profileName = normalizeIdentityName(user.name);
    return profileName && (profileName === authName || authName.startsWith(`${profileName} `));
  });
  let target = nameMatches.length === 1 ? nameMatches[0] : null;
  if (!target) target = unlinked.find(user => user.id === 'pepito') || null;

  if (target) {
    db.prepare('UPDATE users SET name = ?, auth_email = ? WHERE id = ?')
      .run(String(authUser.name || email).trim(), email, target.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(target.id);
  }

  const base = email.split('@')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
  let id = base;
  let suffix = 2;
  while (db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) id = `${base}-${suffix++}`;
  db.prepare('INSERT INTO users (id,name,color,content_sections,auth_email) VALUES (?,?,?,?,?)')
    .run(id, String(authUser.name || email).trim(), '#2563eb', JSON.stringify(DEFAULT_CONTENT_SECTIONS), email);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserContentSections(userId) {
  const row = db.prepare('SELECT content_sections FROM users WHERE id = ?').get(userId);
  return parseContentSections(row?.content_sections || null);
}

function isSectionEnabled(userId, section) {
  return !!getUserContentSections(userId)[section];
}

function getHiddenTaskRefs(userId, includeInactive = false) {
  const sections = getUserContentSections(userId);
  const hiddenMilestoneIds = [];
  const pushIds = (table) => {
    const ids = db.prepare(`SELECT id FROM ${table} WHERE user_id = ?`).all(userId).map(r => r.id);
    hiddenMilestoneIds.push(...ids);
  };
  if (!sections.publications) pushIds('publications');
  if (!sections.certifications) pushIds('certifications');
  if (!sections.repos) pushIds('repos');
  if (!sections.prs) pushIds('prs');
  if (!sections.events) pushIds('events');

  const hiddenObjectiveIds = !sections.clients
    ? db.prepare("SELECT id FROM objectives WHERE user_id = ? AND type = 'client'").all(userId).map(r => r.id)
    : [];
  hiddenObjectiveIds.push(...db.prepare('SELECT id FROM objectives WHERE user_id = ? AND archived_at IS NOT NULL').all(userId).map(r => r.id));
  for (const table of ['milestones', 'events', 'publications', 'certifications', 'repos', 'prs']) {
    hiddenMilestoneIds.push(...db.prepare(`SELECT id FROM ${table} WHERE user_id = ? AND archived_at IS NOT NULL`).all(userId).map(r => r.id));
  }

  if (includeInactive) {
    const inactiveStatuses = ['postponed', 'discarded', 'failed'];
    const placeholders = inactiveStatuses.map(() => '?').join(',');
    for (const table of ['milestones', 'publications', 'certifications', 'repos', 'prs', 'events']) {
      const ids = db.prepare(`SELECT id FROM ${table} WHERE user_id = ? AND status IN (${placeholders})`)
        .all(userId, ...inactiveStatuses).map(r => r.id);
      hiddenMilestoneIds.push(...ids);
    }
    const ids = db.prepare(`SELECT id FROM objectives WHERE user_id = ? AND status IN (${placeholders})`)
      .all(userId, ...inactiveStatuses).map(r => r.id);
    hiddenObjectiveIds.push(...ids);
  }

  return {
    hiddenMilestoneIds: [...new Set(hiddenMilestoneIds)],
    hiddenObjectiveIds: [...new Set(hiddenObjectiveIds)],
  };
}

function filterVisibleTaskRows(tasks, refs) {
  const hiddenMilestones = new Set(refs.hiddenMilestoneIds);
  const hiddenObjectives = new Set(refs.hiddenObjectiveIds);
  return tasks.filter(task =>
    !task.archived_at &&
    (!task.milestone_id || !hiddenMilestones.has(task.milestone_id)) &&
    (!task.objective_id || !hiddenObjectives.has(task.objective_id))
  );
}

function applyTaskVisibility(sql, params, refs) {
  sql += ' AND archived_at IS NULL';
  if (refs.hiddenMilestoneIds.length) {
    sql += ` AND (milestone_id IS NULL OR milestone_id NOT IN (${refs.hiddenMilestoneIds.map(() => '?').join(',')}))`;
    params.push(...refs.hiddenMilestoneIds);
  }
  if (refs.hiddenObjectiveIds.length) {
    sql += ` AND (objective_id IS NULL OR objective_id NOT IN (${refs.hiddenObjectiveIds.map(() => '?').join(',')}))`;
    params.push(...refs.hiddenObjectiveIds);
  }
  return { sql, params };
}

function ensureUser(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function computeTaskProgress(objectiveId) {
  if (!objectiveId) return 0;
  const all = db.prepare(`
    SELECT status FROM tasks
    WHERE objective_id = ? AND is_fixed = 0 AND archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM milestones WHERE milestones.id = tasks.milestone_id AND (milestones.status IN ('discarded', 'failed') OR milestones.archived_at IS NOT NULL))
      AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = tasks.milestone_id AND events.archived_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM publications WHERE publications.id = tasks.milestone_id AND publications.archived_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM certifications WHERE certifications.id = tasks.milestone_id AND certifications.archived_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM repos WHERE repos.id = tasks.milestone_id AND repos.archived_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM prs WHERE prs.id = tasks.milestone_id AND prs.archived_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM repos WHERE repos.id = tasks.milestone_id AND repos.status IN ('postponed', 'discarded', 'failed'))
      AND NOT EXISTS (SELECT 1 FROM certifications WHERE certifications.id = tasks.milestone_id AND certifications.status IN ('postponed', 'discarded', 'failed'))
      AND NOT EXISTS (SELECT 1 FROM publications WHERE publications.id = tasks.milestone_id AND publications.status IN ('postponed', 'discarded', 'failed'))
      AND NOT EXISTS (SELECT 1 FROM prs WHERE prs.id = tasks.milestone_id AND prs.status IN ('postponed', 'discarded', 'failed'))
      AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = tasks.milestone_id AND events.status IN ('postponed', 'discarded', 'failed'))
  `).all(objectiveId);
  if (!all.length) return 0;
  const done = all.filter(t => t.status === 'completed').length;
  return Math.round((done / all.length) * 100);
}

function computeGlobalTaskProgress() {
  const eligible = `is_fixed = 0 AND archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = tasks.objective_id AND (objectives.status IN ('postponed', 'discarded', 'failed') OR objectives.archived_at IS NOT NULL))
    AND NOT EXISTS (SELECT 1 FROM milestones WHERE milestones.id = tasks.milestone_id AND (milestones.status IN ('discarded', 'failed') OR milestones.archived_at IS NOT NULL))
    AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = tasks.milestone_id AND events.archived_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM publications WHERE publications.id = tasks.milestone_id AND publications.archived_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM certifications WHERE certifications.id = tasks.milestone_id AND certifications.archived_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM repos WHERE repos.id = tasks.milestone_id AND repos.archived_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM prs WHERE prs.id = tasks.milestone_id AND prs.archived_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM repos WHERE repos.id = tasks.milestone_id AND repos.status IN ('postponed', 'discarded', 'failed'))
    AND NOT EXISTS (SELECT 1 FROM certifications WHERE certifications.id = tasks.milestone_id AND certifications.status IN ('postponed', 'discarded', 'failed'))
    AND NOT EXISTS (SELECT 1 FROM publications WHERE publications.id = tasks.milestone_id AND publications.status IN ('postponed', 'discarded', 'failed'))
    AND NOT EXISTS (SELECT 1 FROM prs WHERE prs.id = tasks.milestone_id AND prs.status IN ('postponed', 'discarded', 'failed'))
    AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = tasks.milestone_id AND events.status IN ('postponed', 'discarded', 'failed'))`;
  const total = db.prepare(`SELECT COUNT(*) as n FROM tasks WHERE ${eligible}`).get().n;
  if (total === 0) return 0;
  const done = db.prepare(`SELECT COUNT(*) as n FROM tasks WHERE ${eligible} AND status = 'completed'`).get().n;
  return Math.round((done / total) * 100);
}

// Expand fixed-recurrence tasks into virtual instances within [from, to]
function expandFixedTasks(from, to, filters = {}) {
  let sql = `SELECT * FROM tasks WHERE is_fixed = 1 AND fixed_days IS NOT NULL
    AND user_id = ?
    AND (fixed_end_date IS NULL OR fixed_end_date >= ?)
    AND (fixed_start_date IS NULL OR fixed_start_date <= ?)`;
  const params = [filters.user_id || 'pepito', from, to];
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
  const all = db.prepare('SELECT status FROM tasks WHERE milestone_id = ? AND is_fixed = 0 AND archived_at IS NULL').all(milestoneId);
  if (!all.length) return 0;
  const done = all.filter(t => t.status === 'completed').length;
  return Math.round((done / all.length) * 100);
}

function deriveMilestoneStatus(currentStatus, pct) {
  if (currentStatus === 'blocked' || currentStatus === 'discarded' || currentStatus === 'failed') return currentStatus;
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

function recomputeAllObjectivesAndGlobalProgress() {
  const objectiveIds = db.prepare('SELECT id, status FROM objectives').all();
  for (const objective of objectiveIds) {
    const pct = computeTaskProgress(objective.id);
    db.prepare('UPDATE objectives SET percentage_completed = ?, status = ? WHERE id = ?')
      .run(pct, deriveObjectiveStatus(objective.status, pct), objective.id);
  }
  return computeGlobalTaskProgress();
}

function deriveObjectiveStatus(currentStatus, pct) {
  if (currentStatus === 'blocked' || currentStatus === 'postponed') return currentStatus;
  if (pct === 100) return 'completed';
  if (pct > 0)    return 'in_progress';
  return 'not_started';
}

function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const diff = Math.ceil((target - now) / 86400000);
  return diff;
}

function isOverdue(dateStr, status) {
  if (!dateStr || status === 'completed') return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function isTodoTask(task) {
  return !task.is_fixed && (!task.date || (!task.start_time && !task.end_time));
}

function getDailyMoneyPlanningStatus(userId, date = new Date().toISOString().slice(0, 10)) {
  const requiredMinutes = db.prepare('SELECT money_required_minutes FROM users WHERE id = ?').get(userId)?.money_required_minutes ?? 240;
  const objective = db.prepare('SELECT id, title FROM objectives WHERE user_id = ?').all(userId)
    .find(row => String(row.title || '').trim().toLocaleLowerCase('en-US').replace(/[!?.]+$/g, '').trim() === "let's make some money");
  if (!objective) return { ready: false, moneyMinutes: 0, requiredMinutes };

  const refs = getHiddenTaskRefs(userId, true);
  const regular = db.prepare('SELECT * FROM tasks WHERE is_fixed = 0 AND date = ? AND user_id = ?').all(date, userId);
  const fixed = filterFixedInstancesWithClones(
    expandFixedTasks(date, date, { user_id: userId }),
    findClonedTasksForRange(date, date, { user_id: userId })
  );
  const todayTasks = filterScheduledOriginalsWithClones([
    ...filterVisibleTaskRows(regular, refs),
    ...filterVisibleTaskRows(fixed, refs),
  ]);
  const moneyMinutes = todayTasks
    .filter(task => task.objective_id === objective.id || task.is_money_maker)
    .reduce((sum, task) => sum + Math.max(0, Number(task.duration_estimated) || 0), 0);
  return { ready: moneyMinutes >= requiredMinutes, moneyMinutes, requiredMinutes };
}

function minutesBetweenTimes(start, end) {
  if (!start || !end) return 0;
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  return Math.max(0, endHours * 60 + endMinutes - startHours * 60 - startMinutes);
}

function normalizeTaskStatus(status, isFixed, fallback = 'pending') {
  if (status == null) return null;
  if (isFixed && status === 'completed') return fallback;
  return status;
}

function completionTimestampForDate(completedAt, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return completedAt;
  const completionTime = completedAt ? new Date(completedAt) : new Date();
  if (Number.isNaN(completionTime.getTime())) return completedAt;
  const [year, month, day] = date.split('-').map(Number);
  completionTime.setFullYear(year, month - 1, day);
  return completionTime.toISOString();
}

function buildClonedTaskKey(task) {
  return `${task.cloned_from || task.id}::${task.date || ''}`;
}

function filterFixedInstancesWithClones(instances, clones) {
  const cloneKeys = new Set(
    clones
      .filter(task => task.is_cloned && task.cloned_from && task.date)
      .map(buildClonedTaskKey)
  );
  return instances.filter(task => !cloneKeys.has(buildClonedTaskKey(task)));
}

function filterScheduledOriginalsWithClones(tasks) {
  const completedInstances = new Set(tasks
    .filter(task => task.is_cloned && task.cloned_from && task.date)
    .map(task => `${task.cloned_from}::${task.date}`));
  return tasks.filter(task => task.is_cloned || !task.date || !completedInstances.has(`${task.id}::${task.date}`));
}

function findClonedTasksForRange(from, to, filters = {}) {
  let sql = 'SELECT * FROM tasks WHERE is_fixed = 0 AND is_cloned = 1 AND archived_at IS NULL AND cloned_from IS NOT NULL AND date BETWEEN ? AND ? AND user_id = ?';
  const params = [from, to, filters.user_id || 'pepito'];
  if (filters.objective_id) { sql += ' AND objective_id = ?'; params.push(filters.objective_id); }
  if (filters.milestone_id) { sql += ' AND milestone_id = ?'; params.push(filters.milestone_id); }
  if (filters.category_id) { sql += ' AND category_id = ?'; params.push(filters.category_id); }
  sql += ' ORDER BY date, start_time';
  return db.prepare(sql).all(...params);
}

// ── NOTEPAD ─────────────────────────────────────────────────────────────────
const notepadSubscribers = new Map();
const notepadImageReference = /!\[Imagen\]\(\/api\/notepad\/images\/([A-Za-z0-9-]+)\)/g;

function referencedNotepadImages(tabs) {
  const owners = new Map();
  for (const tab of tabs) {
    for (const match of tab.content.matchAll(notepadImageReference)) {
      const key = `${tab.user_id}:${match[1]}`;
      if (!owners.has(key)) owners.set(key, tab.id);
    }
  }
  return owners;
}

function reconcileNotepadImages(userId = null) {
  const where = userId ? ' WHERE user_id = ?' : '';
  const params = userId ? [userId] : [];
  // Include notes in the trash: they can still be restored during retention.
  const references = referencedNotepadImages(db.prepare(`SELECT id, user_id, content FROM notepad_tabs${where}`).all(...params));
  const images = db.prepare(`SELECT id, user_id, unreferenced_at FROM notepad_images${where}`).all(...params);
  const markReferenced = db.prepare('UPDATE notepad_images SET unreferenced_at = NULL WHERE id = ? AND user_id = ?');
  const markUnreferenced = db.prepare("UPDATE notepad_images SET unreferenced_at = datetime('now') WHERE id = ? AND user_id = ? AND unreferenced_at IS NULL");
  db.transaction(() => {
    for (const image of images) {
      if (references.has(`${image.user_id}:${image.id}`)) {
        if (image.unreferenced_at) markReferenced.run(image.id, image.user_id);
      } else if (!image.unreferenced_at) {
        markUnreferenced.run(image.id, image.user_id);
      }
    }
  })();
}

function purgeExpiredNotepadTabs() {
  const expiring = db.prepare("SELECT id FROM notepad_tabs WHERE deleted_at IS NOT NULL AND deleted_at <= datetime('now', '-30 days')").all();
  if (!expiring.length) return;
  const expiringIds = new Set(expiring.map(tab => tab.id));
  const survivingTabs = db.prepare("SELECT id, user_id, content FROM notepad_tabs WHERE deleted_at IS NULL OR deleted_at > datetime('now', '-30 days')").all();
  const survivingReferences = referencedNotepadImages(survivingTabs);
  const images = db.prepare('SELECT id, tab_id, user_id FROM notepad_images').all();
  const moveImage = db.prepare('UPDATE notepad_images SET tab_id = ? WHERE id = ? AND user_id = ?');
  db.transaction(() => {
    for (const image of images) {
      if (!expiringIds.has(image.tab_id)) continue;
      const survivingTabId = survivingReferences.get(`${image.user_id}:${image.id}`);
      if (survivingTabId) moveImage.run(survivingTabId, image.id, image.user_id);
    }
    db.prepare("DELETE FROM notepad_tabs WHERE deleted_at IS NOT NULL AND deleted_at <= datetime('now', '-30 days')").run();
  })();
}

function maintainNotepad() {
  purgeExpiredNotepadTabs();
  reconcileNotepadImages();
  db.prepare("DELETE FROM notepad_images WHERE unreferenced_at IS NOT NULL AND unreferenced_at <= datetime('now', '-30 days')").run();
}

maintainNotepad();
setInterval(maintainNotepad, 60 * 60 * 1000).unref();

function notifyNotepad(userId, clientId) {
  const message = `event: change\ndata: ${JSON.stringify({ client_id: clientId || null })}\n\n`;
  for (const response of notepadSubscribers.get(userId) || []) response.write(message);
}

app.get('/api/notepad/tabs', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(db.prepare('SELECT * FROM notepad_tabs WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, rowid').all(req.userId));
});

app.get('/api/notepad/trash', (req, res) => {
  maintainNotepad();
  res.setHeader('Cache-Control', 'no-store');
  res.json(db.prepare('SELECT id, title, deleted_at FROM notepad_tabs WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, rowid DESC').all(req.userId));
});

app.get('/api/notepad/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(': connected\n\n');
  if (!notepadSubscribers.has(req.userId)) notepadSubscribers.set(req.userId, new Set());
  const subscribers = notepadSubscribers.get(req.userId);
  subscribers.add(res);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    subscribers.delete(res);
    if (!subscribers.size) notepadSubscribers.delete(req.userId);
  });
});

app.post('/api/notepad/tabs', (req, res) => {
  const id = crypto.randomUUID();
  const position = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM notepad_tabs WHERE user_id = ?').get(req.userId).next;
  db.prepare('INSERT INTO notepad_tabs (id, user_id, title, position) VALUES (?, ?, ?, ?)')
    .run(id, req.userId, 'Nueva pestaña', position);
  const tab = db.prepare('SELECT * FROM notepad_tabs WHERE id = ?').get(id);
  res.status(201).json(tab);
  notifyNotepad(req.userId, req.body?.client_id);
});

app.put('/api/notepad/tabs/:id', (req, res) => {
  const { title, content, revision, client_id: clientId } = req.body || {};
  if (typeof title !== 'string' || typeof content !== 'string' || !Number.isInteger(revision)) {
    return res.status(400).json({ error: 'Datos de la pestaña no válidos' });
  }
  if (!title.trim() || title.length > 120) return res.status(400).json({ error: 'El título debe tener entre 1 y 120 caracteres' });
  const result = db.prepare(`UPDATE notepad_tabs SET title = ?, content = ?, revision = revision + 1,
    updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND revision = ?`)
    .run(title, content, req.params.id, req.userId, revision);
  if (!result.changes) {
    const current = db.prepare('SELECT * FROM notepad_tabs WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(req.params.id, req.userId);
    return current ? res.status(409).json({ error: 'La pestaña cambió en otra ventana', current })
      : res.status(404).json({ error: 'Pestaña no encontrada' });
  }
  const tab = db.prepare('SELECT * FROM notepad_tabs WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  reconcileNotepadImages(req.userId);
  res.json(tab);
  notifyNotepad(req.userId, clientId);
});

app.delete('/api/notepad/tabs/:id', (req, res) => {
  const result = db.prepare("UPDATE notepad_tabs SET deleted_at = datetime('now'), revision = revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL").run(req.params.id, req.userId);
  if (!result.changes) return res.status(404).json({ error: 'Pestaña no encontrada' });
  res.json({ ok: true });
  notifyNotepad(req.userId, req.query.client_id);
});

app.post('/api/notepad/tabs/:id/restore', (req, res) => {
  purgeExpiredNotepadTabs();
  const result = db.prepare("UPDATE notepad_tabs SET deleted_at = NULL, revision = revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL").run(req.params.id, req.userId);
  if (!result.changes) return res.status(404).json({ error: 'Pestaña no encontrada en la papelera' });
  const tab = db.prepare('SELECT * FROM notepad_tabs WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  res.json(tab);
  notifyNotepad(req.userId, req.body?.client_id);
});

const notepadImageSignatures = {
  'image/png': buffer => buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  'image/jpeg': buffer => buffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
  'image/gif': buffer => ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')),
  'image/webp': buffer => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
};

app.post('/api/notepad/tabs/:id/images', (req, res) => {
  if (!db.prepare('SELECT id FROM notepad_tabs WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Pestaña no encontrada' });
  }
  const { mime_type: mimeType, data_base64: encoded } = req.body || {};
  if (!Object.hasOwn(notepadImageSignatures, mimeType) || typeof encoded !== 'string'
    || encoded.length > 14_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return res.status(400).json({ error: 'Imagen no válida' });
  }
  const image = Buffer.from(encoded, 'base64');
  if (!image.length || image.length > 10 * 1024 * 1024 || !notepadImageSignatures[mimeType](image)) {
    return res.status(400).json({ error: 'Imagen no válida o demasiado grande' });
  }
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO notepad_images (id, tab_id, user_id, mime_type, data_base64, unreferenced_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .run(id, req.params.id, req.userId, mimeType, encoded);
  res.status(201).json({ id });
});

app.get('/api/notepad/images/:id', (req, res) => {
  const image = db.prepare('SELECT mime_type, data_base64 FROM notepad_images WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!image || !Object.hasOwn(notepadImageSignatures, image.mime_type)) return res.status(404).end();
  res.set({
    'Content-Type': image.mime_type,
    'Content-Disposition': 'inline',
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(image.data_base64, 'base64'));
});

// ── USERS ───────────────────────────────────────────────────────────────────
const WORLD_CLOCK_COLORS = new Set([
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488',
  '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#64748b',
]);

function worldClocksForUser(userId) {
  const row = db.prepare('SELECT world_clocks, world_clocks_revision FROM users WHERE id = ?').get(userId);
  return { cities: JSON.parse(row?.world_clocks || '[]'), revision: row?.world_clocks_revision ?? 0 };
}

app.get('/api/world-clocks', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(worldClocksForUser(req.userId));
});

app.put('/api/world-clocks', (req, res) => {
  const { cities, revision } = req.body || {};
  if (!Array.isArray(cities) || cities.length > 200 || !Number.isInteger(revision) || revision < 0) {
    return res.status(400).json({ error: 'Datos de horas del mundo no válidos.' });
  }
  const ids = new Set();
  const slots = new Set();
  for (const city of cities) {
    if (!city || typeof city.id !== 'string' || !city.id || city.id.length > 100
      || typeof city.city !== 'string' || !city.city.trim() || city.city.length > 100
      || typeof city.timeZone !== 'string' || city.timeZone.length > 100
      || !Number.isInteger(city.slot) || city.slot < 0 || city.slot > 9999
      || !WORLD_CLOCK_COLORS.has(city.color) || typeof city.pinned !== 'boolean'
      || ids.has(city.id) || slots.has(city.slot)) {
      return res.status(400).json({ error: 'Una ciudad tiene datos no válidos.' });
    }
    try { new Intl.DateTimeFormat('en', { timeZone: city.timeZone }); }
    catch (_) { return res.status(400).json({ error: 'Zona horaria no válida.' }); }
    ids.add(city.id);
    slots.add(city.slot);
  }
  const rows = cities.map(({ id, city, timeZone, slot, color, pinned }) => ({
    id, city: city.trim(), timeZone, slot, color, pinned,
  }));
  const result = db.prepare('UPDATE users SET world_clocks = ?, world_clocks_revision = world_clocks_revision + 1 WHERE id = ? AND world_clocks_revision = ?')
    .run(JSON.stringify(rows), req.userId, revision);
  if (!result.changes) return res.status(409).json({ error: 'Las horas se modificaron en otra pestaña.', ...worldClocksForUser(req.userId) });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ cities: rows, revision: revision + 1 });
});

app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT * FROM users WHERE id = ?').all(req.userId));
});

app.post('/api/users', (req, res) => {
  res.status(405).json({ error: 'Cada cuenta de Google dispone de un único perfil.' });
});

app.put('/api/users/:id', (req, res) => {
  if (req.params.id !== req.userId) return res.status(403).json({ error: 'No puedes editar otro perfil.' });
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!current) return res.status(404).json({ error: 'Not found' });
  const { name, color, content_sections, money_required_minutes } = req.body;
  if (money_required_minutes !== undefined && (!Number.isInteger(money_required_minutes) || money_required_minutes < 0 || money_required_minutes > 1440 || money_required_minutes % 15 !== 0)) {
    return res.status(400).json({ error: 'Las horas diarias deben estar entre 0 y 24, en intervalos de 15 minutos.' });
  }
  db.prepare('UPDATE users SET name = COALESCE(?, name), color = COALESCE(?, color), content_sections = COALESCE(?, content_sections), money_required_minutes = COALESCE(?, money_required_minutes) WHERE id = ?')
    .run(name ?? null, color ?? null, content_sections !== undefined ? JSON.stringify(parseContentSections(content_sections)) : null, money_required_minutes ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id));
});

// ── CATEGORIES ──────────────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC').all(req.userId));
});

app.post('/api/categories', (req, res) => {
  const { id, name, color, text_color } = req.body;
  if (!id || !name || !color) return res.status(400).json({ error: 'id, name y color son obligatorios' });
  if (db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(id, req.userId))
    return res.status(409).json({ error: 'Ya existe una categoría con ese id' });
  db.prepare('INSERT INTO categories (id, name, color, text_color, user_id) VALUES (?, ?, ?, ?, ?)').run(id, name, color, text_color ?? null, req.userId);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, req.userId));
});

app.put('/api/categories/:id', (req, res) => {
  const { name, color, text_color } = req.body;
  const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE categories SET name = COALESCE(?, name), color = COALESCE(?, color), text_color = ? WHERE id = ?')
    .run(name ?? null, color ?? null, text_color ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, req.userId));
});

app.delete('/api/categories/:id', (req, res) => {
  const id = req.params.id;
  const refs = [
    { table: 'tasks',          label: 'Tareas',            titleCol: 'title', dateCol: 'date',        hasCategoryId: true, hasCategoryIds: true },
    { table: 'objectives',     label: 'Objetivos',         titleCol: 'title', dateCol: 'end_date',    hasCategoryId: true, hasCategoryIds: true },
    { table: 'events',         label: 'Eventos',           titleCol: 'title', dateCol: 'start_date',  hasCategoryId: true, hasCategoryIds: true },
    { table: 'publications',   label: 'Publicaciones',     titleCol: 'title', dateCol: 'date',        hasCategoryId: true, hasCategoryIds: true },
    { table: 'certifications', label: 'Certificaciones',   titleCol: 'title', dateCol: 'target_date', hasCategoryId: true, hasCategoryIds: true },
    { table: 'repos',          label: 'Proyectos',         titleCol: 'title', dateCol: 'target_date', hasCategoryId: true, hasCategoryIds: true },
    { table: 'prs',            label: 'PRs',               titleCol: 'title', dateCol: 'end_date',    hasCategoryId: true, hasCategoryIds: true },
    { table: 'work_blocks',    label: 'Bloques de trabajo',titleCol: 'name',  dateCol: null,          hasCategoryId: true, hasCategoryIds: false },
    { table: 'reading_list',   label: 'Para Leer',         titleCol: 'title', dateCol: 'created_at',  hasCategoryId: true, hasCategoryIds: true },
    { table: 'documents',      label: 'Documentos',        titleCol: 'name',  dateCol: 'created_at',  hasCategoryId: false, hasCategoryIds: true },
  ];

  const usages = refs.map(ref => {
    const cols = [`id`, `${ref.titleCol} AS title`];
    if (ref.hasCategoryId) cols.push(`category_id`);
    if (ref.dateCol) cols.push(`${ref.dateCol} AS date`);
    if (ref.hasCategoryIds) cols.push(`category_ids`);
    const clauses = [];
    const params = [];
    if (ref.hasCategoryId) {
      clauses.push(`category_id = ?`);
      params.push(id);
    }
    if (ref.hasCategoryIds) {
      clauses.push(`category_ids LIKE ?`);
      params.push(`%${id}%`);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' OR ')}` : '';
    const userWhere = whereSql ? `${whereSql} AND user_id = ?` : 'WHERE user_id = ?';
    const rows = db.prepare(`SELECT ${cols.join(', ')} FROM ${ref.table} ${userWhere}`).all(...params, req.userId);
    const matched = rows.filter(r => {
      const ids = parseCategoryIds(
        ref.hasCategoryIds ? r.category_ids : null,
        ref.hasCategoryId ? r.category_id : null
      );
      return ids.includes(id);
    });
    return { ...ref, rows: matched };
  }).filter(u => u.rows.length > 0);

  if (usages.length > 0) {
    const lines = usages.map(u => {
      const preview = u.rows.slice(0, 5).map(r => `"${r.title || r.id}"${r.date ? ` (${r.date})` : ''}`).join(', ');
      const extra = u.rows.length > 5 ? `, +${u.rows.length - 5} más` : '';
      return `- ${u.label} (${u.rows.length}): ${preview}${extra}`;
    });
    return res.status(409).json({
      error: `No se puede eliminar la categoría porque está en uso por:\n${lines.join('\n')}`,
      usages: usages.map(u => ({
        type: u.label,
        count: u.rows.length,
        items: u.rows.map(r => ({ id: r.id, title: r.title || r.id, date: r.date || null })),
      })),
    });
  }
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, req.userId);
  res.json({ ok: true });
});

// ── TASKS ────────────────────────────────────────────────────────────────────
app.get('/api/tasks/search', (req, res) => {
  const { q, from, to, category_id, status, objective_id } = req.query;
  const refs = getHiddenTaskRefs(req.userId);
  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  let params = [req.userId];

  if (q)            { sql += ' AND title LIKE ?';       params.push(`%${q}%`); }
  if (from)         { sql += ' AND date >= ?';           params.push(from); }
  if (to)           { sql += ' AND date <= ?';           params.push(to); }
  if (category_id)  { sql += ' AND category_id = ?';    params.push(category_id); }
  if (status)       { sql += ' AND status = ?';         params.push(status); }
  if (objective_id) { sql += ' AND objective_id = ?';   params.push(objective_id); }

  ({ sql, params } = applyTaskVisibility(sql, params, refs));
  sql += ' ORDER BY date, start_time LIMIT 200';
  const tasks = db.prepare(sql).all(...params);
  tasks.forEach(t => { t.is_overdue = isTodoTask(t) ? 0 : (isOverdue(t.date, t.status) ? 1 : 0); });
  res.json(tasks);
});

app.get('/api/tasks', (req, res) => {
  const { date, category_id, status, from, to, objective_id } = req.query;
  const refs = getHiddenTaskRefs(req.userId, Boolean(date || (from && to)));
  // Non-fixed tasks
  let sql = 'SELECT * FROM tasks WHERE is_fixed = 0 AND user_id = ?';
  let params = [req.userId];

  if (date)         { sql += ' AND date = ?';           params.push(date); }
  if (from)         { sql += ' AND date >= ?';           params.push(from); }
  if (to)           { sql += ' AND date <= ?';           params.push(to); }
  if (category_id)  { sql += ' AND category_id = ?';    params.push(category_id); }
  if (status)       { sql += ' AND status = ?';         params.push(status); }
  if (objective_id)               { sql += ' AND objective_id = ?';                    params.push(objective_id); }
  if (req.query.milestone_id)     { sql += ' AND milestone_id = ?';                    params.push(req.query.milestone_id); }
  if (req.query.no_milestone === '1') { sql += ' AND (milestone_id IS NULL OR milestone_id = \'\')'; }

  ({ sql, params } = applyTaskVisibility(sql, params, refs));
  sql += ' ORDER BY date, start_time';
  const tasks = db.prepare(sql).all(...params);
  tasks.forEach(t => { t.is_overdue = isTodoTask(t) ? 0 : (isOverdue(t.date, t.status) ? 1 : 0); });

  let fixed = [];
  // Expand fixed tasks when querying a date range/day.
  // Without range/day, return fixed templates once (not expanded by day).
  if (from && to) {
    const sharedFilters = {
      user_id: req.userId,
      objective_id: objective_id || null,
      milestone_id: req.query.milestone_id || null,
      category_id: category_id || null,
    };
    fixed = filterFixedInstancesWithClones(
      expandFixedTasks(from, to, sharedFilters),
      findClonedTasksForRange(from, to, { ...sharedFilters, user_id: req.userId })
    );
  } else if (date) {
    fixed = filterFixedInstancesWithClones(
      expandFixedTasks(date, date, { user_id: req.userId }),
      findClonedTasksForRange(date, date, { category_id: category_id || null, user_id: req.userId })
    );
  } else {
    let fixedSql = 'SELECT * FROM tasks WHERE is_fixed = 1 AND user_id = ?';
    const fixedParams = [req.userId];
    if (category_id)  { fixedSql += ' AND category_id = ?'; fixedParams.push(category_id); }
    if (status)       { fixedSql += ' AND status = ?'; fixedParams.push(status); }
    if (objective_id) { fixedSql += ' AND objective_id = ?'; fixedParams.push(objective_id); }
    if (req.query.milestone_id)     { fixedSql += ' AND milestone_id = ?'; fixedParams.push(req.query.milestone_id); }
    if (req.query.no_milestone === '1') { fixedSql += ' AND (milestone_id IS NULL OR milestone_id = \'\')'; }
    fixedSql += ' ORDER BY title, start_time';
    fixed = db.prepare(fixedSql).all(...fixedParams).map(t => ({ ...t, is_overdue: 0 }));
  }

  res.json(filterScheduledOriginalsWithClones([...tasks, ...filterVisibleTaskRows(fixed, refs)]));
});

app.get('/api/tasks/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const refs = getHiddenTaskRefs(req.userId, true);
  let sql = 'SELECT * FROM tasks WHERE is_fixed = 0 AND date = ? AND user_id = ?';
  let params = [today, req.userId];
  ({ sql, params } = applyTaskVisibility(sql, params, refs));
  sql += ' ORDER BY start_time';
  const tasks = db.prepare(sql).all(...params);
  tasks.forEach(t => { t.is_overdue = isTodoTask(t) ? 0 : (isOverdue(t.date, t.status) ? 1 : 0); });
  const fixed = filterFixedInstancesWithClones(
    expandFixedTasks(today, today, { user_id: req.userId }),
    findClonedTasksForRange(today, today, { user_id: req.userId })
  );
  res.json(filterScheduledOriginalsWithClones([...tasks, ...filterVisibleTaskRows(fixed, refs)]).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
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
  const refs = getHiddenTaskRefs(req.userId, true);
  let sql = 'SELECT * FROM tasks WHERE is_fixed = 0 AND date BETWEEN ? AND ? AND user_id = ?';
  let params = [from, to, req.userId];
  ({ sql, params } = applyTaskVisibility(sql, params, refs));
  sql += ' ORDER BY date, start_time';
  const tasks = db.prepare(sql).all(...params);
  tasks.forEach(t => { t.is_overdue = isTodoTask(t) ? 0 : (isOverdue(t.date, t.status) ? 1 : 0); });
  const fixed = filterFixedInstancesWithClones(
    expandFixedTasks(from, to, { user_id: req.userId }),
    findClonedTasksForRange(from, to, { user_id: req.userId })
  );
  res.json(filterScheduledOriginalsWithClones([...tasks, ...filterVisibleTaskRows(fixed, refs)]));
});

app.get('/api/tasks/now', (req, res) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = now.toTimeString().slice(0, 5);
  const refs = getHiddenTaskRefs(req.userId, true);
  let sql = 'SELECT * FROM tasks WHERE is_fixed = 0 AND date = ? AND start_time IS NOT NULL AND user_id = ?';
  let params = [today, req.userId];
  ({ sql, params } = applyTaskVisibility(sql, params, refs));
  sql += ' ORDER BY start_time';
  const regular = db.prepare(sql).all(...params);
  const fixed = filterFixedInstancesWithClones(
    expandFixedTasks(today, today, { user_id: req.userId }),
    findClonedTasksForRange(today, today, { user_id: req.userId })
  ).filter(t => t.start_time);
  const tasks = filterScheduledOriginalsWithClones([...regular, ...filterVisibleTaskRows(fixed, refs)])
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const tracked = db.prepare(`SELECT * FROM tasks
    WHERE user_id = ? AND is_fixed = 0 AND archived_at IS NULL AND status != 'completed'
      AND (timer_started_at IS NOT NULL OR status = 'in_progress')
    ORDER BY CASE WHEN timer_started_at IS NOT NULL THEN 0 ELSE 1 END,
      COALESCE(timer_started_at, date || 'T' || start_time) DESC`).all(req.userId);
  const scheduledActive = tasks.filter(t => t.status !== 'completed' && (
    t.status === 'in_progress' || (t.start_time <= timeStr && t.end_time > timeStr)
  ));
  const activeTasks = filterVisibleTaskRows(tracked, refs);
  scheduledActive.forEach(task => {
    if (!activeTasks.some(activeTask => activeTask.id === task.id)) activeTasks.push(task);
  });
  const active = activeTasks[0] || null;
  const upcoming = tasks.filter(t => t.start_time > timeStr).sort((a, b) => a.start_time.localeCompare(b.start_time));

  res.json({ current: active, activeTasks, upcoming: upcoming[0] || null, time: timeStr, date: today });
});

app.get('/api/money-planning/today', (req, res) => {
  res.json(getDailyMoneyPlanningStatus(req.userId));
});

app.post('/api/tasks/:id/timer', (req, res) => {
  const { action } = req.body;
  if (!['start', 'pause', 'complete'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (task.is_fixed) return res.status(400).json({ error: 'La tarea es fija' });
  const now = new Date();
  if (action === 'start') {
    if (task.status === 'completed') return res.status(409).json({ error: 'La tarea ya está completada' });
    db.prepare(`UPDATE tasks SET timer_started_at = COALESCE(timer_started_at, ?),
      original_estimate_minutes = COALESCE(original_estimate_minutes, duration_estimated), status = 'in_progress'
      WHERE id = ? AND user_id = ?`).run(now.toISOString(), task.id, req.userId);
  } else if (task.status !== 'completed') {
    // Legacy scheduled tasks have no timestamp until their first timer action.
    const started = task.timer_started_at || (task.date && task.start_time ? `${task.date}T${task.start_time}:00` : null);
    const elapsed = started ? Math.max(0, (now.getTime() - Date.parse(started)) / 1000) : 0;
    db.prepare(`UPDATE tasks SET actual_seconds = actual_seconds + ?, timer_started_at = NULL,
      original_estimate_minutes = COALESCE(original_estimate_minutes, duration_estimated),
      status = ?, percentage_completed = ?, completed_at = ?, start_time = NULL, end_time = NULL
      WHERE id = ? AND user_id = ?`).run(Number.isFinite(elapsed) ? elapsed : 0,
        action === 'complete' ? 'completed' : 'pending', action === 'complete' ? 100 : task.percentage_completed,
        action === 'complete' ? now.toISOString() : null, task.id, req.userId);
    recomputeForTask(task.milestone_id || null, null);
    recomputeAllObjectivesAndGlobalProgress();
  }
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(task.id, req.userId));
});

app.post('/api/tasks/:id/complete-scheduled', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (!task.is_fixed && isTodoTask(task)) return res.status(400).json({ error: 'La tarea no tiene un horario planificado' });

  const date = req.body.date || new Date().toISOString().slice(0, 10);
  const sourceId = task.cloned_from || task.id;
  const existing = db.prepare(`SELECT * FROM tasks
    WHERE user_id = ? AND is_cloned = 1 AND cloned_from = ? AND date = ? AND status = 'completed'
    LIMIT 1`).get(req.userId, sourceId, date);
  if (existing) return res.json(existing);

  const now = new Date();
  const id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const startTime = req.body.start_time || task.start_time || null;
  const endTime = req.body.end_time || task.end_time || null;
  const scheduledMinutes = minutesBetweenTimes(startTime, endTime);
  const scheduledSeconds = scheduledMinutes * 60;
  db.prepare(`INSERT INTO tasks
    (id,title,description,category_id,category_ids,subcategory,date,start_time,end_time,
     duration_estimated,status,priority,objective_id,milestone_id,is_fixed,is_money_maker,notes,label,
     is_cloned,cloned_from,percentage_completed,user_id,actual_seconds,completed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, task.title, task.description || '', task.category_id, task.category_ids, task.subcategory || '',
      date, startTime, endTime, task.duration_estimated || scheduledMinutes, 'completed', task.priority,
      task.objective_id, task.milestone_id, 0, task.is_money_maker ? 1 : 0, task.notes || '', task.label || '', 1, sourceId, 100,
      req.userId, scheduledSeconds, now.toISOString());
  recomputeForTask(task.milestone_id || null, task.objective_id || null);
  recomputeAllObjectivesAndGlobalProgress();
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.userId));
});

app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  task.is_overdue = isTodoTask(task) ? 0 : (isOverdue(task.date, task.status) ? 1 : 0);
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
    duration_estimated, priority, objective_id, milestone_id, is_fixed, is_money_maker,
    fixed_days, fixed_start_date, fixed_end_date, notes, label, isCloned, clonedFrom } = req.body;

  const isFixed = is_fixed ? 1 : 0;
  // Fixed tasks need a starting date. Regular tasks without a date are ToDos.
  const effectiveDate = date || (isFixed ? fixed_start_date : null);
  const effectiveStatus = normalizeTaskStatus('pending', isFixed, 'pending');
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  if (milestone_id) {
    const project = db.prepare('SELECT status FROM repos WHERE id = ? AND user_id = ?').get(milestone_id, req.userId);
    if (project && ['completed', 'published', 'finished'].includes(project.status)) return res.status(409).json({ error: 'No se pueden añadir tareas a un proyecto completado' });
  }
  if (isFixed && !effectiveDate) return res.status(400).json({ error: 'fixed_start_date es obligatoria para tareas fijas' });
  const effectiveStartTime = effectiveDate ? (start_time || null) : null;
  const effectiveEndTime = effectiveDate ? (end_time || null) : null;

  const cats = parseCategoryIds(category_ids, category_id);
  const primaryCat = cats[0] || null;

  function timeDiff(s, e) {
    if (!s || !e) return null;
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  const id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const todoOrder = objective_id
    ? db.prepare('SELECT COALESCE(MAX(todo_order), -1) + 1 AS n FROM tasks WHERE objective_id = ? AND user_id = ?').get(objective_id, req.userId).n
    : null;
  db.prepare(`INSERT INTO tasks
    (id,title,description,category_id,category_ids,subcategory,date,start_time,end_time,
     duration_estimated,status,priority,objective_id,milestone_id,is_fixed,is_money_maker,
     fixed_days,fixed_start_date,fixed_end_date,notes,label,is_cloned,cloned_from,percentage_completed,user_id,todo_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, title, description || '', primaryCat, JSON.stringify(cats), '',
      effectiveDate, effectiveStartTime, effectiveEndTime,
      effectiveDate ? (duration_estimated ?? timeDiff(start_time, end_time)) : null,
      effectiveStatus, priority ?? 2, objective_id || null, milestone_id || null,
      isFixed, is_money_maker ? 1 : 0,
      isFixed && fixed_days ? JSON.stringify(fixed_days) : null,
      isFixed ? (fixed_start_date || null) : null,
      isFixed ? (fixed_end_date || null) : null,
      notes || '', label || '', isCloned ? 1 : 0, clonedFrom || null, 0, req.userId, todoOrder);

  recomputeForTask(milestone_id || null, null);
  const global_progress = recomputeAllObjectivesAndGlobalProgress();
  const createdTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.userId);
  res.status(201).json({ ...createdTask, global_progress });
});

app.post('/api/tasks/todo-day-reorder', (req, res) => {
  const { date, ids } = req.body;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string')
    || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'Fecha y tareas no válidas' });
  }
  const rows = db.prepare('SELECT * FROM tasks WHERE date = ? AND user_id = ?').all(date, req.userId);
  const allowed = new Set(rows.filter(isTodoTask).map(task => task.id));
  if (ids.some(id => !allowed.has(id))) return res.status(400).json({ error: 'Las tareas deben pertenecer al mismo día' });
  const update = db.prepare('UPDATE tasks SET todo_day_order = ?, todo_order_date = ? WHERE id = ? AND date = ? AND user_id = ?');
  db.transaction(() => ids.forEach((id, index) => update.run(index, date, id, date, req.userId)))();
  res.json({ ok: true });
});

app.post('/api/tasks/todo-reorder', (req, res) => {
  const { objective_id, milestone_id, ids } = req.body;
  if ((!objective_id && !milestone_id) || !Array.isArray(ids)) return res.status(400).json({ error: 'Indica el objetivo o hito y las tareas' });
  const scope = milestone_id ? 'milestone_id' : 'objective_id';
  const scopeId = milestone_id || objective_id;
  const allowed = new Set(db.prepare(`SELECT id FROM tasks WHERE ${scope} = ? AND user_id = ?`).all(scopeId, req.userId).map(task => task.id));
  if (ids.some(id => !allowed.has(id))) return res.status(400).json({ error: 'Las tareas deben pertenecer al mismo objetivo o hito' });
  const update = db.prepare(`UPDATE tasks SET todo_order = ? WHERE id = ? AND ${scope} = ? AND user_id = ?`);
  db.transaction(() => ids.forEach((id, index) => update.run(index, id, scopeId, req.userId)))();
  res.json({ ok: true });
});

app.put('/api/tasks/:id', (req, res) => {
  const { title, description, category_id, category_ids, date, start_time, end_time,
    duration_estimated, priority, objective_id, milestone_id, is_fixed, is_money_maker,
    fixed_days, fixed_start_date, fixed_end_date,
    status, percentage_completed, notes, label, isCloned, clonedFrom } = req.body;

  const cats = category_ids !== undefined ? parseCategoryIds(category_ids, category_id) : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const nextIsFixed = is_fixed !== undefined ? (is_fixed ? 1 : 0) : task.is_fixed;
  const nextStatus = normalizeTaskStatus(
    status !== undefined ? status : (nextIsFixed ? task.status : null),
    nextIsFixed,
    'pending'
  );
  const nextPct = nextIsFixed ? 0 : (percentage_completed ?? null);

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
    is_money_maker      = COALESCE(@is_money_maker, is_money_maker),
    fixed_days          = COALESCE(@fixed_days,  fixed_days),
    fixed_start_date    = COALESCE(@fixed_start_date, fixed_start_date),
    fixed_end_date      = COALESCE(@fixed_end_date,   fixed_end_date),
    status              = COALESCE(@status,      status),
    percentage_completed= COALESCE(@pct,         percentage_completed),
    notes               = COALESCE(@notes,       notes),
    label               = COALESCE(@label,       label),
    is_cloned           = COALESCE(@is_cloned,   is_cloned),
    cloned_from         = COALESCE(@cloned_from, cloned_from)
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
      is_money_maker: is_money_maker !== undefined ? (is_money_maker ? 1 : 0) : null,
      fixed_days: fixed_days !== undefined ? (Array.isArray(fixed_days) ? JSON.stringify(fixed_days) : fixed_days) : null,
      fixed_start_date: fixed_start_date ?? null,
      fixed_end_date: fixed_end_date ?? null,
      status: nextStatus,
      pct: nextPct,
      notes: notes ?? null,
      label: label ?? null,
      is_cloned: isCloned !== undefined ? (isCloned ? 1 : 0) : null,
      cloned_from: clonedFrom ?? null,
      id: req.params.id,
    });

  // Allow explicit null for milestone_id (COALESCE ignores nulls)
  if ('milestone_id' in req.body) {
    db.prepare('UPDATE tasks SET milestone_id = ? WHERE id = ?').run(milestone_id ?? null, req.params.id);
  }
  // Scheduling fields must accept explicit nulls so a dated task can become a ToDo.
  if ('date' in req.body) {
    const nextDate = nextIsFixed ? (date || fixed_start_date || task.fixed_start_date) : (date || null);
    db.prepare('UPDATE tasks SET date = ? WHERE id = ? AND user_id = ?').run(nextDate, req.params.id, req.userId);
    if (nextDate && task.status === 'completed') {
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ? AND user_id = ?')
        .run(completionTimestampForDate(task.completed_at, nextDate), req.params.id, req.userId);
    }
    if (!nextDate) {
      db.prepare('UPDATE tasks SET start_time = NULL, end_time = NULL, duration_estimated = NULL WHERE id = ? AND user_id = ?')
        .run(req.params.id, req.userId);
    }
  }
  if ('start_time' in req.body && (date || (date === undefined && task.date))) {
    db.prepare('UPDATE tasks SET start_time = ? WHERE id = ? AND user_id = ?').run(start_time || null, req.params.id, req.userId);
  }
  if ('end_time' in req.body && (date || (date === undefined && task.date))) {
    db.prepare('UPDATE tasks SET end_time = ? WHERE id = ? AND user_id = ?').run(end_time || null, req.params.id, req.userId);
  }
  if ('status' in req.body) {
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (isTodoTask(updated)) {
      if (nextStatus === 'in_progress' && !task.timer_started_at) {
        db.prepare(`UPDATE tasks SET timer_started_at = COALESCE(timer_started_at, ?),
          original_estimate_minutes = COALESCE(original_estimate_minutes, duration_estimated)
          WHERE id = ? AND user_id = ?`).run(new Date().toISOString(), req.params.id, req.userId);
      } else if (nextStatus !== 'in_progress' && task.timer_started_at) {
        const elapsed = Math.max(0, (Date.now() - Date.parse(task.timer_started_at)) / 1000);
        db.prepare('UPDATE tasks SET actual_seconds = actual_seconds + ?, timer_started_at = NULL WHERE id = ? AND user_id = ?')
          .run(Number.isFinite(elapsed) ? elapsed : 0, req.params.id, req.userId);
      }
    }
    if (nextStatus === 'completed') {
      db.prepare('UPDATE tasks SET completed_at = COALESCE(completed_at, ?) WHERE id = ? AND user_id = ?')
        .run(new Date().toISOString(), req.params.id, req.userId);
    } else if (task.status === 'completed') {
      db.prepare('UPDATE tasks SET completed_at = NULL WHERE id = ? AND user_id = ?')
        .run(req.params.id, req.userId);
    }
  }

  // Recompute milestone + objective (both old and new ids in case they changed)
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  const milestoneIds = [...new Set([task.milestone_id, updatedTask.milestone_id].filter(Boolean))];
  for (const mid of milestoneIds) recomputeForTask(mid, null);
  const global_progress = recomputeAllObjectivesAndGlobalProgress();
  const resultTask = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  res.json({ ...resultTask, global_progress });
});

app.delete('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  recomputeForTask(task.milestone_id, null);
  const global_progress = recomputeAllObjectivesAndGlobalProgress();
  res.json({ ok: true, global_progress });
});

// ── DEADLINES ───────────────────────────────────────────────────────────────
app.get('/api/deadlines', (req, res) => {
  const { date, from, to } = req.query;
  let sql = 'SELECT * FROM deadlines WHERE user_id = ?';
  const params = [req.userId];
  if (date) { sql += ' AND date = ?'; params.push(date); }
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  sql += ' ORDER BY date, title COLLATE NOCASE';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/deadlines', (req, res) => {
  const { title, date, color } = req.body;
  if (!title?.trim() || !date) return res.status(400).json({ error: 'title y date son obligatorios' });
  const id = 'deadline-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  db.prepare('INSERT INTO deadlines (id,title,date,color,user_id) VALUES (?,?,?,?,?)')
    .run(id, title.trim(), date, color || '#dc2626', req.userId);
  res.status(201).json(db.prepare('SELECT * FROM deadlines WHERE id = ? AND user_id = ?').get(id, req.userId));
});

app.put('/api/deadlines/:id', (req, res) => {
  const { title, date, color } = req.body;
  const deadline = db.prepare('SELECT * FROM deadlines WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!deadline) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE deadlines SET title = COALESCE(?, title), date = COALESCE(?, date), color = COALESCE(?, color)
    WHERE id = ? AND user_id = ?`).run(title?.trim() || null, date || null, color || null, req.params.id, req.userId);
  res.json(db.prepare('SELECT * FROM deadlines WHERE id = ? AND user_id = ?').get(req.params.id, req.userId));
});

app.delete('/api/deadlines/:id', (req, res) => {
  db.prepare('DELETE FROM deadlines WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── ARCHIVE ──────────────────────────────────────────────────────────────────
const archiveTables = { objective: 'objectives', milestone: 'milestones', task: 'tasks', event: 'events', publication: 'publications', certification: 'certifications', repo: 'repos', pr: 'prs' };

app.get('/api/archive', (req, res) => {
  const archived = {};
  for (const [kind, table] of Object.entries(archiveTables)) {
    archived[kind] = db.prepare(`SELECT id, title, archived_at FROM ${table} WHERE user_id = ? AND archived_at IS NOT NULL ORDER BY archived_at DESC`).all(req.userId);
  }
  res.json(archived);
});

app.put('/api/archive/:kind/:id', (req, res) => {
  const table = archiveTables[req.params.kind];
  if (!table) return res.status(400).json({ error: 'Tipo de elemento inválido' });
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Elemento no encontrado' });
  if (req.body?.archived === false) {
    db.prepare(`UPDATE ${table} SET archived_at = NULL WHERE id = ? AND user_id = ?`).run(req.params.id, req.userId);
  } else if (req.body?.archived === true) {
    db.prepare(`UPDATE ${table} SET archived_at = COALESCE(archived_at, datetime('now')) WHERE id = ? AND user_id = ?`).run(req.params.id, req.userId);
    if (req.params.kind === 'task') {
      db.prepare("UPDATE tasks SET timer_started_at = NULL, status = CASE WHEN status = 'in_progress' THEN 'pending' ELSE status END WHERE id = ? AND user_id = ?")
        .run(req.params.id, req.userId);
    }
  } else {
    return res.status(400).json({ error: 'Indica si quieres archivar o restaurar el elemento' });
  }
  if (req.params.kind === 'task') recomputeForTask(row.milestone_id, row.objective_id);
  else if (row.objective_id) recomputeForTask(null, row.objective_id);
  res.json({ ok: true });
});

// ── OBJECTIVES ───────────────────────────────────────────────────────────────
app.get('/api/objectives', (req, res) => {
  const { type, include_archived } = req.query;
  let sql = 'SELECT * FROM objectives WHERE user_id = ?';
  const params = [req.userId];
  if (include_archived !== '1') sql += ' AND archived_at IS NULL';
  if (!isSectionEnabled(req.userId, 'clients')) sql += " AND type != 'client'";
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += " ORDER BY CASE WHEN status = 'postponed' THEN 1 ELSE 0 END, priority, start_date";
  const objectives = db.prepare(sql).all(...params);
  for (const obj of objectives) {
    try { obj.category_ids = obj.category_ids ? JSON.parse(obj.category_ids) : (obj.category_id ? [obj.category_id] : []); } catch (_) { obj.category_ids = obj.category_id ? [obj.category_id] : []; }
    obj.milestones = db.prepare(`
      SELECT * FROM milestones WHERE objective_id = ? AND user_id = ? AND archived_at IS NULL
      ORDER BY
        CASE WHEN status = 'completed' THEN 1 ELSE 0 END ASC,
        target_date ASC NULLS LAST
    `).all(obj.id, req.userId);
    const objectiveTaskRows = db.prepare(`
      SELECT status FROM tasks
      WHERE objective_id = ? AND is_fixed = 0 AND user_id = ? AND archived_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM milestones WHERE milestones.id = tasks.milestone_id AND milestones.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = tasks.milestone_id AND events.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM publications WHERE publications.id = tasks.milestone_id AND publications.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM certifications WHERE certifications.id = tasks.milestone_id AND certifications.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM repos WHERE repos.id = tasks.milestone_id AND repos.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM prs WHERE prs.id = tasks.milestone_id AND prs.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM milestones WHERE milestones.id = tasks.milestone_id AND milestones.status IN ('discarded', 'failed'))
        AND NOT EXISTS (SELECT 1 FROM repos WHERE repos.id = tasks.milestone_id AND repos.status IN ('postponed', 'discarded', 'failed'))
        AND NOT EXISTS (SELECT 1 FROM certifications WHERE certifications.id = tasks.milestone_id AND certifications.status IN ('postponed', 'discarded', 'failed'))
        AND NOT EXISTS (SELECT 1 FROM publications WHERE publications.id = tasks.milestone_id AND publications.status IN ('postponed', 'discarded', 'failed'))
        AND NOT EXISTS (SELECT 1 FROM prs WHERE prs.id = tasks.milestone_id AND prs.status IN ('postponed', 'discarded', 'failed'))
        AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = tasks.milestone_id AND events.status IN ('postponed', 'discarded', 'failed'))
    `).all(obj.id, req.userId);
    obj.task_count = objectiveTaskRows.length;
    obj.done_count = objectiveTaskRows.filter(t => t.status === 'completed').length;
    const orphanRows = db.prepare("SELECT status FROM tasks WHERE objective_id = ? AND is_fixed = 0 AND (milestone_id IS NULL OR milestone_id = '') AND user_id = ? AND archived_at IS NULL").all(obj.id, req.userId);
    obj.orphan_count = orphanRows.length;
    obj.orphan_done  = orphanRows.filter(t => t.status === 'completed').length;
    for (const m of obj.milestones) {
      m.days_remaining = daysRemaining(m.target_date);
      const mTasks = db.prepare('SELECT status FROM tasks WHERE milestone_id = ? AND is_fixed = 0 AND user_id = ? AND archived_at IS NULL').all(m.id, req.userId);
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
    obj.total_billed = db.prepare(
      'SELECT COALESCE(SUM(billed_amount),0) as s FROM milestones WHERE objective_id = ?'
    ).get(obj.id).s;
  }
  res.json(objectives);
});

app.post('/api/objectives', (req, res) => {
  const { title, description, category_id, category_ids, start_date, end_date, target_value, progress_mode, priority, status, notes, color, type } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'obj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const catIds = Array.isArray(category_ids) ? category_ids : (category_id ? [category_id] : []);
  const primaryCat = catIds[0] || category_id || null;
  db.prepare(`INSERT INTO objectives (id,title,description,category_id,category_ids,start_date,end_date,target_value,progress_mode,percentage_completed,status,priority,notes,color,type,user_id)
    VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`)
    .run(id, title, description || '', primaryCat, catIds.length ? JSON.stringify(catIds) : null,
      status === 'postponed' ? null : (start_date || null), status === 'postponed' ? null : (end_date || null),
      target_value || null, progress_mode || 'task_based', status || 'not_started', priority ?? 2, notes || '', color || null,
      type || 'objective', req.userId);
  res.status(201).json(db.prepare('SELECT * FROM objectives WHERE id = ? AND user_id = ?').get(id, req.userId));
});

app.post('/api/objectives/todo-reorder', (req, res) => {
  const { ids, items } = req.body;
  const entries = items === undefined && Array.isArray(ids) ? ids.map(id => ({ kind: 'objective', id })) : items;
  const tables = { objective: 'objectives', repo: 'repos', milestone: 'milestones' };
  if (!Array.isArray(entries) || entries.some(item => !item || !Object.hasOwn(tables, item.kind) || typeof item.id !== 'string')) return res.status(400).json({ error: 'Orden de columnas inválido' });
  if (entries.some(item => !db.prepare(`SELECT id FROM ${tables[item.kind]} WHERE id = ? AND user_id = ?`).get(item.id, req.userId))) return res.status(404).json({ error: 'Elemento no encontrado' });
  db.transaction(() => entries.forEach((item, index) => db.prepare(`UPDATE ${tables[item.kind]} SET todo_order = ? WHERE id = ? AND user_id = ?`).run(index, item.id, req.userId)))();
  res.json({ ok: true });
});

app.delete('/api/objectives/:id', (req, res) => {
  const objective = db.prepare('SELECT id FROM objectives WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!objective) return res.status(404).json({ error: 'Objetivo no encontrado' });
  const childTables = ['milestones', 'events', 'publications', 'certifications', 'repos', 'prs'];
  const childTaskScopes = childTables.map(table => `milestone_id IN (SELECT id FROM ${table} WHERE objective_id = ? AND user_id = ?)`);
  const taskScope = `user_id = ? AND (objective_id = ? OR ${childTaskScopes.join(' OR ')})`;
  const taskParams = [req.userId, req.params.id, ...childTables.flatMap(() => [req.params.id, req.userId])];
  const pendingTasks = db.prepare(`SELECT COUNT(*) as n FROM tasks WHERE ${taskScope} AND COALESCE(status, 'pending') != 'completed'`).get(...taskParams).n;
  if (pendingTasks > 0) return res.status(409).json({ error: `Este objetivo tiene ${pendingTasks} tareas pendientes` });
  db.transaction(() => {
    db.prepare(`DELETE FROM tasks WHERE ${taskScope}`).run(...taskParams);
    for (const table of childTables) {
      db.prepare(`DELETE FROM ${table} WHERE objective_id = ? AND user_id = ?`).run(req.params.id, req.userId);
    }
    db.prepare('DELETE FROM objectives WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  })();
  res.json({ ok: true });
});

app.put('/api/objectives/:id', (req, res) => {
  const { title, description, target_value, start_date, end_date, priority, status, notes, color, type, category_id, category_ids } = req.body;
  // percentage_completed is always computed from tasks — never manually set
  const pct = computeTaskProgress(req.params.id);
  const obj = db.prepare('SELECT status FROM objectives WHERE id = ?').get(req.params.id);
  // Honor the user-set status; only fall back to stored value if not provided
  const savedStatus = status !== undefined ? status : obj?.status;
  const catIds = Array.isArray(category_ids) ? category_ids : undefined;
  const primaryCat = catIds ? (catIds[0] || null) : (category_id ?? undefined);
  db.prepare(`UPDATE objectives SET
    title                = COALESCE(@title,        title),
    description          = COALESCE(@description,  description),
    target_value         = COALESCE(@target_value, target_value),
    start_date           = CASE WHEN @status = 'postponed' THEN NULL ELSE COALESCE(@start_date, start_date) END,
    end_date             = CASE WHEN @status = 'postponed' THEN NULL ELSE COALESCE(@end_date, end_date) END,
    priority             = COALESCE(@priority,     priority),
    status               = @status,
    percentage_completed = @pct,
    notes                = COALESCE(@notes,        notes),
    color                = COALESCE(@color,        color),
    type                 = COALESCE(@type,         type),
    category_id          = CASE WHEN @primaryCat IS NOT NULL THEN @primaryCat ELSE category_id END,
    category_ids         = CASE WHEN @catIdsJson IS NOT NULL THEN @catIdsJson ELSE category_ids END
    WHERE id = @id`).run({
      title: title ?? null, description: description ?? null,
      target_value: target_value ?? null, start_date: start_date ?? null,
      end_date: end_date ?? null, priority: priority ?? null,
      status: savedStatus, pct, notes: notes ?? null,
      color: color ?? null,
      type: type ?? null,
      primaryCat: primaryCat ?? null,
      catIdsJson: catIds !== undefined ? JSON.stringify(catIds) : null,
      id: req.params.id,
    });
  res.json(db.prepare('SELECT * FROM objectives WHERE id = ? AND user_id = ?').get(req.params.id, req.userId));
});

// ── MILESTONES ───────────────────────────────────────────────────────────────
app.get('/api/milestones', (req, res) => {
  const ms = db.prepare('SELECT * FROM milestones WHERE user_id = ? AND archived_at IS NULL AND (objective_id IS NULL OR objective_id NOT IN (SELECT id FROM objectives WHERE archived_at IS NOT NULL AND user_id = ?)) ORDER BY target_date').all(req.userId, req.userId);
  ms.forEach(m => { m.days_remaining = daysRemaining(m.target_date); });
  res.json(ms);
});

app.post('/api/milestones', (req, res) => {
  const { objective_id, title, description, target_date, weight, status, billed_amount, show_independent } = req.body;
  if (typeof title !== 'string' || !title.trim() || !objective_id) return res.status(400).json({ error: 'El título y el objetivo son obligatorios' });
  let independent;
  try { independent = independentFlag(show_independent); } catch (error) { return res.status(400).json({ error: error.message }); }
  if (!db.prepare('SELECT id FROM objectives WHERE id = ? AND user_id = ?').get(objective_id, req.userId)) return res.status(400).json({ error: 'Objetivo no encontrado' });
  const id = 'ms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  db.prepare('INSERT INTO milestones (id,objective_id,title,description,target_date,percentage_completed,status,weight,billed_amount,user_id,show_independent) VALUES (?,?,?,?,?,0,?,?,?,?,?)')
    .run(id, objective_id, title, description || '', target_date || null, status || 'not_started', weight ?? 10, billed_amount ?? 0, req.userId, independent ?? 0);
  res.status(201).json(db.prepare('SELECT * FROM milestones WHERE id = ? AND user_id = ?').get(id, req.userId));
});

app.delete('/api/milestones/:id', (req, res) => {
  const linkedTasks = db.prepare(`
    SELECT id, title, date, start_time, end_time, status
    FROM tasks
    WHERE milestone_id = ?
    ORDER BY COALESCE(date, '9999-99-99') ASC, COALESCE(start_time, '99:99') ASC, title ASC
  `).all(req.params.id);
  if (linkedTasks.length > 0) {
    return res.status(409).json({
      error: `Este hito tiene ${linkedTasks.length} tareas asignadas`,
      usages: [{
        type: 'Tareas',
        count: linkedTasks.length,
        items: linkedTasks.map(t => ({
          id: t.id,
          title: t.title,
          date: t.date || null,
          start_time: t.start_time || null,
          end_time: t.end_time || null,
          status: t.status || null,
        })),
      }],
    });
  }
  db.prepare('DELETE FROM milestones WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

app.put('/api/milestones/:id', (req, res) => {
  const { title, description, target_date, status, billed_amount, show_independent } = req.body;
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) return res.status(400).json({ error: 'El título es obligatorio' });
  let independent;
  try { independent = independentFlag(show_independent); } catch (error) { return res.status(400).json({ error: error.message }); }
  if (!db.prepare('SELECT id FROM milestones WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)) return res.status(404).json({ error: 'Hito no encontrado' });
  // percentage_completed and weight are no longer manually set — always computed from tasks
  const pct = computeMilestoneProgress(req.params.id);
  const ms  = db.prepare('SELECT status FROM milestones WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  // Honor the user-selected status; only fall back to stored value if status is not provided.
  const savedStatus = status !== undefined ? status : (ms?.status || 'not_started');
  db.prepare(`UPDATE milestones SET
    title                = COALESCE(@title,       title),
    description          = COALESCE(@description, description),
    target_date          = CASE WHEN @hasTargetDate THEN @target_date ELSE target_date END,
    billed_amount        = COALESCE(@billed_amount, billed_amount),
    show_independent     = COALESCE(@independent, show_independent),
    status               = @status,
    percentage_completed = @pct
    WHERE id = @id AND user_id = @uid`).run({
      title: title ?? null, description: description ?? null,
      target_date: target_date || null, hasTargetDate: Number(target_date !== undefined),
      billed_amount: billed_amount !== undefined ? Number(billed_amount) : null,
      status: savedStatus, pct, independent, uid: req.userId, id: req.params.id,
    });
  res.json(db.prepare('SELECT * FROM milestones WHERE id = ? AND user_id = ?').get(req.params.id, req.userId));
});

// ── EVENTS ───────────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  if (!isSectionEnabled(req.userId, 'events')) return res.json([]);
  const { from, to, objective_id } = req.query;
  let sql = 'SELECT * FROM events WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = events.objective_id AND objectives.archived_at IS NOT NULL)';
  const params = [req.userId];
  if (from)         { sql += ' AND end_date >= ?';    params.push(from); }
  if (to)           { sql += ' AND start_date <= ?';  params.push(to); }
  if (objective_id) { sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY start_date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(e => { e.days_remaining = daysRemaining(e.start_date || e.end_date); });
  res.json(rows);
});

app.post('/api/events', (req, res) => {
  const { title, start_date, end_date, location, format, estimated_cost, status, notes, objective_id, category_id, category_ids, percentage_completed, registered, hotel_booked, flight_booked } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  if (start_date && end_date && end_date < start_date) return res.status(400).json({ error: 'end_date no puede ser anterior a start_date' });
  const id = 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  db.prepare('INSERT INTO events (id,title,start_date,end_date,location,format,estimated_cost,status,notes,objective_id,category_id,category_ids,percentage_completed,registered,hotel_booked,flight_booked,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, start_date||null, end_date||null, location||null, format||null, estimated_cost||0, status||'not_started', notes||null, objective_id||null, primaryCat, cats.length ? JSON.stringify(cats) : null, percentage_completed||0, registered?1:0, hotel_booked?1:0, flight_booked?1:0, req.userId);
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(id, req.userId);
  ev.days_remaining = daysRemaining(ev.start_date || ev.end_date);
  res.status(201).json(ev);
});

app.put('/api/events/:id', (req, res) => {
  const { title, start_date, end_date, location, format, estimated_cost, status, notes, objective_id, category_id, category_ids, percentage_completed, registered, hotel_booked, flight_booked } = req.body;
  if (start_date && end_date && end_date < start_date) return res.status(400).json({ error: 'end_date no puede ser anterior a start_date' });
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats !== null ? (cats[0] || null) : (category_id ?? null);
  const catClause = cats !== null
    ? 'category_id = @cat, category_ids = @cids,'
    : 'category_id = COALESCE(@cat, category_id), category_ids = COALESCE(@cids, category_ids),';
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
    ${catClause}
    percentage_completed = COALESCE(@pct,   percentage_completed),
    registered           = COALESCE(@reg,   registered),
    hotel_booked         = COALESCE(@htl,   hotel_booked),
    flight_booked        = COALESCE(@flt,   flight_booked)
    WHERE id = @id`)
    .run({ title: title??null, sd: start_date??null, ed: end_date??null, loc: location??null,
      fmt: format??null, cost: estimated_cost??null, s: status??null, n: notes??null,
      oid: objective_id??null, cat: primaryCat, cids: cats !== null ? JSON.stringify(cats) : null,
      pct: percentage_completed??null,
      reg: registered !== undefined ? (registered ? 1 : 0) : null,
      htl: hotel_booked !== undefined ? (hotel_booked ? 1 : 0) : null,
      flt: flight_booked !== undefined ? (flight_booked ? 1 : 0) : null,
      id: req.params.id });
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  ev.days_remaining = daysRemaining(ev.start_date || ev.end_date);
  res.json(ev);
});

app.delete('/api/events/:id', (req, res) => {
  const linked = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (linked > 0) return res.status(409).json({ error: `Este evento tiene ${linked} tareas asociadas` });
  db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── PUBLICATIONS ─────────────────────────────────────────────────────────────
app.get('/api/publications', (req, res) => {
  if (!isSectionEnabled(req.userId, 'publications')) return res.json([]);
  const { from, to, objective_id } = req.query;
  let sql = 'SELECT * FROM publications WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = publications.objective_id AND objectives.archived_at IS NOT NULL)';
  const params = [req.userId];
  if (from)        { sql += ' AND date >= ?';        params.push(from); }
  if (to)          { sql += ' AND date <= ?';        params.push(to); }
  if (objective_id){ sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(p => { p.days_remaining = daysRemaining(p.date); });
  res.json(rows);
});

app.post('/api/publications', (req, res) => {
  const { title, type, date, status, notes, publication_text, objective_id, category_id, category_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'pub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  const publicationType = type || 'idea';
  const publicationDate = publicationType === 'idea' ? null : (date || null);
  const publicationObjectiveId = publicationType === 'idea' ? null : (objective_id || null);
  db.prepare('INSERT INTO publications (id,title,type,date,status,notes,publication_text,objective_id,category_id,category_ids,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, publicationType, publicationDate, status || 'pending', notes || null, publication_text || null, publicationObjectiveId, primaryCat, cats.length ? JSON.stringify(cats) : null, req.userId);
  const pub = db.prepare('SELECT * FROM publications WHERE id = ? AND user_id = ?').get(id, req.userId);
  pub.days_remaining = daysRemaining(pub.date);
  res.status(201).json(pub);
});

app.put('/api/publications/:id', (req, res) => {
  const { status, notes, publication_text, objective_id, title, type, date, category_id, category_ids } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  const publicationType = type ?? null;
  const publicationDate = publicationType === 'idea' ? null : (date ?? null);
  const publicationObjectiveId = publicationType === 'idea' ? null : (objective_id ?? null);
  db.prepare(`UPDATE publications SET
    title        = COALESCE(@title,       title),
    type         = COALESCE(@type,        type),
    date         = COALESCE(@date,        date),
    status       = COALESCE(@status,      status),
    notes        = COALESCE(@notes,       notes),
    publication_text = COALESCE(@publication_text, publication_text),
    objective_id = COALESCE(@oid,         objective_id),
    category_id  = COALESCE(@cat,         category_id),
    category_ids = COALESCE(@cids,        category_ids)
    WHERE id = @id`)
    .run({
      title: title ?? null, type: publicationType, date: publicationDate,
      status: status ?? null, notes: notes ?? null, oid: publicationObjectiveId,
      publication_text: publication_text ?? null,
      cat: primaryCat, cids: cats ? JSON.stringify(cats) : null,
      id: req.params.id,
    });
  const pub = db.prepare('SELECT * FROM publications WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  pub.days_remaining = daysRemaining(pub.date);
  res.json(pub);
});

app.delete('/api/publications/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Esta publicación tiene ${tasks} tareas asociadas` });
  db.prepare('DELETE FROM publications WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── CERTIFICATIONS ───────────────────────────────────────────────────────────
app.get('/api/certifications', (req, res) => {
  if (!isSectionEnabled(req.userId, 'certifications')) return res.json([]);
  const { objective_id } = req.query;
  let sql = 'SELECT * FROM certifications WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = certifications.objective_id AND objectives.archived_at IS NOT NULL)';
  const params = [req.userId];
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
  db.prepare('INSERT INTO certifications (id,title,target_date,status,notes,objective_id,category_id,category_ids,user_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, title, target_date || null, status || 'not_started', notes || null, objective_id || null, primaryCat, cats.length ? JSON.stringify(cats) : null, req.userId);
  const cert = db.prepare('SELECT * FROM certifications WHERE id = ? AND user_id = ?').get(id, req.userId);
  cert.days_remaining = daysRemaining(cert.target_date);
  res.status(201).json(cert);
});

app.put('/api/certifications/:id', (req, res) => {
  const { title, target_date, status, notes, objective_id, category_id, category_ids, percentage_completed } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  db.prepare(`UPDATE certifications SET
    title                = COALESCE(@title, title),
    target_date          = COALESCE(@target_date, target_date),
    status               = COALESCE(@s,   status),
    notes                = COALESCE(@n,   notes),
    objective_id         = COALESCE(@oid, objective_id),
    category_id          = COALESCE(@cat, category_id),
    category_ids         = COALESCE(@cids,category_ids),
    percentage_completed = COALESCE(@pct, percentage_completed)
    WHERE id = @id`)
    .run({ title: title ?? null, target_date: target_date ?? null,
      s: status ?? null, n: notes ?? null, oid: objective_id ?? null,
      cat: primaryCat, cids: cats ? JSON.stringify(cats) : null,
      pct: percentage_completed ?? null, id: req.params.id });
  const cert = db.prepare('SELECT * FROM certifications WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  cert.days_remaining = daysRemaining(cert.target_date);
  res.json(cert);
});

app.delete('/api/certifications/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Esta certificación tiene ${tasks} tareas asociadas` });
  db.prepare('DELETE FROM certifications WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── REPOS ─────────────────────────────────────────────────────────────────────
function independentFlag(value) {
  if (value === undefined) return null;
  if (![true, false, 0, 1].includes(value)) throw new Error('Mostrar independiente debe ser una casilla válida');
  return Number(value);
}

function isNotebookDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function serializeNotebook(value, previousNotebook = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Contenido del proyecto inválido');
  const { photos = [], notes = [], tables = [], widgets = [] } = value;
  if (![photos, notes, tables, widgets].every(Array.isArray)) throw new Error('Contenido del proyecto inválido');
  if (photos.length > 100) throw new Error('El proyecto admite un máximo de 100 fotos');
  const idsAreUnique = items => items.every(item => item && typeof item.id === 'string' && item.id.length > 0)
    && new Set(items.map(item => item.id)).size === items.length;
  if (![photos, notes, tables, widgets].every(idsAreUnique)) throw new Error('Identificadores inválidos');
  let previousPhotos = [];
  try { previousPhotos = JSON.parse(previousNotebook || '{}').photos || []; } catch (_) { /* Invalid legacy data does not bypass the upload limit. */ }
  if (!Array.isArray(previousPhotos)) previousPhotos = [];
  for (const photo of photos) {
    if (typeof photo.name !== 'string' || typeof photo.src !== 'string'
      || !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.src)
      || (Buffer.byteLength(photo.src.split(',')[1], 'base64') > 800 * 1024
        && !previousPhotos.some(previous => previous.id === photo.id && previous.src === photo.src))) throw new Error('Foto inválida (máximo 800 KB; PNG, JPEG, GIF o WebP)');
    if (photo.labels !== undefined && (!Array.isArray(photo.labels) || !idsAreUnique(photo.labels)
      || photo.labels.some(label => typeof label.text !== 'string' || label.text.length > 500
        || ![label.x, label.y].every(position => typeof position === 'number' && Number.isFinite(position) && position >= 0 && position <= 100)))) throw new Error('Etiqueta de foto inválida');
  }
  for (const note of notes) {
    if (typeof note.title !== 'string' || typeof note.text !== 'string' || (note.list !== undefined && typeof note.list !== 'string')) throw new Error('Nota inválida');
  }
  for (const widget of widgets) {
    if (typeof widget.title !== 'string' || typeof widget.text !== 'string') throw new Error('Widget inválido');
  }
  for (const table of tables) {
    if (typeof table.name !== 'string' || !Array.isArray(table.columns) || !Array.isArray(table.rows)
      || !idsAreUnique(table.columns) || !idsAreUnique(table.rows)) throw new Error('Tabla inválida');
    for (const column of table.columns) {
      if (typeof column.name !== 'string' || !column.name.trim()
        || !['text', 'number', 'date', 'checkbox'].includes(column.type)) throw new Error('Indica la cabecera y el tipo de cada columna');
    }
    for (const row of table.rows) {
      if (!row.cells || typeof row.cells !== 'object' || Array.isArray(row.cells)) throw new Error('Fila inválida');
      if (Object.keys(row.cells).some(key => !table.columns.some(column => column.id === key))) throw new Error('La fila contiene una columna desconocida');
      for (const column of table.columns) {
        const cell = row.cells[column.id];
        if (cell === undefined || cell === '') continue;
        if (column.type === 'checkbox' ? typeof cell !== 'boolean'
          : column.type === 'number' ? typeof cell !== 'number' || !Number.isFinite(cell)
          : typeof cell !== 'string' || (column.type === 'date' && !isNotebookDate(cell))) throw new Error('Tipo de celda inválido');
      }
    }
  }
  const serialized = JSON.stringify({ photos, notes, tables, widgets });
  return serialized;
}

app.get('/api/repos', (req, res) => {
  if (!isSectionEnabled(req.userId, 'repos')) return res.json([]);
  const { objective_id } = req.query;
  let sql = 'SELECT * FROM repos WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = repos.objective_id AND objectives.archived_at IS NOT NULL)';
  const params = [req.userId];
  if (objective_id) { sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY target_date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => { r.days_remaining = daysRemaining(r.target_date); });
  res.json(rows);
});

app.post('/api/repos', (req, res) => {
  const { title, target_date, type, status, notes, objective_id, url, category_id, category_ids, notebook, show_independent, independent_color } = req.body;
  if (objective_id && !db.prepare('SELECT id FROM objectives WHERE id = ? AND user_id = ?').get(objective_id, req.userId)) return res.status(400).json({ error: 'Objetivo no encontrado' });
  if (independent_color != null && independent_color !== '' && (typeof independent_color !== 'string' || !/^#[0-9a-f]{6}$/i.test(independent_color))) return res.status(400).json({ error: 'Color del proyecto inválido' });
  let independent;
  try { independent = independentFlag(show_independent); } catch (error) { return res.status(400).json({ error: error.message }); }
  let notebookJson = '{}';
  try { if (notebook !== undefined) notebookJson = serializeNotebook(notebook); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
  if (type !== undefined && !['client', 'sangalan', 'personal', 'notes'].includes(type)) return res.status(400).json({ error: 'Tipo de proyecto inválido' });
  const id = 'repo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  db.prepare('INSERT INTO repos (id,title,target_date,type,status,notes,objective_id,url,category_id,category_ids,user_id,notebook,show_independent,independent_color) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title.trim(), target_date || null, type || 'personal', status || 'not_started', notes || null, objective_id || null, url || null, primaryCat, cats.length ? JSON.stringify(cats) : null, req.userId, notebookJson, independent ?? 0, independent_color || null);
  const repo = db.prepare('SELECT * FROM repos WHERE id = ? AND user_id = ?').get(id, req.userId);
  repo.days_remaining = daysRemaining(repo.target_date);
  res.status(201).json(repo);
});

app.put('/api/repos/:id', (req, res) => {
  const { title, target_date, type, status, notes, objective_id, category_id, category_ids, url, notebook, show_independent, independent_color } = req.body;
  const storedRepo = db.prepare('SELECT id, notebook FROM repos WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!storedRepo) {
    return res.status(404).json({ error: 'Proyecto no encontrado' });
  }
  if (objective_id && !db.prepare('SELECT id FROM objectives WHERE id = ? AND user_id = ?').get(objective_id, req.userId)) return res.status(400).json({ error: 'Objetivo no encontrado' });
  if (independent_color != null && independent_color !== '' && (typeof independent_color !== 'string' || !/^#[0-9a-f]{6}$/i.test(independent_color))) return res.status(400).json({ error: 'Color del proyecto inválido' });
  let independent;
  try { independent = independentFlag(show_independent); } catch (error) { return res.status(400).json({ error: error.message }); }
  let notebookJson = null;
  try { if (notebook !== undefined) notebookJson = serializeNotebook(notebook, storedRepo.notebook); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) return res.status(400).json({ error: 'El título es obligatorio' });
  if (type != null && !['client', 'sangalan', 'personal', 'notes'].includes(type)) return res.status(400).json({ error: 'Tipo de proyecto inválido' });
  let cats = null;
  try {
    if (category_ids !== undefined) {
      cats = typeof category_ids === 'string' ? JSON.parse(category_ids) : category_ids;
      if (!Array.isArray(cats)) throw new Error();
    }
  } catch (_) { return res.status(400).json({ error: 'Categorías inválidas' }); }
  const primaryCat = cats !== null ? (cats[0] || null) : (category_id ?? null);
  // Use direct assignment for category fields when explicitly provided (allows clearing to null)
  const catClause = cats !== null
    ? 'category_id = @cat, category_ids = @cids,'
    : 'category_id = COALESCE(@cat, category_id), category_ids = COALESCE(@cids, category_ids),';
  db.prepare(`UPDATE repos SET
    title        = COALESCE(@title, title),
    target_date = CASE WHEN @hasTd THEN @td ELSE target_date END,
    type         = COALESCE(@type, type),
    status       = COALESCE(@s,   status),
    notes = CASE WHEN @hasNotes THEN @n ELSE notes END,
    objective_id = CASE WHEN @hasOid THEN @oid ELSE objective_id END,
    ${catClause}
    url = CASE WHEN @hasUrl THEN @url ELSE url END,
    show_independent = COALESCE(@independent, show_independent),
    independent_color = CASE WHEN @hasColor THEN @color ELSE independent_color END,
    notebook     = COALESCE(@notebook, notebook)
    WHERE id = @id AND user_id = @uid`)
    .run({ title: typeof title === 'string' ? title.trim() : null, td: target_date || null, type: type ?? null,
      s: status ?? null, n: notes ?? null, oid: objective_id || null,
      cat: primaryCat, cids: cats !== null ? JSON.stringify(cats) : null,
      hasTd: Number(target_date !== undefined), hasOid: Number(objective_id !== undefined),
      hasUrl: Number(url !== undefined), hasNotes: Number(notes !== undefined),
      hasColor: Number(independent_color !== undefined), color: independent_color || null,
      url: url || null, notebook: notebookJson, independent, uid: req.userId, id: req.params.id });
  const repo = db.prepare('SELECT * FROM repos WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  repo.days_remaining = daysRemaining(repo.target_date);
  res.json(repo);
});

app.delete('/api/repos/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM repos WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)) return res.status(404).json({ error: 'Proyecto no encontrado' });
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Este proyecto tiene ${tasks} tareas asociadas` });
  db.prepare('UPDATE documents SET repo_id = NULL WHERE repo_id = ? AND user_id = ?').run(req.params.id, req.userId);
  db.prepare('DELETE FROM repos WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── PRs ──────────────────────────────────────────────────────────────────────
app.get('/api/prs', (req, res) => {
  if (!isSectionEnabled(req.userId, 'prs')) return res.json([]);
  const { objective_id } = req.query;
  let sql = 'SELECT * FROM prs WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = prs.objective_id AND objectives.archived_at IS NOT NULL)';
  const params = [req.userId];
  if (objective_id) { sql += ' AND objective_id = ?'; params.push(objective_id); }
  sql += ' ORDER BY start_date';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => { r.days_remaining = daysRemaining(r.end_date); });
  res.json(rows);
});

app.post('/api/prs', (req, res) => {
  const { title, start_date, end_date, status, notes, notas, objective_id, category_id, category_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  const normalizedNotes = notes ?? notas ?? null;
  db.prepare('INSERT INTO prs (id,title,start_date,end_date,status,notes,objective_id,category_id,category_ids,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, start_date || null, end_date || null, status || 'not_started', normalizedNotes, objective_id || null, primaryCat, cats.length ? JSON.stringify(cats) : null, req.userId);
  const pr = db.prepare('SELECT * FROM prs WHERE id = ? AND user_id = ?').get(id, req.userId);
  pr.days_remaining = daysRemaining(pr.end_date);
  res.status(201).json(pr);
});

app.put('/api/prs/:id', (req, res) => {
  const {
    title,
    start_date,
    end_date,
    status,
    notes,
    notas,
    objective_id,
    category_id,
    category_ids,
    percentage_completed,
  } = req.body;
  const cats = category_ids !== undefined
    ? (Array.isArray(category_ids) ? category_ids : (typeof category_ids === 'string' ? JSON.parse(category_ids) : []))
    : null;
  const primaryCat = cats ? (cats[0] || null) : (category_id ?? null);
  const normalizedNotes = notes ?? notas ?? null;
  db.prepare(`UPDATE prs SET
    title                = COALESCE(@title, title),
    start_date           = COALESCE(@start, start_date),
    end_date             = COALESCE(@end, end_date),
    status               = COALESCE(@s,   status),
    notes                = COALESCE(@n,   notes),
    objective_id         = COALESCE(@oid, objective_id),
    category_id          = COALESCE(@cat, category_id),
    category_ids         = COALESCE(@cids,category_ids),
    percentage_completed = COALESCE(@pct, percentage_completed)
    WHERE id = @id`)
    .run({ title: title ?? null, start: start_date ?? null, end: end_date ?? null,
      s: status ?? null, n: normalizedNotes, oid: objective_id ?? null,
      cat: primaryCat, cids: cats ? JSON.stringify(cats) : null,
      pct: percentage_completed ?? null, id: req.params.id });
  const pr = db.prepare('SELECT * FROM prs WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  pr.days_remaining = daysRemaining(pr.end_date);
  res.json(pr);
});

app.delete('/api/prs/:id', (req, res) => {
  const tasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE milestone_id = ?').get(req.params.id).n;
  if (tasks > 0) return res.status(409).json({ error: `Este PR tiene ${tasks} tareas asociadas` });
  db.prepare('DELETE FROM prs WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── READING LIST ─────────────────────────────────────────────────────────────
app.get('/api/reading-list', (req, res) => {
  if (!isSectionEnabled(req.userId, 'reading_list')) return res.json([]);
  const rows = db.prepare('SELECT * FROM reading_list WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC').all(req.userId);
  res.json(rows);
});

app.post('/api/reading-list', (req, res) => {
  const { title, urls, category_ids, category_id, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title es obligatorio' });
  const id = 'rl-' + Date.now();
  const minOrder = db.prepare('SELECT MIN(sort_order) as m FROM reading_list WHERE user_id = ?').get(req.userId).m ?? 0;
  const sortOrder = minOrder - 1;
  const cats = Array.isArray(category_ids) ? category_ids : [];
  const primaryCat = cats[0] || category_id || null;
  const urlsJson = Array.isArray(urls) ? JSON.stringify(urls) : (urls || null);
  db.prepare(`INSERT INTO reading_list (id, title, urls, category_ids, category_id, notes, status, sort_order, user_id)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
    .run(id, title, urlsJson, cats.length ? JSON.stringify(cats) : null, primaryCat, notes || null, sortOrder, req.userId);
  res.json(db.prepare('SELECT * FROM reading_list WHERE id = ? AND user_id = ?').get(id, req.userId));
});

// IMPORTANT: /reorder must be before /:id to avoid route conflict
app.post('/api/reading-list/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids debe ser un array' });
  const update = db.prepare('UPDATE reading_list SET sort_order = ? WHERE id = ? AND user_id = ?');
  const tx = db.transaction(() => {
    ids.forEach((id, i) => update.run(i, id, req.userId));
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
  res.json(db.prepare('SELECT * FROM reading_list WHERE id = ? AND user_id = ?').get(req.params.id, req.userId));
});

app.delete('/api/reading-list/:id', (req, res) => {
  db.prepare('DELETE FROM reading_list WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── WORK BLOCKS ───────────────────────────────────────────────────────────────
app.get('/api/work-blocks', (req, res) => {
  res.json(db.prepare('SELECT * FROM work_blocks WHERE user_id = ? ORDER BY start_time').all(req.userId));
});

// ── DASHBOARD ────────────────────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  const userId = req.userId;
  const refs = getHiddenTaskRefs(userId, true);
  const today = new Date().toISOString().slice(0, 10);
  const doneTaskStatuses = new Set(['completed']);
  const doneItemStatuses = new Set(['published', 'completed', 'merged', 'closed', 'failed', 'cancelled']);
  const hiddenMilestones = new Set(refs.hiddenMilestoneIds);
  const hiddenObjectives = new Set(refs.hiddenObjectiveIds);
  const isVisibleTask = (t) =>
    !t.archived_at &&
    (!t.milestone_id || !hiddenMilestones.has(t.milestone_id)) &&
    (!t.objective_id || !hiddenObjectives.has(t.objective_id));
  const todayTasks  = db.prepare('SELECT * FROM tasks WHERE date = ? AND user_id = ? ORDER BY start_time').all(today, userId).filter(isVisibleTask);
  const allNonFixedTasks = db.prepare('SELECT * FROM tasks WHERE is_fixed = 0 AND user_id = ?').all(userId).filter(isVisibleTask);
  const totalTasks  = allNonFixedTasks.length;
  const doneTasks   = allNonFixedTasks.filter(t => t.status === 'completed').length;
  const overdueTasks= db.prepare(`SELECT * FROM tasks WHERE is_fixed = 0 AND date < ? AND (start_time IS NOT NULL OR end_time IS NOT NULL) AND status != 'completed' AND user_id = ? ORDER BY date`).all(today, userId).filter(isVisibleTask);

  const nextMilestones = db.prepare(`SELECT m.*, o.title as obj_title FROM milestones m
    JOIN objectives o ON m.objective_id = o.id
    WHERE m.status != 'completed' AND m.archived_at IS NULL AND o.archived_at IS NULL AND m.target_date >= ? AND m.user_id = ? AND o.user_id = ?
    ORDER BY m.target_date LIMIT 5`).all(today, userId, userId);
  nextMilestones.forEach(m => { m.days_remaining = daysRemaining(m.target_date); });

  // Next 7 days events
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 7);
  const nextWeek = nextDate.toISOString().slice(0, 10);
  const nextEvents = db.prepare('SELECT * FROM events WHERE archived_at IS NULL AND start_date BETWEEN ? AND ? AND user_id = ? AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = events.objective_id AND objectives.archived_at IS NOT NULL) ORDER BY start_date').all(today, nextWeek, userId);

  // Progress by objective (filled after objHoursMap is ready below)
  const objectives = db.prepare(`SELECT * FROM objectives WHERE user_id = ? AND archived_at IS NULL ${isSectionEnabled(userId, 'clients') ? '' : "AND type != 'client'"} ORDER BY priority`).all(userId);

  // Tasks by category (last 30 days)
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const catStats = db.prepare(`
    SELECT category_id,
      COUNT(*) as total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done
    FROM tasks WHERE date >= ? AND user_id = ? AND archived_at IS NULL GROUP BY category_id
  `).all(thirtyAgo.toISOString().slice(0, 10), userId);

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
    WHERE status = 'completed' AND objective_id IS NOT NULL AND user_id = ? AND archived_at IS NULL
    GROUP BY objective_id
  `).all(userId);
  const objHoursMap = {};
  for (const row of objHoursRows) objHoursMap[row.objective_id] = row.hours;

  for (const obj of objectives) {
    const objectiveTasks = db.prepare('SELECT * FROM tasks WHERE objective_id = ? AND is_fixed = 0 AND user_id = ?').all(obj.id, userId).filter(isVisibleTask);
    obj.task_count = objectiveTasks.length;
    obj.done_count = objectiveTasks.filter(t => t.status === 'completed').length;
    obj.days_remaining = daysRemaining(obj.end_date);
    obj.hours_completed = Math.round((objHoursMap[obj.id] || 0) * 10) / 10;
  }

  // Publications progress
  const pubTotal = isSectionEnabled(userId, 'publications')
    ? db.prepare('SELECT COUNT(*) as n FROM publications WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = publications.objective_id AND objectives.archived_at IS NOT NULL)').get(userId).n
    : 0;
  const pubDone  = isSectionEnabled(userId, 'publications')
    ? db.prepare("SELECT COUNT(*) as n FROM publications WHERE status = 'published' AND user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = publications.objective_id AND objectives.archived_at IS NOT NULL)").get(userId).n
    : 0;

  // Certifications progress
  const certTotal = isSectionEnabled(userId, 'certifications')
    ? db.prepare('SELECT COUNT(*) as n FROM certifications WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = certifications.objective_id AND objectives.archived_at IS NOT NULL)').get(userId).n
    : 0;
  const certDone  = isSectionEnabled(userId, 'certifications')
    ? db.prepare("SELECT COUNT(*) as n FROM certifications WHERE status = 'completed' AND user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = certifications.objective_id AND objectives.archived_at IS NOT NULL)").get(userId).n
    : 0;

  function getNearestPlannedItem(table, emptyLabel) {
    const items = db.prepare(`SELECT id, title, status FROM ${table} WHERE user_id = ? AND archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = ${table}.objective_id AND objectives.archived_at IS NOT NULL)`).all(userId);
    const candidates = items
      .filter(item => !doneItemStatuses.has(item.status))
      .map(item => {
        const nextTask = db.prepare(`
          SELECT id, title, date, start_time, status
          FROM tasks
          WHERE milestone_id = ? AND archived_at IS NULL
            AND date IS NOT NULL
            AND status != 'completed'
            AND date >= ?
          ORDER BY date, start_time
          LIMIT 1
        `).get(item.id, today);
        if (!nextTask) return null;
        return { label: item.title, date: nextTask.date };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'es'));

    return candidates[0] || { label: emptyLabel, date: null };
  }

  const nextExamTask = db.prepare(`
    SELECT t.id, t.title, t.date, t.start_time
    FROM tasks t
    JOIN certifications c ON c.id = t.milestone_id
    WHERE t.date IS NOT NULL
      AND t.status != 'completed'
      AND t.date >= ?
      AND lower(trim(t.title)) LIKE 'examen%'
      AND c.status != 'completed' AND c.archived_at IS NULL AND t.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM objectives WHERE objectives.id = c.objective_id AND objectives.archived_at IS NOT NULL)
      AND t.user_id = ?
      AND c.user_id = ?
    ORDER BY t.date, t.start_time
    LIMIT 1
  `).get(today, userId, userId) || null;

  const nextSpecialMilestones = {
    exam: nextExamTask
      ? { label: nextExamTask.title, date: nextExamTask.date }
      : { label: 'No planificado', date: null },
    publication: getNearestPlannedItem('publications', 'No planificada'),
    pr: getNearestPlannedItem('prs', 'No planificada'),
    repo: getNearestPlannedItem('repos', 'No planificado'),
  };

  const globalPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

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
    next_special_milestones: nextSpecialMilestones,
  });
});


// ── EXPORT / IMPORT ──────────────────────────────────────────────────────────
app.get(['/api/backup', '/api/export'], (req, res) => {
  const data = createBackup(db, uploadsDir, 'selected', [req.userId]);
  // This is a complete backup of the authenticated account, even though the
  // database may contain isolated records for other accounts.
  data.scope = 'all';
  const filename = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.type('application/json').send(JSON.stringify(data, null, 2));
});

app.post(['/api/restore', '/api/import'], (req, res) => {
  const { strategy = 'skip', ...data } = req.body || {};
  try {
    const result = importBackup(db, uploadsDir, data, strategy, { targetUserId: req.userId });
    maintainNotepad();
    res.json({ ok: true, strategy, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ── Documents ────────────────────────────────────────────────────────────────

app.get('/api/documents', (req, res) => {
  if (!isSectionEnabled(req.userId, 'documents')) return res.json([]);
  const { q, sort = 'created_at', repo_id } = req.query;
  const col = sort === 'name' ? 'name' : 'created_at';
  let sql = `SELECT * FROM documents WHERE user_id = ?`;
  const params = [req.userId];
  if (repo_id) { sql += ' AND repo_id = ?'; params.push(repo_id); }
  if (q) { sql += ` AND name LIKE ?`; params.push(`%${q}%`); }
  sql += ` ORDER BY ${col} DESC`;
  const rows = db.prepare(sql).all(...params).map(d => ({
    ...d,
    category_ids: (() => { try { return JSON.parse(d.category_ids || '[]'); } catch (_) { return []; } })(),
  }));
  res.json(rows);
});

app.post('/api/documents', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const repoId = req.body.repo_id || null;
  if (repoId && !db.prepare('SELECT id FROM repos WHERE id = ? AND user_id = ?').get(repoId, req.userId)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Proyecto no encontrado' });
  }
  const id = require('crypto').randomUUID();
  const name = req.body.name || req.file.originalname;
  const catIds = req.body.category_ids ? JSON.stringify(JSON.parse(req.body.category_ids)) : '[]';
  db.prepare(`INSERT INTO documents (id, name, filename, mime_type, size, category_ids, repo_id, user_id) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, name, req.file.filename, req.file.mimetype, req.file.size, catIds, repoId, req.userId);
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(id, req.userId);
  res.json({ ...doc, category_ids: JSON.parse(doc.category_ids || '[]') });
});

app.get('/api/documents/:id/preview', (req, res) => {
  const doc = db.prepare('SELECT filename, name FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
  const extension = path.extname(doc.name).toLowerCase();
  if (!['.doc', '.docx'].includes(extension)) return res.status(415).json({ error: 'Formato no compatible' });
  try { res.type('text/plain; charset=utf-8').send(extension === '.docx' ? readDocxText(path.join(uploadsDir, doc.filename)) : readLegacyDocText(path.join(uploadsDir, doc.filename))); }
  catch (_) { res.status(422).json({ error: 'No se pudo visualizar este DOCX' }); }
});

app.put('/api/documents/:id', (req, res) => {
  const { name, category_ids } = req.body;
  db.prepare('UPDATE documents SET name = ?, category_ids = ? WHERE id = ? AND user_id = ?')
    .run(name, JSON.stringify(category_ids || []), req.params.id, req.userId);
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  res.json({ ...doc, category_ids: JSON.parse(doc.category_ids || '[]') });
});

app.delete('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!doc) return res.json({ ok: true });
  const filePath = path.join(uploadsDir, doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// Serve the production frontend from the API process. During development Vite
// still serves the UI because this directory is only created by a build.
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(frontendDistDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
