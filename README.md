# IT Professional Planner — Master Plan

A full-stack local planner for tracking a LinkedIn career positioning plan (April–June 2026). The UI is in Spanish; code comments and this README are in English.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite 5 | React Router 6, no CSS framework |
| Backend | Node.js + Express 4 | Single-file API server |
| Database | SQLite (better-sqlite3) | WAL mode, single file, zero config |
| Charts | Recharts 2 | Integrated with React |
| Dates | date-fns 3 | Tree-shakeable, locale `es` |
| Audio | Web Audio API | No external files needed |
| Dev runner | concurrently | One command starts everything |

No Docker, no cloud services, everything runs locally.

---

## Installation

### Requirements
- Node.js 18+ (`node --version`)
- npm 9+

### 1. Install dependencies

```bash
cd linkedin-planner
npm run install:all
```

This installs dependencies for the root workspace, the backend, and the frontend.

### 2. Start

```bash
npm run dev
```

This starts concurrently:
- **API** at `http://localhost:3002`
- **UI**  at `http://localhost:5173`

Open `http://localhost:5173` in your browser.

> The SQLite database is created automatically at `backend/data/planner.db` and pre-loaded with all plan data on the first run.

---

## Project Structure

```
linkedin-planner/
├── package.json              ← root runner (concurrently)
├── backend/
│   ├── server.js             ← Express API (port 3002)
│   ├── db.js                 ← SQLite schema + migrations
│   └── data/
│       └── planner.db        ← auto-generated
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx               ← routes and shell layout
        ├── api.js                ← HTTP client (fetch wrapper)
        ├── components/
        │   ├── CatBadge.jsx      ← category badge + context provider
        │   ├── GapPickerDialog.jsx ← gap-slot + milestone picker dialog
        │   └── TaskModal.jsx     ← create/edit task form dialog
        ├── views/
        │   ├── Dashboard.jsx         ← overview dashboard
        │   ├── NowView.jsx           ← live countdown timer
        │   ├── DailyList.jsx         ← daily task list
        │   ├── WeeklyCalendar.jsx    ← weekly time-grid calendar
        │   ├── MonthlyCalendar.jsx   ← monthly calendar grid
        │   ├── ObjectivesView.jsx    ← objectives and milestones
        │   ├── PublicationsView.jsx  ← content publications
        │   ├── CertificationsView.jsx ← certifications tracker
        │   ├── ReposView.jsx         ← GitHub repositories
        │   ├── PRsView.jsx           ← pull requests tracker
        │   ├── EventsView.jsx        ← events tracker
        │   ├── ReadingListView.jsx   ← drag-to-reorder reading list
        │   ├── Reports.jsx           ← charts and progress reports
        │   ├── Search.jsx            ← full-text task search
        │   ├── Settings.jsx          ← manage categories, objectives, milestones
        │   └── ImportExport.jsx      ← JSON import/export
        └── utils/
            ├── dateUtils.js          ← date helpers, gap detection
            └── categoryUtils.js      ← category colors and status labels
```

---

## Views / Pages

### Dashboard (`/`)
Overview panel with:
- **Global progress** — overall task completion percentage
- **Today's tasks** — list of tasks scheduled for today
- **Upcoming milestones** — next 5 milestones with days remaining
- **Overdue tasks** — tasks past their date that are not completed
- **Upcoming events** — events in the next 7 days
- **Progress by objective** — progress bar per objective
- **Weekly load chart** — bar chart of planned vs. completed tasks over 4 weeks
- **Category distribution** — pie chart of tasks by category

### Ahora mismo — Now (`/now`)
Live countdown timer for the current active task:
- **Second-level countdown** — updates every second, shows time remaining in the current task or time until the next one
- **Audio alert** — plays a double-beep via the Web Audio API when the current task ends (5-second warning)
- **Sound toggle** — mute/unmute the alert; a "test" button lets you preview the beep
- **Task progress bar** — shows percentage of elapsed time within the active task
- **Quick complete button** — marks the current task as done without leaving the view
- **Next task card** — shows the upcoming task and countdown until it starts
- **Free-time gap** — displays the gap in minutes between the current task end and the next task start
- The document title updates live with the countdown and percentage

### Hoy — Daily list (`/today`)
Task list for a selected day:
- Navigate between days with prev/next buttons or a date picker
- **Category filter chips** — filter tasks by category
- **Progress slider** — per-task completion percentage slider (auto-saves)
- **Overdue indicator** — tasks past their date are highlighted in red
- **Gap detection** — free 1-hour slots in the 9:00–20:00 work window are shown in a yellow banner; clicking any gap slot opens the **Gap Picker Dialog** to assign a task linked to a milestone

