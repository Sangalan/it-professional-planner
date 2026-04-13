# IT Professional Planner — Claude Guide

Full-stack personal career planner (React + Vite frontend, Express + SQLite backend). UI is in Spanish; code and docs are in English. Single-user, local-only, no auth.

---

## Session Start Protocol

**MANDATORY** — load these 4 files at the start of every session (~800 tokens):

```
✓ CLAUDE.md                          (this file)
✓ .claude/COMMON_MISTAKES.md         ⚠️ CRITICAL — read before any code change
✓ .claude/QUICK_START.md             commands + workflows
✓ .claude/ARCHITECTURE_MAP.md        where everything lives
```

**Then load task-specific docs as needed** (~500–1500 tokens):
- See `docs/INDEX.md` for navigation by task type

**⚠️ NEVER auto-load:**
- `.claude/completions/**` — load only when user asks for a completion report
- `.claude/sessions/**`    — load only when user asks for session history
- `docs/archive/**`        — load only when user asks for historical context

---

## Quick Start

```bash
npm run dev          # Start both backend (port 3002) and frontend (port 5173)
cd backend && node server.js   # Backend only
cd frontend && npm run dev     # Frontend only
cd frontend && npm run build   # Production build → frontend/dist/
```

---

## Architecture Quick Reference

| Layer | Tech | Entry point |
|---|---|---|
| Frontend | React 18 + Vite + React Router | `frontend/src/main.jsx` |
| Backend | Express 4 | `backend/server.js` (1600+ lines, monolithic) |
| Database | SQLite via better-sqlite3 | `backend/db.js` + `backend/data/planner.db` |
| API proxy | Vite dev server | `/api` → `http://localhost:3002` |

- **18 views** in `frontend/src/views/`
- **3 shared components** in `frontend/src/components/`
- All API calls go through `frontend/src/api.js`
- No TypeScript, no ORM, no test framework
- File uploads stored in `backend/data/uploads/`

---

## Code Style

- Plain JavaScript (no TypeScript)
- Raw SQL via better-sqlite3 prepared statements
- Functional React components with hooks
- No CSS framework — global styles in `frontend/src/index.css`
- UI labels in Spanish; variable/function names in English
- Status strings: `"pending"`, `"in_progress"`, `"completed"`, `"blocked"`

---

## Testing Methodology

**No automated tests exist.** All verification is manual:
1. Run `npm run dev`
2. Open `http://localhost:5173`
3. Verify the affected view and related views
4. Check browser console for errors
5. Check terminal for backend errors

See `docs/learnings/testing-patterns.md` for manual testing checklists.

---

## Architecture Notes

- `backend/server.js` is intentionally monolithic — do not split unless explicitly asked
- `category_ids` is stored as JSON string in DB for multi-category support
- Fixed/recurring tasks use `is_fixed` + `fixed_days` (JSON array of weekday numbers)
- Progress can be `task_based` (auto-calculated) or manual percentage
- Content items (publications, certs, repos, PRs, events) function as milestones

---

## Documentation Navigation

| Need | File |
|---|---|
| Commands & workflows | `.claude/QUICK_START.md` |
| File locations | `.claude/ARCHITECTURE_MAP.md` |
| Mistakes to avoid | `.claude/COMMON_MISTAKES.md` |
| DB patterns & raw SQL | `docs/learnings/database-patterns.md` |
| API design patterns | `docs/learnings/api-design.md` |
| Frontend React patterns | `docs/learnings/frontend-patterns.md` |
| Anti-patterns | `docs/learnings/common-pitfalls.md` |
| Full navigation | `docs/INDEX.md` |
| Maintenance guide | `.claude/DOCUMENTATION_MAINTENANCE.md` |
