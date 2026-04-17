import React, { useState } from 'react';

export default function ContentMetricsSummary({ title = 'Resumen', metrics = [], defaultCollapsed = true }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!metrics.length) return null;

  return (
    <div className="card" style={{ padding: 12, marginBottom: 0 }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setCollapsed(v => !v)}
        style={{ marginBottom: collapsed ? 0 : 10, border: 'none' }}
      >
        {collapsed ? '▸' : '▾'} {title}
      </button>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {metrics.map((m, i) => (
            <div key={`${m.label}-${i}`} className="stat-card" style={{ padding: 12 }}>
              <div className="stat-label">{m.label}</div>
              <div className="stat-value" style={{ fontSize: 22, ...(m.valueStyle || {}) }}>{m.value}</div>
              <div className="stat-sub">{m.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
