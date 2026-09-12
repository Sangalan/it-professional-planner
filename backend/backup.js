const fs = require('fs');
const path = require('path');

const TABLES = [
  'users', 'categories', 'objectives', 'milestones', 'tasks', 'deadlines',
  'events', 'publications', 'certifications', 'repos', 'prs', 'work_blocks',
  'reading_list', 'documents',
];

const USER_TABLES = TABLES.filter(table => table !== 'users');
const IMPORT_ORDER = [
  'users', 'categories', 'objectives', 'milestones', 'events', 'publications',
  'certifications', 'repos', 'prs', 'work_blocks', 'reading_list', 'documents',
  'deadlines', 'tasks',
];

const RELATIONS = {
  categories: { user_id: 'users' },
  objectives: { user_id: 'users', category_id: 'categories' },
  milestones: { user_id: 'users', objective_id: 'objectives' },
  tasks: { user_id: 'users', category_id: 'categories', objective_id: 'objectives', cloned_from: 'tasks' },
  deadlines: { user_id: 'users' },
  events: { user_id: 'users', category_id: 'categories', objective_id: 'objectives' },
  publications: { user_id: 'users', category_id: 'categories', objective_id: 'objectives' },
  certifications: { user_id: 'users', category_id: 'categories', objective_id: 'objectives' },
  repos: { user_id: 'users', category_id: 'categories', objective_id: 'objectives' },
  prs: { user_id: 'users', category_id: 'categories', objective_id: 'objectives' },
  work_blocks: { user_id: 'users', category_id: 'categories' },
  reading_list: { user_id: 'users', category_id: 'categories' },
  documents: { user_id: 'users' },
};

function safeFilename(filename) {
  const safe = path.basename(String(filename || ''));
  return safe && safe !== '.' && safe !== '..' ? safe : null;
}

function getColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
}

function insertRow(db, table, row) {
  const allowed = new Set(getColumns(db, table));
  const columns = Object.keys(row || {}).filter(column => allowed.has(column));
  if (!columns.includes('id')) return false;
  db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
    .run(...columns.map(column => row[column] ?? null));
  return true;
}

function createBackup(db, uploadsDir, scope, requestedUserIds) {
  const selectedUsers = scope === 'selected'
    ? (requestedUserIds.length
      ? db.prepare(`SELECT * FROM users WHERE id IN (${requestedUserIds.map(() => '?').join(',')})`).all(...requestedUserIds)
      : [])
    : db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE ASC').all();
  const userIds = selectedUsers.map(user => user.id);
  const where = userIds.length ? ` WHERE user_id IN (${userIds.map(() => '?').join(',')})` : ' WHERE 1=0';
  const backup = {
    exported_at: new Date().toISOString(),
    version: 2,
    scope,
    users: selectedUsers,
  };
  for (const table of USER_TABLES) {
    backup[table] = db.prepare(`SELECT * FROM ${table}${where}`).all(...userIds);
  }
  backup.document_files = backup.documents.flatMap(document => {
    const filename = safeFilename(document.filename);
    if (!filename) return [];
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return [];
    return [{ document_id: document.id, filename, data_base64: fs.readFileSync(filePath).toString('base64') }];
  });
  return backup;
}