### Semana — Weekly calendar (`/week`)
Time-grid calendar Mon–Sun, 07:00–22:00:
- Tasks are rendered as **absolute-positioned blocks** spanning their full duration; clicking opens the edit modal
- **All-day events** appear in the column header
- **All-day tasks** (no start time) also appear in the column header
- **Work block backgrounds** — configurable blocks (e.g., "Deep Work 9–13") shade the grid in their category color
- **Current time red bar** — a 2px red line marks the current time in today's column
- **Gap indicators** — yellow dashed rows in the 9–20 work window with unscheduled slots; clicking opens the Gap Picker Dialog
- Navigate weeks with prev/next/this-week buttons

### Mes — Monthly calendar (`/month`)
Month grid view:
- Each day cell shows up to 4 task/event chips, with a "+N more" overflow indicator
- **Category filter** — filter tasks by category across the whole month
- Clicking a day cell opens a **Day Detail Modal** with the full task list, event list, task checkboxes, and a "New task" button
- **Gap indicator** — a yellow `⚠ Xh` badge in each day cell shows the number of free hours detected in the 9–20 work window; clicking opens the Gap Picker Dialog for that day

### Objetivos — Objectives (`/objectives`)
Progress cards per objective:
- Progress bar and percentage, task count, days remaining
- **Expand/collapse** — click a card to reveal milestones and linked content items
- **Milestones** — each milestone shows status, target date, weight, and days remaining; status can be changed with an inline select; expanding shows linked tasks with checkboxes
- **Linked content items** — publications, certifications, repositories, pull requests, and events linked to the objective appear as milestone-style rows with their status and linked tasks
- **Global progress bar** — animated snail indicator showing overall plan completion

### Publicaciones (`/publications`)
Content publication tracker:
- Create, edit, and delete publications with title, type (post/video/article), date, status, objective, multi-category, and notes
- Filter by category and status
- Status options: Pending, Draft, Published
- Days-remaining badge on each item

### Certificaciones (`/certifications`)
Certification tracker:
- Same CRUD pattern as publications
- **Percentage-completed slider** in the edit dialog
- Status options: Not started, In progress, Passed, Failed
- Mini progress bar shown inline in the list

### Repositorios (`/repos`)
GitHub repository tracker:
- Same CRUD pattern
- **GitHub URL field** — clickable link rendered in the list row
- Status options: Not started, In development, Published

### Pull Requests (`/prs`)
Pull request tracker:
- **Start date + end date** range defines the active window
- **Percentage-completed slider**
- Status options: Not started, In progress, In review, Merged, Closed
- Active PRs (date range includes today) are highlighted with a blue background

### Eventos (`/events`)
Event tracker:
- **Format field** — Presencial or Online; selecting Online auto-fills the location field with "Online" and makes it read-only
- **Cost field** — estimated cost in euros
- **Percentage-completed slider**
- Multi-day events are expanded across all days in the weekly calendar
- Status options: Pending, In progress, Done, Cancelled

### Para Leer — Reading list (`/reading-list`)
Drag-to-reorder reading list:
- **Drag and drop** — grab any pending item to reorder; order is persisted via the `/reading-list/reorder` API
- Items support multiple URLs; each URL is rendered as a clickable link
- Items pending for more than 7 days get a yellow background; more than 14 days get red
- Checked items move to a collapsible "Read" section

### Reportes — Reports (`/reports`)
Progress charts for Q2 2026:
- **Burnup chart** — cumulative planned vs. completed tasks by day (area chart)
- **Monthly completion** — bar chart of planned vs. done per month (April, May, June)
- **Category distribution** — pie chart of tasks by category
- **Objective progress** — horizontal stacked bar chart per objective
- **Weekly completions** — bar chart of completed tasks per week (last 8 weeks)
- **Certifications donut** — passed vs. pending
- **Publications donut** — published vs. pending
- KPI stat cards at the top: global progress, total tasks, publications, certifications, overdue count

### Búsqueda — Search (`/search`)
Full-text task search:
- **Text filter** — debounced search by task title (350ms delay)
- **Date range** — from/to filters defaulting to the Q2 range
- **Category, objective, and status filters**
- Results grouped by month, with task checkboxes and an edit modal

