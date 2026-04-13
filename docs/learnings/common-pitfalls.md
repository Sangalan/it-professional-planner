# Common Pitfalls

Anti-patterns found in this codebase. Distinct from `COMMON_MISTAKES.md` (which covers bugs) — these are design-level traps.

---

## 1. Splitting `server.js`

The backend is intentionally a single 1600+ line file. Do not refactor into separate route files unless explicitly asked. The monolithic structure makes it easy to search and understand all API logic in one place.

---

## 2. Using ORM-Style Code With better-sqlite3

better-sqlite3 is synchronous — do not use async/await with it:

```js
// Wrong — better-sqlite3 is NOT async
const rows = await db.prepare('SELECT * FROM tasks').all();

// Right — synchronous
const rows = db.prepare('SELECT * FROM tasks').all();
```

The only async code in the backend is Express middleware and file I/O.

---

## 3. Hardcoding Dates in Queries

The planner was built for Q2 2026 (April–June) but should work for any date. Avoid hardcoding date ranges — use query parameters or `new Date()`.

```js
// Wrong
const tasks = db.prepare("SELECT * FROM tasks WHERE date >= '2026-04-01'").all();

// Right
const tasks = db.prepare('SELECT * FROM tasks WHERE date >= ?').all(startDate);
```

---

## 4. Rendering Category IDs as Numbers

`category_id` is a foreign key (integer), but `category_ids` is a JSON string. Never render either directly — always resolve to the category name/color via the categories list.

```jsx
// Wrong
<span>{task.category_id}</span>

// Right
<CatBadge categoryId={task.category_id} />
// or
const cat = categories.find(c => c.id === task.category_id);
<span style={{ color: cat?.color }}>{cat?.name}</span>
```

---

## 5. Forgetting the `key` Prop in Lists

React requires unique `key` props for list items. Always use the database `id`:

```jsx
// Wrong
{tasks.map(t => <TaskCard task={t} />)}

// Right
{tasks.map(t => <TaskCard key={t.id} task={t} />)}
```

---

## 6. Direct State Mutation

React state must be treated as immutable:

```jsx
// Wrong
tasks.push(newTask);
setTasks(tasks);

// Right
setTasks(prev => [...prev, newTask]);
```

---

## 7. Missing `try/catch` Around API Calls

`apiFetch` in `api.js` throws on non-OK responses. Views must handle errors:

```jsx
// Risky
const data = await getThings();
setThings(data);

// Safer
try {
  const data = await getThings();
  setThings(data);
} catch (err) {
  console.error('Failed to load things:', err);
  // optionally set an error state
}
```

---

## 8. Confusing Content Items With Tasks

Publications, certifications, repos, PRs, and events are NOT tasks — they are milestone-like items. Tasks can *link to* them via `milestone_id`, but they live in separate tables with different schemas.

Content items appear in `ObjectivesView.jsx` alongside milestones. Tasks linked to a content item show up nested under it.

---

## 9. Work Blocks Are Read-Only in UI

`work_blocks` records (recurring time blocks like "Deep Work 09:00-13:00") are currently only editable via SQL or seed scripts. There is no UI for CRUD. Don't try to add CRUD UI for work blocks without checking if this is intended.

---

## 10. Reading List Reorder Sends Full ID Array

`POST /api/reading-list/reorder` does NOT take `{ id, position }` pairs. It takes a complete ordered array of all IDs: `{ ids: [3, 1, 5, 2] }`. The backend uses SQL `CASE WHEN` to update all `order` values atomically.
