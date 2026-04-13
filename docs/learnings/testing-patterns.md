# Testing Patterns

**No automated tests exist.** All verification is manual. This file documents what to check for each type of change.

---

## Startup Check (Every Session)

```bash
npm run dev
```

Expected:
- Terminal shows `Backend running on port 3002` (or similar)
- Terminal shows `VITE v5.x.x  ready in Xms`
- Browser at `http://localhost:5173` shows Dashboard
- No red errors in browser console (F12)
- No errors in terminal

---

## After Backend API Changes

1. Test the endpoint directly:
   ```bash
   curl http://localhost:3002/api/your-endpoint
   curl -X POST http://localhost:3002/api/your-endpoint \
     -H "Content-Type: application/json" \
     -d '{"field":"value"}'
   ```
2. Verify response shape matches what the frontend expects
3. Check terminal for any SQLite errors
4. Open the relevant view in browser and verify data loads

---

## After Database Schema Changes

1. Restart backend after migration
2. Check migration ran: `sqlite3 backend/data/planner.db .schema`
3. Verify new column/table exists
4. Test read + write via API
5. Verify existing data wasn't corrupted: `SELECT * FROM table LIMIT 5;`

---

## After Adding a New View

- [ ] Route navigates without 404 (`/new-path`)
- [ ] Data loads on page open (no console errors)
- [ ] Loading state shows while fetching
- [ ] Empty state shows if no data
- [ ] Create/edit actions work
- [ ] Delete actions work
- [ ] Navigate away and back — data still correct

---

## After Modifying an Existing View

- [ ] The view still loads correctly
- [ ] All existing actions still work (create, edit, delete, filters)
- [ ] Related views still work (e.g., editing tasks affects Dashboard stats)
- [ ] No regressions in adjacent features

---

## After CSS/Style Changes

- [ ] Change looks correct in the affected view
- [ ] Other views are not visually broken
- [ ] Check at different browser window widths (the app has no mobile optimization but shouldn't completely break)

---

## After Modifying `db.js` or `server.js`

- [ ] Backend restarts without errors
- [ ] `GET /api/categories` returns data (smoke test)
- [ ] `GET /api/dashboard` returns data (aggregation test)
- [ ] Affected endpoint works as expected

---

## Views to Spot-Check After Major Changes

These views have the most cross-cutting concerns — verify after significant changes:

1. **Dashboard** (`/`) — aggregates data from all tables
2. **Daily List** (`/daily`) — fixed task expansion + category filters
3. **Weekly Calendar** (`/weekly`) — time-grid rendering + work blocks
4. **Objectives** (`/objectives`) — complex nesting (milestones + content items + tasks)
5. **Reports** (`/reports`) — Recharts data aggregation

---

## Manual Test Data Tips

```bash
# Quick smoke test — check categories exist
curl http://localhost:3002/api/categories

# Check tasks for today
curl "http://localhost:3002/api/tasks/today"

# Full data export (check data integrity)
curl http://localhost:3002/api/export | python3 -m json.tool | head -50
```
