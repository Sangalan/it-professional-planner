import React, { useEffect, useRef, useState } from 'react';

export function useQuickTypeSearch(enabled = true) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!enabled) {
      setQuery('');
      return undefined;
    }

    function handleKeyDown(event) {
      const target = event.target;
      const isEditing = target instanceof HTMLElement && (
        target.matches('input, textarea, select') || target.isContentEditable
      );
      if (isEditing || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
      setQuery(event.key);
      event.preventDefault();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  return [query, setQuery];
}

export function matchesQuickQuery(value, query) {
  const normalized = query.trim().toLocaleLowerCase('es');
  return !normalized || String(value || '').toLocaleLowerCase('es').includes(normalized);
}

export default function QuickTypeSearch({ query, onQueryChange, label }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query) return undefined;
    inputRef.current?.focus();

    function close(event) {
      if (!inputRef.current?.contains(event.target)) onQueryChange('');
    }

    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [query, onQueryChange]);

  if (!query) return null;
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 250, width: 'min(520px, calc(100vw - 32px))' }}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onQueryChange('');
          }
        }}
        placeholder={`Filtrar ${label}…`}
        aria-label={`Filtrar ${label}`}
        style={{ width: '100%', padding: '12px 16px', fontSize: 16, background: 'var(--surface)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)', borderRadius: 10 }}
      />
    </div>
  );
}
