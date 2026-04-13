# Database Patterns

Tech: SQLite via better-sqlite3. No ORM. WAL mode enabled.

---

## Connection Setup

The DB is initialized once in `backend/db.js` and exported as a singleton:

```js
const Database = require('better-sqlite3');
const db = new Database('./data/planner.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
module.exports = { db };
```

**Never open a second connection.** Always `require('./db')` to get `db`.

---

## Query Patterns

```js
// Read multiple rows
const rows = db.prepare('SELECT * FROM tasks WHERE date = ?').all(date);

// Read single row
const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

// Insert
const result = db.prepare(
  'INSERT INTO tasks (title, date, status) VALUES (?, ?, ?)'
).run(title, date, 'pending');
const newId = result.lastInsertRowid;

// Update
db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);

// Delete
db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

// Transaction
const insertMany = db.transaction((items) => {
  for (const item of items) {
    db.prepare('INSERT INTO things (name) VALUES (?)').run(item.name);
  }
});
insertMany(myArray);
```

---

## JSON Column Handling

Several columns store JSON arrays as TEXT. Always serialize/deserialize:

```js
// Write (always stringify)
db.prepare('UPDATE tasks SET category_ids = ? WHERE id = ?')
  .run(JSON.stringify([1, 2, 3]), id);

// Read (always parse with fallback)
const ids = JSON.parse(row.category_ids || '[]');
```

**Columns that are JSON TEXT:**
- `tasks.category_ids` — array of category IDs
- `tasks.fixed_days` — array of weekday numbers (0–6)
- `objectives.category_ids`
- `milestones.category_ids`
- `publications.category_ids`
- `certifications.category_ids`
- `repos.category_ids`
- `prs.category_ids`
- `events.category_ids`
- `reading_list.urls` — array of URL strings

---

## Schema Migrations

Migrations live in `backend/db.js` inside the `initDB()` function. Pattern:

```js
// Add column only if it doesn't exist
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN new_col TEXT').run();
} catch (e) {
  // Column already exists — ignore
}

// Create new table
db.prepare(`
  CREATE TABLE IF NOT EXISTS new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )
`).run();
```

After adding a migration, restart the backend — `initDB()` runs on startup.

---

## Fixed/Recurring Tasks

Fixed tasks are not stored per-date — they're expanded at query time:

```sql
-- Store once
INSERT INTO tasks (title, is_fixed, fixed_days, fixed_start_date, fixed_end_date)
VALUES ('Daily standup', 1, '[1,2,3,4,5]', '2026-04-01', '2026-06-30');

-- Then in GET /api/tasks, backend JS filters fixed tasks where:
-- 1. is_fixed = 1
-- 2. JSON.parse(fixed_days).includes(dayOfWeek(requestedDate))
-- 3. requestedDate >= fixed_start_date (if set)
-- 4. requestedDate <= fixed_end_date (if set)
```

When adding new task query endpoints, replicate this expansion logic.

---

## Progress Calculation

Objectives with `progress_mode = 'task_based'` auto-calculate percentage:

```sql
-- Count completed vs total linked tasks
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as done
FROM tasks
WHERE objective_id = ?;
-- percentage = (done / total) * 100
```

Update `objectives.percentage_completed` after any task status change when `progress_mode = 'task_based'`.

---

## Useful Diagnostic Queries

```sql
-- Task distribution by status
SELECT status, COUNT(*) FROM tasks GROUP BY status;

-- Objectives with progress
SELECT title, progress_mode, percentage_completed FROM objectives;

-- Tasks linked to a specific objective
SELECT t.title, t.status FROM tasks t WHERE t.objective_id = 3;

-- Categories and their colors
SELECT * FROM categories ORDER BY name;

-- Fixed tasks
SELECT title, fixed_days, fixed_start_date, fixed_end_date
FROM tasks WHERE is_fixed = 1;
```
