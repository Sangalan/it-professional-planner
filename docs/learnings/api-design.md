# API Design Patterns

All routes are in `backend/server.js`. Express 4, no framework conventions enforced.

---

## Route Grouping Convention

Routes are grouped by entity and follow this order within each group:

```js
app.get('/api/things',       handler);  // list all (with optional query filters)
app.get('/api/things/search', handler); // full-text search (before /:id)
app.get('/api/things/special', handler); // special computed endpoints (before /:id)
app.get('/api/things/:id',   handler);  // single item
app.post('/api/things',      handler);  // create
app.put('/api/things/:id',   handler);  // update
app.delete('/api/things/:id', handler); // delete
```

**Important:** Specific paths (`/search`, `/today`) must be defined BEFORE `/:id` routes — otherwise Express matches them as IDs.

---

## Standard Response Pattern

```js
app.get('/api/things', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM things').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/things', (req, res) => {
  try {
    const { title, category_id } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const result = db.prepare(
      'INSERT INTO things (title, category_id) VALUES (?, ?)'
    ).run(title, category_id);
    const created = db.prepare('SELECT * FROM things WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Always:** return the full object after create/update (not just `{ id }` or `{ success: true }`).

---

## Query String Filters

```js
app.get('/api/tasks', (req, res) => {
  const { date, category_id, status, objective_id } = req.query;
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (date) { query += ' AND date = ?'; params.push(date); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  // ...

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});
```

---

## File Upload Pattern (multer)

```js
const multer = require('multer');
const storage = multer.diskStorage({
  destination: './data/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.post('/api/documents', upload.single('file'), (req, res) => {
  // req.file has: filename, originalname, size, mimetype
  // req.body has other form fields
});
```

Files are stored in `backend/data/uploads/` with timestamped names to avoid collisions.

---

## Error Response Conventions

| Situation | Status Code | Body |
|---|---|---|
| Not found | 404 | `{ error: 'Not found' }` |
| Missing required field | 400 | `{ error: 'fieldName required' }` |
| Server/DB error | 500 | `{ error: err.message }` |
| Created | 201 | Full created object |
| Updated | 200 | Full updated object |
| Deleted | 200 | `{ message: 'Deleted' }` or `{}` |

---

## Production Static File Serving

At the bottom of `server.js`, Express serves the built frontend:

```js
app.use(express.static('../frontend/dist'));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

This must remain at the bottom — all API routes must be defined before it.

---

## Dashboard Aggregation Pattern

`GET /api/dashboard` returns a single large object with all dashboard data in one call. This avoids multiple round-trips from the frontend. Use this pattern for any view that needs aggregated data from multiple tables.

---

## Import Conflict Resolution

`POST /api/import` handles ID conflicts two ways:
1. **Skip** — if record with same ID exists, skip import
2. **Keep both** — append `-2`, `-3` suffix to imported IDs

Check the import handler in `server.js` before modifying any table's ID generation logic.
