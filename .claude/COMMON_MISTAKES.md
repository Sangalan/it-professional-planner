# Common Mistakes — IT Professional Planner

⚠️ Load this file at the start of every session. These are real gotchas for this codebase.

---

## 1. Mutating `category_ids` Without JSON Serialization

**Wrong:**
```js
task.category_ids = [1, 2, 3];         // stores object reference
db.prepare('UPDATE tasks SET category_ids = ?').run(task.category_ids);
```

**Right:**
```js
db.prepare('UPDATE tasks SET category_ids = ?').run(JSON.stringify([1, 2, 3]));
```

The `category_ids` column is TEXT storing a JSON array. Always `JSON.stringify()` on write and `JSON.parse()` on read. Check `db.js` to see how existing endpoints handle it.

---

## 2. Forgetting WAL Mode Pragma on Reads

The database is opened once in `backend/db.js`. Do not open a second SQLite connection anywhere — it will conflict with WAL mode and risk data corruption. Always use the exported `db` instance.

**Wrong:**
```js
const db2 = new Database('backend/data/planner.db'); // second connection
```

**Right:**
```js
const { db } = require('./db'); // use the shared instance
```

---

## 3. Fixed Tasks Showing on Wrong Days

Fixed/recurring tasks have:
- `is_fixed = 1`
- `fixed_days` = JSON array of weekday numbers (0=Sun, 1=Mon, … 6=Sat)
- Optional `fixed_start_date` / `fixed_end_date`

When querying tasks for a specific date, the backend dynamically expands fixed tasks. If you add a new endpoint that returns tasks, you must replicate this expansion logic — see the `/api/tasks` GET handler in `server.js`.

**Wrong:** `SELECT * FROM tasks WHERE date = ?` — misses fixed tasks
**Right:** Include fixed task expansion (check `is_fixed` + `fixed_days` JSON)

---

## 4. Progress Mode Confusion (`task_based` vs manual)

Objectives have `progress_mode`:
- `"task_based"` — percentage is auto-calculated from linked tasks; **do not manually update `percentage_completed`**
- `"manual"` — percentage is set directly by the user

Before writing to `objectives.percentage_completed`, check `progress_mode`. If it's `task_based`, recalculate from tasks instead.

---

## 5. Vite Proxy Only Works in Dev Mode

The Vite dev server proxies `/api` → `http://localhost:3002`. In production (`npm run build`), the built `frontend/dist/` is served statically and **there is no proxy**. If you add a new API endpoint, make sure the Express server also serves the built frontend as a fallback (check the static file serving at the bottom of `server.js`).

**Dev:** `http://localhost:5173` → proxy → `:3002`
**Prod:** Express at `:3002` serves both API + static `frontend/dist/`

---

## 6. Status Strings Are Not Validated

Status values are plain strings. There is no enum or validation layer. The accepted values per entity type are:

| Entity | Valid statuses |
|---|---|
| tasks | `pending`, `in_progress`, `completed`, `blocked` |
| objectives | `pending`, `in_progress`, `completed` |
| milestones | `pending`, `in_progress`, `completed` |
| publications | `idea`, `draft`, `published` |
| certifications | `not_started`, `in_progress`, `completed` |
| events | `considering`, `registered`, `attended`, `cancelled` |

Using any other string will silently save but break UI filters and status badges.

---

## 7. Reading List Reorder Uses Array of IDs, Not Position Numbers

`POST /api/reading-list/reorder` expects `{ ids: [3, 1, 5, 2] }` — an ordered array of all IDs. It uses `CASE WHEN` SQL to set the `order` column. Do not send positions/indices.

---

## 8. `api.js` Fetch Wrapper Throws on Non-OK Responses

`frontend/src/api.js` has a fetch wrapper that throws an error if `response.ok` is false. All API calls in views use this wrapper. If you add a new endpoint, ensure the backend returns proper HTTP status codes (400 for bad input, 404 for not found, 500 for server errors) — otherwise the UI will throw silently.

---

## 9. No Test Runner — Manual Verification Required

There are zero automated tests. Every change must be manually verified:
1. `npm run dev` from root
2. Check the affected view at `http://localhost:5173`
3. Check browser console + terminal for errors
