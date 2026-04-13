# Repository Guidelines

## Project Overview
- Full-stack local planner for an IT professional career plan.
- Frontend is React 18 + Vite 5.
- Backend is Node.js + Express 4 with SQLite via `better-sqlite3`.
- UI copy is in Spanish. Code, comments, and documentation should stay in English unless a user-facing string is being edited.

## Structure
- `frontend/`: React application.
- `frontend/src/views/`: route-level screens.
- `frontend/src/components/`: shared UI pieces.
- `frontend/src/utils/`: frontend helpers.
- `backend/server.js`: main API server; most backend routes live here.
- `backend/db.js`: schema creation and lightweight migrations.
- `backend/data/`: runtime SQLite database and uploads.
- `docs/archive/`: historical notes; do not treat as the source of truth unless explicitly asked.

## Commands
- Install all dependencies: `npm run install:all`
- Start both apps: `npm run dev`
- Start backend only: `npm run dev --prefix backend`
- Start frontend only: `npm run dev --prefix frontend`
- Build frontend: `npm run build --prefix frontend`
- Seed backend data: `npm run seed`

## Runtime Defaults
- Frontend dev server: `http://localhost:5173`
- Backend API server: `http://localhost:3002`
- SQLite database: `backend/data/planner.db`

## Working Rules
- Keep changes focused and minimal; do not refactor unrelated areas.
- Prefer following existing patterns over introducing new abstractions.
- Do not edit generated or dependency-managed content such as `node_modules/`, `frontend/dist/`, or `package-lock.json` unless the task explicitly requires it.
- Treat `backend/server.js` as a consolidated server file; if adding backend behavior, keep route helpers simple and colocated unless there is a clear existing module for the concern.
- Treat `backend/db.js` migrations as additive and tolerant of existing databases.
- Preserve Spanish UX terminology and labels when touching frontend screens.

## Validation
- There is no obvious root test suite configured.
- For frontend changes, prefer validating with `npm run build --prefix frontend` when appropriate.
- For backend changes, validate by starting the backend or full dev stack if the task requires runtime verification.
- Do not add new tooling such as linters or formatters unless explicitly requested.

## Notes For Agents
- Read files in small chunks when they are large, especially `README.md`, `backend/server.js`, and `backend/db.js`.
- Check for more specific `AGENTS.md` files before editing files in subdirectories.
- If a task touches user-facing text, confirm whether the change belongs in Spanish UI copy or English documentation/code comments.
