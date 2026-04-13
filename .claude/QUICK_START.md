# Quick Start — IT Professional Planner

## Development Commands

```bash
# Root — starts backend (port 3002) AND frontend (port 5173) concurrently
npm run dev

# Backend only
cd backend && node server.js

# Frontend only
cd frontend && npm run dev

# Production build (output → frontend/dist/)
cd frontend && npm run build

# Install all dependencies (root + backend + frontend)
npm install && cd backend && npm install && cd ../frontend && npm install
```

## Database Commands

```bash
# Open SQLite REPL
sqlite3 backend/data/planner.db

# Common SQLite queries
.tables                              -- list all tables
.schema tasks                        -- show tasks table schema
SELECT * FROM tasks LIMIT 5;         -- quick inspection
SELECT * FROM categories;            -- see categories
PRAGMA table_info(objectives);       -- column details
.quit                                -- exit

# Backup database
cp backend/data/planner.db backend/data/planner.db.backup

# Check WAL mode
PRAGMA journal_mode;                 -- should return "wal"
```

## API Testing (curl)

```bash
# Health check — list categories
curl http://localhost:3002/api/categories

# Today's tasks
curl http://localhost:3002/api/tasks/today

# Dashboard data
curl http://localhost:3002/api/dashboard

# Create a task
curl -X POST http://localhost:3002/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","date":"2026-04-13","category_id":1}'

# Export all data
curl http://localhost:3002/api/export > backup.json
```

## Common Workflows

### Adding a New API Endpoint
1. Add route handler in `backend/server.js` (grouped with related endpoints)
2. Add corresponding fetch call in `frontend/src/api.js`
3. Use in view component via `useEffect` + `useState`
4. Test: `npm run dev` → verify in browser + terminal

### Adding a New View
1. Create `frontend/src/views/NewView.jsx`
2. Add route in `frontend/src/App.jsx`
3. Add nav link in the sidebar/nav (also in `App.jsx`)
4. Test navigation and data loading

### Database Schema Change
1. Add migration in `backend/db.js` (in the `initDB()` function using `ALTER TABLE` or `CREATE TABLE IF NOT EXISTS`)
2. Restart backend: `Ctrl+C` then `node server.js`
3. Verify with `sqlite3 backend/data/planner.db .schema`

### Modifying Styles
- Global styles: `frontend/src/index.css`
- No CSS framework — plain CSS only
- Component-level styles go in the same `.css` file or inline for one-offs

## Frontend URL Reference

| URL | View |
|---|---|
| `/` | Dashboard |
| `/daily` | Daily task list |
| `/weekly` | Weekly time-grid calendar |
| `/monthly` | Monthly calendar |
| `/now` | Live countdown timer |
| `/objectives` | Goals + milestones |
| `/publications` | Content tracker |
| `/certifications` | Cert tracker |
| `/repos` | GitHub repos |
| `/prs` | PR tracker |
| `/events` | Events tracker |
| `/reading-list` | Reading list |
| `/reports` | Charts + analytics |
| `/search` | Full-text search |
| `/settings` | Core data management |
| `/import-export` | JSON backup/restore |
| `/documents` | Document uploads |
| `/clients` | Client management |
