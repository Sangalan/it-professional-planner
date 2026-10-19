import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function MarkdownText({ text }) {
  return <div className="document-preview-markdown">{text.split(/\r?\n/).map((line, index) => {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) return <h3 key={index} style={{ fontSize: `${Math.max(1, 1.7 - heading[1].length * .12)}em` }}>{heading[2]}</h3>;
    if (/^\s*[-*]\s+/.test(line)) return <p key={index}>• {line.replace(/^\s*[-*]\s+/, '')}</p>;
    return <p key={index}>{line || '\u00a0'}</p>;
  })}</div>;
}

export default function DocumentPreview({ doc, onClose }) {
  const extension = (doc.name.split('.').pop() || '').toLowerCase();
  const isPdf = extension === 'pdf' || doc.mime_type === 'application/pdf';
  const isMarkdown = ['md', 'markdown'].includes(extension);
  const isWord = ['doc', 'docx'].includes(extension);
  const isText = ['txt', 'text', 'log', 'csv', 'tsv'].includes(extension) || doc.mime_type?.startsWith('text/');
  const [content, setContent] = useState('');
  const [objectUrl, setObjectUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let url = '';
    setContent(''); setObjectUrl(''); setError(''); setLoading(true);
    if (!isPdf && !isMarkdown && !isWord && !isText) { setLoading(false); return () => controller.abort(); }
    fetch(isWord ? `/api/documents/${encodeURIComponent(doc.id)}/preview` : `/uploads/${encodeURIComponent(doc.filename)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo abrir el documento.');
        if (isPdf) {
          url = URL.createObjectURL(await response.blob());
          if (!controller.signal.aborted) setObjectUrl(url);
        } else if (!controller.signal.aborted) setContent(await response.text());
      })
      .catch(() => { if (!controller.signal.aborted) setError('No se pudo abrir el documento.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [doc.id, doc.filename, isPdf, isMarkdown, isWord, isText]);
  useEffect(() => {
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = priorOverflow; document.removeEventListener('keydown', handleKey); };
  }, [onClose]);
  return createPortal(<div className="document-preview-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="document-preview-modal" role="dialog" aria-modal="true" aria-label={`Visualizar ${doc.name}`}>
      <header><strong>{doc.name}</strong><div><a className="btn btn-ghost btn-sm" href={`/uploads/${encodeURIComponent(doc.filename)}`} download={doc.name}>Descargar</a><button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Cerrar visualización">✕</button></div></header>
      <main>{loading ? <p>Cargando documento…</p> : error ? <p role="alert">{error}</p> : isPdf ? <iframe title={doc.name} src={objectUrl} /> : isMarkdown ? <MarkdownText text={content} /> : isWord ? <><p className="document-preview-note">Vista del texto de Word. Descarga el original para consultar su formato.</p><pre>{content}</pre></> : isText ? <pre>{content}</pre> : <p>Este formato no tiene vista previa. Puedes descargar el documento para abrirlo.</p>}</main>
    </div>
  </div>, document.body);
}
