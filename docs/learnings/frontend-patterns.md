# Frontend Patterns

Tech: React 18, Vite, React Router 6, plain CSS. No TypeScript, no state management library.

---

## Adding a New View

1. Create `frontend/src/views/ThingView.jsx`
2. In `frontend/src/App.jsx`:
   ```jsx
   import ThingView from './views/ThingView';
   // Inside <Routes>:
   <Route path="/things" element={<ThingView />} />
   ```
3. Add nav link in the sidebar section of `App.jsx`

---

## Standard View Template

```jsx
import { useState, useEffect } from 'react';
import { getThings, createThing, updateThing, deleteThing } from '../api';

export default function ThingView() {
  const [things, setThings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThings();
  }, []);

  async function loadThings() {
    try {
      const data = await getThings();
      setThings(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(formData) {
    const created = await createThing(formData);
    setThings(prev => [...prev, created]);
  }

  async function handleDelete(id) {
    await deleteThing(id);
    setThings(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="view-container">
      {things.map(t => <div key={t.id}>{t.title}</div>)}
    </div>
  );
}
```

---

## API Calls via `api.js`

All fetch calls go through `frontend/src/api.js`:

```js
// In api.js — add your function:
export const getThings = () => apiFetch('/api/things');
export const createThing = (data) => apiFetch('/api/things', {
  method: 'POST',
  body: JSON.stringify(data)
});
export const updateThing = (id, data) => apiFetch(`/api/things/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data)
});
export const deleteThing = (id) => apiFetch(`/api/things/${id}`, {
  method: 'DELETE'
});
```

`apiFetch` throws if `response.ok` is false — wrap calls in try/catch in components.

---

## CategoryContext

Categories are fetched once and shared via context defined in `components/CatBadge.jsx`:

```jsx
import { useCategories } from '../components/CatBadge';

function MyComponent() {
  const categories = useCategories();
  // categories is an array of { id, name, color }
}
```

To render a category badge:
```jsx
import CatBadge from '../components/CatBadge';
<CatBadge categoryId={task.category_id} />
```

---

## TaskModal (Shared Create/Edit Form)

```jsx
import TaskModal from '../components/TaskModal';

// Show modal for creating a task on a specific date:
<TaskModal
  date="2026-04-13"
  onSave={(newTask) => setTasks(prev => [...prev, newTask])}
  onClose={() => setShowModal(false)}
/>

// Show modal for editing an existing task:
<TaskModal
  task={existingTask}
  onSave={(updated) => setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))}
  onClose={() => setEditTask(null)}
/>
```

---

## Date Utilities (`utils/dateUtils.js`)

```js
import { findGaps, formatDate, parseDate } from '../utils/dateUtils';

// Find unscheduled 1-hour gaps in a day
const gaps = findGaps(tasks, workStart, workEnd);
// Returns: [{ start: '09:00', end: '10:00' }, ...]

// Format for display
formatDate(new Date(), 'es'); // Spanish locale via date-fns
```

---

## Category Utilities (`utils/categoryUtils.js`)

```js
import { getCategoryColor, getStatusLabel } from '../utils/categoryUtils';

getCategoryColor(category);  // returns hex color string
getStatusLabel('completed'); // returns Spanish label: 'Completado'
```

---

## Routing (React Router 6)

```jsx
import { useNavigate, useParams, Link } from 'react-router-dom';

// Navigate programmatically
const navigate = useNavigate();
navigate('/daily');

// Link component
<Link to="/objectives">Objetivos</Link>

// URL params
const { id } = useParams();
```

---

## Recharts (Charts in Reports View)

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={chartData}>
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="#4a90e2" />
  </BarChart>
</ResponsiveContainer>
```

`chartData` format: `[{ name: 'Label', value: 42 }, ...]`

---

## CSS Conventions

- No CSS framework — all styles in `frontend/src/index.css` (global) or inline
- Class names use kebab-case: `task-card`, `view-container`, `status-badge`
- CSS variables defined at `:root` for colors and spacing
- No CSS modules — component styles added to the global file or component file with matching `.css`