### Configuración — Settings (`/settings`)
Manage the core data model:
- **Categories** — create/edit/delete categories with a name, unique slug ID, and color picker (preset swatches + custom color input). The ID is permanent once created; the category cannot be deleted if it is in use.
- **Objectives** — create/edit/delete objectives with title, category, date range, priority, status, target value, notes, and progress bar color
- **Milestones** — create/edit/delete milestones with title, objective, target date, status, weight (%), and percentage completed. Milestones with assigned tasks cannot be deleted.

> Work blocks can be viewed via the weekly calendar legend but are currently read-only in the UI (editable via seed.js or direct SQL).

### Importar/Exportar (`/import-export`)
JSON backup and restore:
- **Export** — downloads a complete JSON snapshot of all tables (categories, objectives, milestones, tasks, events, publications, certifications, repos, PRs, work blocks)
- **Import** — reads a JSON file and shows a preview of record counts; prompts for a **conflict strategy**:
  - *Skip duplicates* — existing records (same ID) are left unchanged
  - *Keep both* — imported records with conflicting IDs are inserted with a new suffixed ID (`id-2`, `id-3`, …)

---

## Key Features

### Gap Detection
The app automatically scans each day for unscheduled 1-hour slots within the configurable work window (default 9:00–20:00). Detected gaps are highlighted in yellow in the daily, weekly, and monthly views. Clicking a gap opens the **Gap Picker Dialog**, which lets you select a milestone and creates a new task (with the gap's start/end time) linked to that milestone.

### Content Items as Milestones
Publications, certifications, repositories, pull requests, and events all behave as milestones: tasks can reference them via `milestone_id`. This means a task can be linked to a PR, a certification, or an event — not only to formal milestones — and those tasks appear under the linked item when expanded in the Objectives view.

### Work Blocks
Recurring time blocks are stored in the `work_blocks` table (e.g., "Deep Work 09:00–13:00", "Certifications 14:00–16:00"). These shade the weekly calendar grid with the block's category color, providing a visual overview of the intended daily structure.

### Live Timer (NowView)
The `/now` view uses `setInterval` at 1-second resolution to drive a countdown. When the current task's end time is within 5 seconds, the Web Audio API plays a double-beep. The document title also updates live, so the timer is visible in the browser tab.

### Multi-Category Support
Tasks and content items (publications, certifications, repos, PRs, events, reading list items) support multiple categories. The primary category (`category_id`) is stored for backwards compatibility; the full list is stored as a JSON array in `category_ids`. The UI renders a badge for each category.

---

## How to Complete Tasks

1. **Daily list (`/today`)** — click the checkbox or drag the progress slider; at 100% the task is automatically marked as completed.
2. **Now view (`/now`)** — click the "✓ Marcar como completada" button.
3. **Objectives view (`/objectives`)** — expand a milestone and click the checkbox next to any linked task.
4. **Search (`/search`)** — click the checkbox in any result row.

---

## How to Add New Tasks

### Option A — UI
Click **"+ Nueva tarea"** in the daily or weekly view. The task modal lets you set title, date, time range, categories, priority, objective, milestone, status, and notes.

### Option B — Direct SQL
```bash
sqlite3 backend/data/planner.db
INSERT INTO tasks (id, title, date, start_time, end_time, category_id, status, priority, is_fixed)
  VALUES ('my-task', 'My task', '2026-05-01', '09:00', '11:00', 'github', 'pending', 1, 1);
```

---

## Exporting Data via SQL

```bash
# Export all tasks to CSV
sqlite3 -separator ',' backend/data/planner.db \
  "SELECT id,title,date,start_time,end_time,category_id,status,percentage_completed FROM tasks ORDER BY date,start_time" > tasks.csv

# Export objective progress
sqlite3 -separator ',' backend/data/planner.db \
  "SELECT title,percentage_completed,status FROM objectives" > objectives.csv
```

---

## Audio Alert

The beep in the Now view is generated entirely by the Web Audio API (no external files). To customize it:

1. Open `frontend/src/views/NowView.jsx`
2. Find the `playBeep(frequency, duration, type)` function
3. Adjustable parameters:
   - `frequency` — Hz, default `880` (high A). Try `440`, `660`, `1200`
   - `duration` — seconds, default `0.6`
   - `type` — `'sine'` | `'square'` | `'sawtooth'` | `'triangle'`

Use the **"test"** button next to the bell icon in the `/now` view to preview the sound without waiting.
