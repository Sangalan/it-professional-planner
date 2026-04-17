import React, { useMemo, useState } from 'react';
import SpanishDateInput from './SpanishDateInput.jsx';
import { useCats } from './CatBadge.jsx';

export default function ContentSearchFilters({
  title,
  onTitleChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  selectedCats = [],
  onSelectedCatsChange,
  availableCatIds = null,
  defaultCollapsed = true,
}) {
  const cats = useCats();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const shownCats = useMemo(() => {
    if (!Array.isArray(availableCatIds) || availableCatIds.length === 0) return cats;
    return cats.filter(cat => availableCatIds.includes(cat.id));
  }, [cats, availableCatIds]);

  function toggleCat(id) {
    if (selectedCats.includes(id)) onSelectedCatsChange(selectedCats.filter(c => c !== id));
    else onSelectedCatsChange([...selectedCats, id]);
  }

  return (
    <div className="card" style={{ padding: 12, marginBottom: 12 }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setCollapsed(v => !v)}
        style={{ marginBottom: collapsed ? 0 : 10, border: 'none' }}
      >
        {collapsed ? '▸' : '▾'} Filtros de búsqueda
      </button>

      {!collapsed && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Título"
              style={{ width: '100%' }}
            />
            <SpanishDateInput
              value={fromDate}
              onChange={onFromDateChange}
              placeholder="Fecha desde"
              style={{ width: '100%' }}
            />
            <SpanishDateInput
              value={toDate}
              onChange={onToDateChange}
              placeholder="Fecha hasta"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {shownCats.map(cat => {
              const active = selectedCats.includes(cat.id);
              return (
                <span
                  key={cat.id}
                  onClick={() => toggleCat(cat.id)}
                  style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '3px 10px',
                    borderRadius: 10,
                    background: active ? cat.color + '33' : 'var(--bg)',
                    color: active ? cat.color : 'var(--text-3)',
                    border: `1px solid ${active ? cat.color : 'var(--border)'}`,
                    fontWeight: active ? 600 : 400,
                    userSelect: 'none',
                  }}
                >
                  {cat.name}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
