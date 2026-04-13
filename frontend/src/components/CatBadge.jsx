import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const CategoriesContext = createContext([]);

export function CategoriesProvider({ children }) {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.categories().then(setCats); }, []);
  return <CategoriesContext.Provider value={cats}>{children}</CategoriesContext.Provider>;
}

export function useCats() {
  return useContext(CategoriesContext);
}

const PRESET_COLORS = [
  '#2563eb','#7c3aed','#059669','#ea580c','#dc2626',
  '#0f766e','#6b7280','#b91c1c','#0369a1','#d97706',
  '#db2777','#16a34a','#7c3aed','#475569','#1d4ed8',
];

export function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {PRESET_COLORS.map(c => (
        <div key={c} onClick={() => onChange(c)} style={{
          width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
          border: value === c ? '3px solid var(--text)' : '2px solid transparent', transition: 'border .1s',
        }} title={c} />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }}
        title="Color personalizado" />
    </div>
  );
}

export function CategoryOption({ cat, active, onClick }) {
  const color = cat.color || '#94a3b8';
  const textColor = cat.text_color || '#1f2937';
  const borderColor = active ? textColor : textColor + '55';

  return (
    <span
      onClick={onClick}
      style={{
        cursor: 'pointer',
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 10,
        background: active ? color + '22' : 'var(--bg)',
        color: active ? textColor : 'var(--text-2)',
        border: `1px solid ${borderColor}`,
        fontWeight: active ? 600 : 400,
        userSelect: 'none',
      }}
    >
      {cat.name}
    </span>
  );
}

export function CategorySelector({ selected, onChange }) {
  const cats = useCats();
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {cats.map(cat => {
        const active = selected.includes(cat.id);
        return <CategoryOption key={cat.id} cat={cat} active={active} onClick={() => toggle(cat.id)} />;
      })}
    </div>
  );
}

export default function CatBadge({ id, style = {}, ...rest }) {
  const cats = useCats();
  const cat = cats.find(c => c.id === id);
  const color = cat?.color || '#94a3b8';
  const textColor = cat?.text_color || color;
  return (
    <span
      className="badge"
      style={{ background: color + '22', color: textColor, border: `1px solid ${textColor}`, ...style }}
      {...rest}
    >
      {cat?.name || id || '—'}
    </span>
  );
}
