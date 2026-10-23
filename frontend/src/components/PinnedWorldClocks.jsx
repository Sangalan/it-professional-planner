import React, { useEffect, useState } from 'react';
import { getClockParts } from '../utils/worldClocks.js';

export default function PinnedWorldClocks({ cities }) {
  const [now, setNow] = useState(() => new Date());
  const sortedCities = cities.map(city => ({ ...city, clock: getClockParts(now, city.timeZone) }))
    .sort((a, b) => a.clock.dayKey - b.clock.dayKey || a.city.localeCompare(b.city, 'es'));

  useEffect(() => {
    let timer;
    const update = () => {
      setNow(new Date());
      timer = setTimeout(update, 60000 - Date.now() % 60000);
    };
    timer = setTimeout(update, 60000 - Date.now() % 60000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="pinned-world-clocks" role="region" aria-label="Horas fijadas">
      <div className="pinned-world-clocks-track">
        {sortedCities.map(city => {
          const { hour, minute } = city.clock;
          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          return (
            <div className="pinned-world-clock" key={city.id} style={{ '--clock-color': city.color }} title={`${city.city}: ${time}`}>
              <span>{city.city}</span>
              <time dateTime={time}>{time}</time>
            </div>
          );
        })}
      </div>
    </div>
  );
}
