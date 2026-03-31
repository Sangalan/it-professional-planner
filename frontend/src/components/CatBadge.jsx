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

export default function CatBadge({ id, style = {}, ...rest }) {
  const cats = useCats();
  const cat = cats.find(c => c.id === id);
  const color = cat?.color || '#94a3b8';
  return (
    <span
      className="badge"
      style={{ background: color + '22', color, ...style }}
      {...rest}
    >
      {cat?.name || id || '—'}
    </span>
  );
}
