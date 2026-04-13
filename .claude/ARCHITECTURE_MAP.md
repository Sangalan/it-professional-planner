# Architecture Map — IT Professional Planner

## Top-Level Structure

```
it-professional-planner/
├── CLAUDE.md                    Main guide (load every session)
├── .claude/                     Claude-specific docs
├── .claudeignore                Controls what Claude auto-loads
├── docs/                        Detailed documentation
├── README.md                    User-facing project guide (299 lines)
├── ASSUMPTIONS.md               Data generation rules (78 lines)
├── package.json                 Root: runs concurrently (dev only)
├── backend/                     Express + SQLite API
└── frontend/                    React + Vite SPA
```

## Backend

```
backend/
├── server.js          ⭐ ALL Express routes (monolithic by design)
├── db.js              Schema definitions + migrations + DB initialization
├── package.json       Dependencies: express, better-sqlite3, cors, multer
└── data/
    ├── planner.db     SQLite database (WAL mode)
    └── uploads/       File storage (timestamped filenames)
```

**Key patterns in `server.js`:**
- Route groups by entity (categories, tasks, objectives, milestones, etc.)
- Each group follows: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`
- Fixed task expansion logic in `GET /api/tasks`
- `GET /api/dashboard` — heavy aggregation query
- `POST /api/import` — conflict resolution with ID suffixing
- Static file serving at the bottom (for production build)

## Frontend

```
frontend/src/
├── main.jsx              React entry point
├── App.jsx               Router + sidebar layout + all route definitions
├── api.js                ⭐ Fetch wrapper for all API calls
├── index.css             Global styles (16KB, no CSS framework)
├── components/
│   ├── CatBadge.jsx      Category badge + CategoryContext provider
│   ├── TaskModal.jsx     Create/edit task form (shared across views)
│   └── GapPickerDialog.jsx  Gap slot → milestone picker dialog
├── views/                18 page components (one per route)
└── utils/
    ├── dateUtils.js      Date helpers + gap detection algorithm
    └── categoryUtils.js  Color maps + Spanish status label maps
```

## Database Tables

| Table | Purpose | Key columns |
|---|---|---|
| `categories` | Color-coded tags | `id`, `name`, `color` |
| `tasks` | Day-to-day work items | `date`, `start_time`, `end_time`, `status`, `is_fixed`, `objective_id`, `milestone_id` |
| `objectives` | High-level goals | `progress_mode`, `percentage_completed`, `status`, `priority` |
| `milestones` | Sub-goals of objectives | `objective_id`, `weight`, `percentage_completed`, `status` |
| `publications` | Content items | `date`, `type`, `status`, `category_id` |
| `certifications` | Cert tracker | `target_date`, `status`, `category_id` |
| `repos` | Repository tracker | `title`, `target_date`, `status`, `category_id` |
| `prs` | Pull requests | `start_date`, `end_date`, `objective_id`, `status` |
| `events` | Events/conferences | `start_date`, `end_date`, `location`, `format`, `estimated_cost` |
| `reading_list` | Books/articles | `urls` (JSON array), `sort_order` |
| `work_blocks` | Recurring time blocks | `weekday`, `start_time`, `end_time`, `type` |
| `documents` | Uploaded files metadata | `name`, `filename`, `mime_type`, `size`, `created_at` |

**JSON columns** (always `JSON.stringify`/`JSON.parse`):
- `reading_list.urls`

## Where to Find Features

| Feature | Backend | Frontend |
|---|---|---|
| Gap detection | N/A | `utils/dateUtils.js` → `findGaps()` |
| Fixed task expansion | `server.js` → `GET /api/tasks` handler | `views/WeeklyCalendar.jsx` |
| Live timer | N/A | `views/NowView.jsx` (Web Audio API) |
| Dashboard aggregation | `server.js` → `GET /api/dashboard` | `views/Dashboard.jsx` |
| Multi-category rendering | N/A | `components/CatBadge.jsx` |
| File upload | `server.js` + multer middleware | `views/DocumentsView.jsx` |
| Import/export | `server.js` → `/api/export` + `/api/import` | `views/ImportExport.jsx` |
| Progress recalculation | `server.js` → task PUT handler | `views/ObjectivesView.jsx` |
| Drag-to-reorder | `server.js` → `/api/reading-list/reorder` | `views/ReadingListView.jsx` |

## API Proxy Configuration

`frontend/vite.config.js` proxies `/api` → `http://localhost:3002` in dev mode only.
In production, Express at port 3002 serves both API and `frontend/dist/` static files.

## Ports

| Service | Port | URL |
|---|---|---|
| Backend (Express) | 3002 | `http://localhost:3002` |
| Frontend (Vite dev) | 5173 | `http://localhost:5173` |
