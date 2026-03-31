import React, { useRef, useState } from 'react';
import { api } from '../api.js';

const TABLE_LABELS = {
  categories:     'Categorías',
  objectives:     'Objetivos',
  milestones:     'Hitos',
  tasks:          'Tareas',
  events:         'Eventos',
  publications:   'Publicaciones',
  certifications: 'Certificaciones',
  repos:          'Repositorios',
  prs:            'PRs',
  work_blocks:    'Bloques de trabajo',
};

function summarize(data) {
  return Object.entries(TABLE_LABELS)
    .map(([key, label]) => ({ key, label, count: data[key]?.length || 0 }))
    .filter(r => r.count > 0);
}

export default function ImportExport() {
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);   // parsed JSON waiting for strategy choice
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);     // { stats, strategy } after import
  const [error, setError] = useState('');

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError(''); setResult(null);

    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { setError('El archivo no es un JSON válido.'); return; }

    if (!parsed.categories || !parsed.tasks) {
      setError('Archivo inválido: debe contener al menos "categories" y "tasks".');
      return;
    }
    setPending(parsed);
  }

  async function doImport(strategy) {
    setImporting(true); setError('');
    try {
      const res = await api.importData({ strategy, ...pending });
      setPending(null);
      setResult({ strategy, stats: res.stats });
    } catch (err) {
      setError(`Error al importar: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  function handleExport() {
    const a = document.createElement('a');
    a.href = '/api/export';
    a.download = `planner-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Importar / Exportar</div>
          <div className="page-subtitle">Copia de seguridad y restauración de datos en JSON</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Import result summary */}
      {result && (
        <div style={{ padding: '14px 18px', borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: 'var(--success-bg, #e6f4ea)', color: 'var(--success, #1e7e34)',
          border: '1px solid var(--success, #1e7e34)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Importación completada · estrategia: {result.strategy === 'skip' ? 'saltar duplicados' : 'mantener ambos'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
            {Object.entries(TABLE_LABELS).map(([key, label]) => {
              const ins = result.stats.inserted?.[key] || 0;
              const skp = result.stats.skipped?.[key] || 0;
              if (!ins && !skp) return null;
              return (
                <span key={key} style={{ fontSize: 12 }}>
                  <strong>{label}</strong>: {ins} añadidos{skp > 0 ? `, ${skp} omitidos` : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Conflict strategy dialog */}
      {pending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}
          onClick={e => e.target === e.currentTarget && !importing && setPending(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 28,
            maxWidth: 480, width: '100%', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Importar datos</h2>
              {!importing && (
                <button onClick={() => setPending(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)' }}>✕</button>
              )}
            </div>

            {/* File summary */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Contenido del archivo:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {summarize(pending).map(r => (
                  <span key={r.key} style={{ fontSize: 13 }}>
                    <strong>{r.count}</strong> {r.label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>

            {/* Strategy explanation */}
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20,
              padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
              Si algún elemento del archivo ya existe en la base de datos (mismo ID), puedes:
              <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                <li style={{ marginBottom: 4 }}><strong>Saltar duplicados</strong> — el elemento existente no se modifica.</li>
                <li><strong>Mantener ambos</strong> — el elemento importado se inserta con un ID nuevo (<code>id-2</code>, <code>id-3</code>…).</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setPending(null)} disabled={importing}>Cancelar</button>
              <button className="btn btn-ghost" onClick={() => doImport('skip')} disabled={importing}>
                {importing ? 'Importando…' : 'Saltar duplicados'}
              </button>
              <button className="btn btn-primary" onClick={() => doImport('rename')} disabled={importing}>
                {importing ? 'Importando…' : 'Mantener ambos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Exportar datos</span></div>
        <div style={{ padding: '16px 18px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
            Descarga una copia completa de todos tus datos en formato JSON.
          </p>
          <button className="btn btn-primary" onClick={handleExport}>⬇ Descargar JSON</button>
        </div>
      </div>

      {/* Import */}
      <div className="card">
        <div className="card-header"><span className="card-title">Importar datos</span></div>
        <div style={{ padding: '16px 18px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
            Añade datos desde un archivo JSON exportado anteriormente. Los elementos existentes no se sobrescriben — puedes elegir cómo gestionar los duplicados.
          </p>
          <input ref={fileRef} type="file" accept=".json,application/json"
            style={{ display: 'none' }} onChange={handleFileChange} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
            ⬆ Seleccionar archivo JSON
          </button>
        </div>
      </div>
    </div>
  );
}
