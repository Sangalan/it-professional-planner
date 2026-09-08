import { toDateStr, timeToMinutes } from './dateUtils.js';

// Match the agenda's 09:00–20:00 planning window; merge overlapping bookings.
export function availableTodoMinutes(tasks, date, now = new Date()) {
  const today = toDateStr(now);
  if (date < today) return 0;
  const start = date === today ? Math.max(540, now.getHours() * 60 + now.getMinutes()) : 540;
  const end = 1200;
  if (start >= end) return 0;
  const intervals = tasks.filter(t => t.date === date && t.start_time && t.end_time)
    .map(t => [Math.max(start, timeToMinutes(t.start_time)), Math.min(end, timeToMinutes(t.end_time))])
    .filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  let cursor = start;
  let busy = 0;
  for (const [s, e] of intervals) {
    busy += Math.max(0, e - Math.max(s, cursor));
    cursor = Math.max(cursor, e);
  }
  return end - start - busy;
}

function categoryIds(item) {
  try {
    const ids = typeof item?.category_ids === 'string' ? JSON.parse(item.category_ids) : item?.category_ids;
    return [...(Array.isArray(ids) ? ids : []), item?.category_id].filter(Boolean);
  } catch (_) { return item?.category_id ? [item.category_id] : []; }
}

export function sortDayTodos(tasks, objectives, categories, sortMode = 'time') {
  const businessIds = new Set(categories.filter(c => /^(sangalan|clientes?)$/i.test(c.name?.trim() || '')).map(c => c.id));
  const business = task => {
    const objective = objectives.find(o => o.id === task.objective_id);
    return objective?.type === 'client' || [...categoryIds(task), ...categoryIds(objective)]
      .some(id => businessIds.has(id) || /^(sangalan|clientes?)$/i.test(id));
  };
  const duration = task => {
    const value = Number(task.duration_estimated);
    return value > 0 ? value : -1;
  };
  const dayOrder = task => task.todo_order_date === task.date
    ? (task.todo_day_order ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  const running = task => task.status === 'in_progress' || Boolean(task.timer_started_at);
  return [...tasks].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')
    || (sortMode === 'importance' ? Number(running(b)) - Number(running(a)) : 0)
    || (sortMode === 'time' ? duration(a) - duration(b) : dayOrder(a) - dayOrder(b))
    || (a.todo_order ?? Number.MAX_SAFE_INTEGER) - (b.todo_order ?? Number.MAX_SAFE_INTEGER)
    || (sortMode === 'time' ? Number(business(b)) - Number(business(a)) : 0)
    || a.title.localeCompare(b.title, 'es'));
}
