const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'planner.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migrations
try { db.prepare('ALTER TABLE tasks ADD COLUMN category_ids TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE objectives ADD COLUMN color TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE certifications ADD COLUMN objective_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE certifications ADD COLUMN category_ids TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE certifications ADD COLUMN percentage_completed REAL DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE repos ADD COLUMN objective_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE repos ADD COLUMN category_ids TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE repos ADD COLUMN url TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE repos ADD COLUMN type TEXT DEFAULT \'personal\'').run(); } catch (_) {}
try { db.prepare('UPDATE repos SET type = \'personal\' WHERE type IS NULL OR TRIM(type) = \'\'').run(); } catch (_) {}
try { db.prepare('ALTER TABLE publications ADD COLUMN objective_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE publications ADD COLUMN publication_text TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE prs ADD COLUMN category_ids TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE prs ADD COLUMN percentage_completed REAL DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE publications ADD COLUMN category_ids TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN status TEXT DEFAULT "not_started"').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN objective_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN category_ids TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN percentage_completed REAL DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN registered INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN hotel_booked INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN flight_booked INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN fixed_days TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN fixed_start_date TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN fixed_end_date TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN label TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN is_cloned INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN cloned_from TEXT').run(); } catch (_) {}
// Reset legacy is_fixed tasks that predate the recurrence system
try { db.prepare('UPDATE tasks SET is_fixed = 0 WHERE is_fixed = 1 AND fixed_days IS NULL').run(); } catch (_) {}
try { db.prepare("UPDATE tasks SET status = 'pending', percentage_completed = 0 WHERE is_fixed = 1 AND status = 'completed'").run(); } catch (_) {}
// Client objectives support
try { db.prepare('ALTER TABLE objectives ADD COLUMN type TEXT DEFAULT \'objective\'').run(); } catch (_) {}
try { db.prepare('UPDATE objectives SET type = \'objective\' WHERE type IS NULL').run(); } catch (_) {}
try { db.prepare('ALTER TABLE milestones ADD COLUMN billed_amount REAL DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE objectives ADD COLUMN category_ids TEXT').run(); } catch (_) {}

try { db.prepare('ALTER TABLE documents ADD COLUMN category_ids TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE categories ADD COLUMN text_color TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE categories ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE objectives ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE milestones ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN todo_order INTEGER').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN todo_day_order INTEGER').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN todo_order_date TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN is_money_maker INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE objectives ADD COLUMN todo_order INTEGER').run(); } catch (_) {}
try { db.prepare('ALTER TABLE work_blocks ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE events ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE publications ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE certifications ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE repos ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE prs ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE documents ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE reading_list ADD COLUMN user_id TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE users ADD COLUMN content_sections TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE users ADD COLUMN auth_email TEXT').run(); } catch (_) {}

// Documents uploads directory
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Reading list table (created via initSchema, no migration needed — new table)


function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      content_sections TEXT,
      auth_email TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      text_color TEXT,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category_id TEXT,
      start_date TEXT,
      end_date TEXT,
      target_value TEXT,
      progress_mode TEXT DEFAULT 'task_based',
      percentage_completed REAL DEFAULT 0,
      status TEXT DEFAULT 'not_started',
      priority INTEGER DEFAULT 2,
      notes TEXT,
      color TEXT,
      type TEXT DEFAULT 'objective',
      category_ids TEXT,
      user_id TEXT,
      todo_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      objective_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT,
      percentage_completed REAL DEFAULT 0,
      status TEXT DEFAULT 'not_started',
      weight INTEGER DEFAULT 10,
      billed_amount REAL DEFAULT 0,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category_id TEXT,
      category_ids TEXT,
      subcategory TEXT,
      date TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_estimated INTEGER,
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 2,
      objective_id TEXT,
      milestone_id TEXT,
      is_fixed INTEGER DEFAULT 0,
      is_money_maker INTEGER DEFAULT 0,
      fixed_days TEXT,
      fixed_start_date TEXT,
      fixed_end_date TEXT,
      notes TEXT,
      label TEXT,
      is_cloned INTEGER DEFAULT 0,
      cloned_from TEXT,
      percentage_completed REAL DEFAULT 0,
      user_id TEXT,
      todo_order INTEGER,
      todo_day_order INTEGER,
      todo_order_date TEXT
    );

    CREATE TABLE IF NOT EXISTS work_blocks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      start_time TEXT,
      end_time TEXT,
      category_id TEXT,
      weekday INTEGER,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      location TEXT,
      format TEXT,
      estimated_cost REAL DEFAULT 0,
      category_id TEXT,
      notes TEXT,
      status TEXT DEFAULT 'not_started',
      objective_id TEXT,
      category_ids TEXT,
      percentage_completed REAL DEFAULT 0,
      registered INTEGER DEFAULT 0,
      hotel_booked INTEGER DEFAULT 0,
      flight_booked INTEGER DEFAULT 0,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS publications (
      id TEXT PRIMARY KEY,
      date TEXT,
      type TEXT,
      title TEXT,
      category_id TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      publication_text TEXT,
      objective_id TEXT,
      category_ids TEXT,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_date TEXT,
      category_id TEXT,
      status TEXT DEFAULT 'not_started',
      notes TEXT,
      objective_id TEXT,
      category_ids TEXT,
      percentage_completed REAL DEFAULT 0,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS repos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_date TEXT,
      category_id TEXT,
      type TEXT DEFAULT 'personal',
      status TEXT DEFAULT 'not_started',
      notes TEXT,
      objective_id TEXT,
      category_ids TEXT,
      url TEXT,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS prs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      category_id TEXT,
      objective_id TEXT,
      status TEXT DEFAULT 'not_started',
      notes TEXT,
      category_ids TEXT,
      percentage_completed REAL DEFAULT 0,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      category_ids TEXT,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS reading_list (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      urls TEXT,
      category_ids TEXT,
      category_id TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      sort_order REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS deadlines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#dc2626',
      user_id TEXT
    );
  `);

  const timingColumns = db.prepare('PRAGMA table_info(tasks)').all().map(column => column.name);
  for (const [name, definition] of Object.entries({
    actual_seconds: 'REAL NOT NULL DEFAULT 0',
    timer_started_at: 'TEXT',
    original_estimate_minutes: 'REAL',
    completed_at: 'TEXT',
  })) {
    if (!timingColumns.includes(name)) db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${definition}`);
  }

  const defaultSections = JSON.stringify({
    clients: true,
    publications: true,
    certifications: true,
    repos: true,
    prs: true,
    events: true,
    reading_list: true,
    documents: true,
  });
  db.prepare('INSERT OR IGNORE INTO users (id, name, color, content_sections) VALUES (?, ?, ?, ?)').run('pepito', 'Pepito', '#2563eb', defaultSections);
  db.prepare('UPDATE users SET content_sections = ? WHERE content_sections IS NULL OR TRIM(content_sections) = \'\'').run(defaultSections);

  const scopedTables = [
    'categories', 'objectives', 'milestones', 'tasks', 'work_blocks',
    'events', 'publications', 'certifications', 'repos', 'prs', 'documents', 'reading_list', 'deadlines',
  ];
  for (const table of scopedTables) {
    try {
      db.prepare(`UPDATE ${table} SET user_id = 'pepito' WHERE user_id IS NULL OR TRIM(user_id) = ''`).run();
    } catch (_) {}
  }
}

module.exports = { db, initSchema };
