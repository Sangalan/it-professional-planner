import {
  format, parseISO, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isSameMonth, isSameDay, addMonths, subMonths,
  getDay, differenceInDays, addDays
} from 'date-fns';
import { es } from 'date-fns/locale';

export {
  format, parseISO, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isSameMonth, isSameDay, addMonths, subMonths,
  getDay, differenceInDays, addDays
};

export function toDateStr(d) {
  return format(d, 'yyyy-MM-dd');
}

export function fmtDate(str) {
  if (!str) return '';
  return format(parseISO(str), 'd MMM yyyy', { locale: es });
}

export function fmtShortDate(str) {
  if (!str) return '';
  return format(parseISO(str), 'd MMM', { locale: es });
}

export function fmtDayOfWeek(d) {
  return format(d, 'EEE', { locale: es });
}

export function fmtMonthYear(d) {
  return format(d, 'MMMM yyyy', { locale: es });
}

export function getDaysInMonthGrid(date) {
  const monthStart = startOfMonth(date);
  const monthEnd   = endOfMonth(date);
  // Start on Monday
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function getWeekDays(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end   = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
  return `${String(m).padStart(2,'0')}m`;
}

export function secondsUntilTime(timeStr) {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.round((target - now) / 1000);
}

export function secondsBetweenTimes(startStr, endStr) {
  return (timeToMinutes(endStr) - timeToMinutes(startStr)) * 60;
}

// Returns array of hour integers (e.g. [9, 10, 14]) that are unoccupied
// within workStartH–workEndH for the given tasks array.
export function getGapHours(tasks, workStartH = 9, workEndH = 20) {
  const gaps = [];
  for (let h = workStartH; h < workEndH; h++) {
    const slotStart = h * 60;
    const slotEnd   = (h + 1) * 60;
    const occupied = tasks.some(t => {
      if (!t.start_time) return false;
      const ts = timeToMinutes(t.start_time);
      const te = t.end_time ? timeToMinutes(t.end_time) : ts + 60;
      return ts < slotEnd && te > slotStart;
    });
    if (!occupied) gaps.push(h);
  }
  return gaps;
}
