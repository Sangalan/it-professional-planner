import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import CatBadge, { CategorySelector, useCats } from '../components/CatBadge.jsx';
import ContentSearchFilters from '../components/ContentSearchFilters.jsx';
import ContentMetricsSummary from '../components/ContentMetricsSummary.jsx';

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 };
const thStyle = { padding: '9px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

function fileIcon(mimeType) {
  if (!mimeType) return '📁';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
  return '📁';
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DetailDialog({ doc, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(doc.name);
  const [catIds, setCatIds] = useState(Array.isArray(doc.category_ids) ? doc.category_ids : []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await api.updateDocument(doc.id, { name: name.trim(), category_ids: catIds });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{fileIcon(doc.mime_type)} Documento</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Nombre</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            style={{ width: '100%' }} autoFocus onKeyDown={e => e.key === 'Enter' && save()} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Categorías</label>
          <CategorySelector selected={catIds} onChange={setCatIds} />
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 20 }}>
          {fmtDate(doc.created_at)} · {fmtSize(doc.size)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" disabled={deleting}
            style={{ color: '#dc2626', borderColor: '#dc2626' }}
            onClick={async () => {
              if (!confirm(`¿Eliminar "${doc.name}"?`)) return;
              setDeleting(true);
              await api.deleteDocument(doc.id);
              setDeleting(false);
              onDeleted();
              onClose();
            }}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsView() {
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterCats, setFilterCats] = useState([]);
  const [sort, setSort] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const fileRef = useRef();
  const cats = useCats();

  async function load() {
    api.documents({ sort: 'created_at' }).then(setDocs);
  }

  useEffect(() => { load(); }, []);

  function toggleSort(col) {
    if (sort === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(col);
      setSortDir(col === 'created_at' ? 'desc' : 'asc');
    }
  }

  function sortIcon(col) {
    if (sort !== col) return <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>⇅</span>;
    return <span style={{ color: 'var(--accent)', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      await api.uploadDocument(fd);
    }
    setUploading(false);
    e.target.value = '';
    load();
  }

  const usedCatIds = [...new Set(docs.flatMap(d => d.category_ids || []))];
  const dateMatches = (isoDateTime) => {
    const value = (isoDateTime || '').slice(0, 10);
    if (!value) return !fromDate && !toDate;
    if (fromDate && value < fromDate) return false;
    if (toDate && value > toDate) return false;
    return true;
  };

  const filtered = docs
    .filter(d => !q || d.name.toLowerCase().includes(q.toLowerCase()))
    .filter(d => dateMatches(d.created_at))
    .filter(d => filterCats.length === 0 || filterCats.some(fc => (d.category_ids || []).includes(fc)));

  const visible = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sort === 'name') {
      cmp = a.name.localeCompare(b.name, 'es');
    } else if (sort === 'created_at') {
      cmp = (a.created_at || '').localeCompare(b.created_at || '');
    } else if (sort === 'size') {
      cmp = (a.size || 0) - (b.size || 0);
    } else if (sort === 'categories') {
      const an = (a.category_ids || []).map(id => cats.find(c => c.id === id)?.name || '').join(',');
      const bn = (b.category_ids || []).map(id => cats.find(c => c.id === id)?.name || '').join(',');
      cmp = an.localeCompare(bn, 'es');
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const totalDocs = docs.length;
  const totalBytes = docs.reduce((s, d) => s + (d.size || 0), 0);
  const withCategory = docs.filter(d => (d.category_ids || []).length > 0).length;
  const thisMonthPrefix = new Date().toISOString().slice(0, 7);
  const thisMonthDocs = docs.filter(d => (d.created_at || '').slice(0, 7) === thisMonthPrefix).length;
  const categoryPct = totalDocs > 0 ? Math.round((withCategory / totalDocs) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Documentos</div>
          <div className="page-subtitle">{visible.length} archivos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="file" ref={fileRef} style={{ display: 'none' }} multiple onChange={handleUpload} />
          <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? 'Subiendo…' : '+ Subir'}
          </button>
        </div>
      </div>

      <ContentMetricsSummary
        title="Resumen de documentos"
        metrics={[
          { label: 'Documentos', value: totalDocs, sub: 'archivos registrados' },
          { label: 'Peso total', value: fmtSize(totalBytes), sub: 'almacenamiento estimado' },
          { label: 'Este mes', value: thisMonthDocs, sub: 'subidos este mes', valueStyle: { color: '#2563eb' } },
          { label: 'Categorizados', value: `${categoryPct}%`, sub: `${withCategory}/${totalDocs} con categoría`, valueStyle: { color: 'var(--accent)' } },
        ]}
      />

      <ContentSearchFilters
        title={q}
        onTitleChange={setQ}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        selectedCats={filterCats}
        onSelectedCatsChange={setFilterCats}
        availableCatIds={usedCatIds}
      />

      {visible.length === 0 ? (
        <div className="empty-state card" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
          {q || fromDate || toDate || filterCats.length > 0 ? 'Sin resultados' : 'Sin documentos. Sube el primero.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th onClick={() => toggleSort('name')} style={thStyle}>
                  Nombre {sortIcon('name')}
                </th>
                <th onClick={() => toggleSort('created_at')} style={{ ...thStyle, width: 130 }}>
                  Fecha {sortIcon('created_at')}
                </th>
                <th onClick={() => toggleSort('size')} style={{ ...thStyle, width: 90 }}>
                  Tamaño {sortIcon('size')}
                </th>
                <th onClick={() => toggleSort('categories')} style={{ ...thStyle, width: 220 }}>
                  Categorías {sortIcon('categories')}
                </th>
                <th style={{ ...thStyle, width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((doc, i) => (
                <tr key={doc.id}
                  style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => setSelected(doc)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '10px 18px', fontWeight: 500 }}>
                    {fileIcon(doc.mime_type)} {doc.name}
                  </td>
                  <td style={{ padding: '10px 18px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {fmtDate(doc.created_at)}
                  </td>
                  <td style={{ padding: '10px 18px', color: 'var(--text-3)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {fmtSize(doc.size)}
                  </td>
                  <td style={{ padding: '10px 18px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(doc.category_ids || []).map(cid => <CatBadge key={cid} id={cid} />)}
                    </div>
                  </td>
                  <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Abrir documento"
                      onClick={e => { e.stopPropagation(); window.open('/uploads/' + doc.filename, '_blank'); }}
                      style={{ fontSize: 13, padding: '2px 10px' }}
                    >↗</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DetailDialog
          doc={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load(); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
