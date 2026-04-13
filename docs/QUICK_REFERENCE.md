# Quick Reference

Fast lookups without loading full docs.

---

## Session Start Checklist

- [ ] Load `CLAUDE.md`
- [ ] Load `.claude/COMMON_MISTAKES.md` ⚠️
- [ ] Load `.claude/QUICK_START.md`
- [ ] Load `.claude/ARCHITECTURE_MAP.md`
- [ ] Load task-specific doc from `docs/INDEX.md`

---

## Commands Cheat Sheet

```bash
npm run dev                          # Dev mode (both services)
cd backend && node server.js         # Backend only (port 3002)
cd frontend && npm run dev           # Frontend only (port 5173)
cd frontend && npm run build         # Production build
sqlite3 backend/data/planner.db      # DB REPL
```

---

## Key File Locations

| What | Where |
|---|---|
| All API routes | `backend/server.js` |
| DB schema + migrations | `backend/db.js` |
| All fetch calls | `frontend/src/api.js` |
| All routes defined | `frontend/src/App.jsx` |
| Global styles | `frontend/src/index.css` |
| Gap detection logic | `frontend/src/utils/dateUtils.js` |
| Category colors/labels | `frontend/src/utils/categoryUtils.js` |
| Category context provider | `frontend/src/components/CatBadge.jsx` |
| Task create/edit form | `frontend/src/components/TaskModal.jsx` |

---

## Status Strings (Must Use Exactly)

| Entity | Statuses |
|---|---|
| tasks | `pending` `in_progress` `completed` `blocked` |
| objectives | `pending` `in_progress` `completed` |
| publications | `idea` `draft` `published` |
| certifications | `not_started` `in_progress` `completed` |
| events | `considering` `registered` `attended` `cancelled` |

---

## JSON Column Pattern

```js
// Write
db.prepare('UPDATE tasks SET category_ids = ?').run(JSON.stringify([1, 2]));

// Read
const ids = JSON.parse(task.category_ids || '[]');
```

Applies to: `category_ids`, `fixed_days`, `reading_list.urls`

---

## Adding a New API Endpoint

```js
// In backend/server.js, add near related routes:
app.get('/api/thing', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM thing').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Then add to `frontend/src/api.js`:
```js
export const getThing = () => apiFetch('/api/thing');
```

---

## Adding a New View

```jsx
// 1. Create frontend/src/views/ThingView.jsx
// 2. In App.jsx, add:
import ThingView from './views/ThingView';
// Inside <Routes>:
<Route path="/thing" element={<ThingView />} />
// 3. Add nav link in sidebar section of App.jsx
```

---

## Debugging Tips

1. Check browser console (F12) for JS errors
2. Check terminal running `npm run dev` for backend errors
3. Use `curl http://localhost:3002/api/endpoint` to test API in isolation
4. Check `COMMON_MISTAKES.md` — most bugs are listed there
5. Verify JSON columns are stringified before DB write
6. Check port 3002 is running: `curl http://localhost:3002/api/categories`
