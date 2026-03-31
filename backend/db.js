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
try { db.prepare('ALTER TABLE publications ADD COLUMN objective_id TEXT').run(); } catch (_) {}
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

// Reading list table (created via initSchema, no migration needed — new table)


function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL
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
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      objective_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT,
      percentage_completed REAL DEFAULT 0,
      status TEXT DEFAULT 'not_started',
      weight INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category_id TEXT,
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
      notes TEXT,
      label TEXT,
      percentage_completed REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS work_blocks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      start_time TEXT,
      end_time TEXT,
      category_id TEXT,
      weekday INTEGER
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
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS publications (
      id TEXT PRIMARY KEY,
      date TEXT,
      type TEXT,
      title TEXT,
      category_id TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_date TEXT,
      category_id TEXT,
      status TEXT DEFAULT 'not_started',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS repos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_date TEXT,
      category_id TEXT,
      status TEXT DEFAULT 'not_started',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS prs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      category_id TEXT,
      objective_id TEXT,
      status TEXT DEFAULT 'not_started',
      notes TEXT
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
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { db, initSchema };