function importBackup(db, uploadsDir, data, strategy, options = {}) {
  const targetUserId = options.targetUserId || null;
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.tasks)) {
    const error = new Error('JSON inválido. Debe contener al menos categories y tasks.');
    error.status = 400;
    throw error;
  }
  if (!['skip', 'rename', 'restore'].includes(strategy)) {
    const error = new Error('Estrategia de importación no válida.');
    error.status = 400;
    throw error;
  }
  if (strategy === 'restore' && (
    data.version < 2 || data.scope !== 'all' || TABLES.some(table => !Array.isArray(data[table]))
  )) {
    const error = new Error('La restauración completa requiere una copia integral de versión 2.');
    error.status = 400;
    throw error;
  }

  const stats = { inserted: {}, skipped: {} };
  const track = (table, inserted) => {
    const key = inserted ? 'inserted' : 'skipped';
    stats[key][table] = (stats[key][table] || 0) + 1;
  };
  const maps = Object.fromEntries(TABLES.map(table => [table, new Map()]));
  const reservedIds = Object.fromEntries(TABLES.map(table => [table, new Set()]));

  function chooseId(table, originalId) {
    if (strategy === 'restore') return originalId;
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(originalId) && !reservedIds[table].has(originalId)) {
      reservedIds[table].add(originalId);
      return originalId;
    }
    if (strategy === 'skip') return null;
    let suffix = 2;
    let candidate = `${originalId}-${suffix}`;
    while (db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(candidate) || reservedIds[table].has(candidate)) {
      candidate = `${originalId}-${++suffix}`;
    }
    reservedIds[table].add(candidate);
    return candidate;
  }

  if (targetUserId) {
    for (const user of (data.users || [])) maps.users.set(user.id, targetUserId);
  }
  for (const table of IMPORT_ORDER) {
    if (targetUserId && table === 'users') continue;
    for (const row of (data[table] || [])) {
      if (row?.id != null) maps[table].set(row.id, chooseId(table, row.id));
    }
  }

  const fileByDocument = new Map((data.document_files || []).map(file => [file.document_id, file]));
  const replacedFilenames = strategy === 'restore' && targetUserId
    ? db.prepare('SELECT filename FROM documents WHERE user_id = ?').all(targetUserId).map(row => safeFilename(row.filename)).filter(Boolean)
    : [];
  const currentFilenames = fs.readdirSync(uploadsDir);
  const usedFilenames = new Set(strategy === 'restore'
    ? (targetUserId ? currentFilenames.filter(filename => !replacedFilenames.includes(filename)) : [])
    : currentFilenames);
  const filesToWrite = [];
  function uniqueFilename(filename) {
    const safe = safeFilename(filename);
    if (!safe) return null;
    if (!usedFilenames.has(safe)) { usedFilenames.add(safe); return safe; }
    const extension = path.extname(safe);
    const stem = path.basename(safe, extension);
    let suffix = 2;
    let candidate = `${stem}-${suffix}${extension}`;
    while (usedFilenames.has(candidate)) candidate = `${stem}-${++suffix}${extension}`;
    usedFilenames.add(candidate);
    return candidate;
  }

  function remapCategoryIds(value) {
    if (!value) return value;
    try {
      return JSON.stringify(JSON.parse(value).map(id => maps.categories.get(id) || id));
    } catch (_) {
      return value;
    }
  }

  const transaction = db.transaction(() => {
    if (strategy === 'restore') {
      if (targetUserId) {
        for (const table of [...USER_TABLES].reverse()) db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(targetUserId);
      } else {
        for (const table of [...IMPORT_ORDER].reverse()) db.prepare(`DELETE FROM ${table}`).run();
      }
    }
    for (const table of IMPORT_ORDER) {
      if (targetUserId && table === 'users') continue;
      for (const source of (data[table] || [])) {
        const id = maps[table].get(source?.id);
        if (!id) { track(table, false); continue; }
        const row = { ...source, id };
        if (targetUserId && table !== 'users') row.user_id = targetUserId;
        for (const [field, target] of Object.entries(RELATIONS[table] || {})) {
          if (row[field] != null) row[field] = maps[target].get(row[field]) || row[field];
        }
        if ('category_ids' in row) row.category_ids = remapCategoryIds(row.category_ids);
        if (table === 'tasks' && row.milestone_id) {
          for (const target of ['milestones', 'publications', 'certifications', 'repos', 'prs', 'events']) {
            if (maps[target].has(row.milestone_id)) {
              row.milestone_id = maps[target].get(row.milestone_id) || row.milestone_id;
              break;
            }
          }
        }
        if (table === 'documents') {
          const file = fileByDocument.get(source.id);
          if (file?.data_base64) {
            row.filename = uniqueFilename(file.filename || row.filename);
            if (!row.filename) throw new Error(`Nombre de archivo inválido para el documento ${source.id}.`);
            filesToWrite.push({ filename: row.filename, data: Buffer.from(file.data_base64, 'base64') });
          }
        }
        track(table, insertRow(db, table, row));
      }
    }
  });

  transaction();
  if (strategy === 'restore') {
    const filenames = targetUserId ? replacedFilenames : fs.readdirSync(uploadsDir);
    for (const filename of filenames) {
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
    }
  }
  for (const file of filesToWrite) fs.writeFileSync(path.join(uploadsDir, file.filename), file.data);
  const userIdMap = Object.fromEntries((data.users || []).map(user => [user.id, targetUserId || maps.users.get(user.id) || user.id]));
  const todoCount = (data.tasks || []).filter(task => (
    !task.is_fixed && (!task.date || (!task.start_time && !task.end_time))
  )).length;
  return { stats, user_id_map: userIdMap, todo_count: todoCount };
}

module.exports = { TABLES, USER_TABLES, createBackup, importBackup };
