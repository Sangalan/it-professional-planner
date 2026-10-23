export const TIME_ZONES = ['UTC', ...Intl.supportedValuesOf('timeZone')];

export const CLOCK_COLORS = [
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Naranja', value: '#ea580c' },
  { name: 'Amarillo', value: '#ca8a04' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Turquesa', value: '#0d9488' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Índigo', value: '#4f46e5' },
  { name: 'Violeta', value: '#9333ea' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Gris', value: '#64748b' },
];

export const DEFAULT_COLOR = CLOCK_COLORS[5].value;

export function worldClocksKey(userId) {
  return `world-clocks:${userId}`;
}

export function getClockParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = type => Number(parts.find(part => part.type === type).value);
  const year = value('year');
  const month = value('month');
  const day = value('day');
  const hour = value('hour');
  const minute = value('minute');
  return { hour, minute, dayKey: Date.UTC(year, month - 1, day, hour, minute) };
}

export function loadLocalCities(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(saved)) return [];
    const valid = saved.filter(item => item && typeof item.city === 'string' && TIME_ZONES.includes(item.timeZone));
    if (valid.every(item => !Number.isInteger(item.slot))) {
      const now = new Date();
      valid.sort((a, b) => getClockParts(now, b.timeZone).dayKey - getClockParts(now, a.timeZone).dayKey);
    }
    const occupied = new Set();
    return valid.map(item => {
      let slot = item.slot;
      if (!Number.isInteger(slot) || slot < 0 || occupied.has(slot)) {
        slot = 0;
        while (occupied.has(slot)) slot += 1;
      }
      occupied.add(slot);
      return { ...item, slot, color: CLOCK_COLORS.some(color => color.value === item.color) ? item.color : DEFAULT_COLOR, pinned: Boolean(item.pinned) };
    });
  } catch {
    return [];
  }
}
