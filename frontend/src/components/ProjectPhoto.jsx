import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PhotoLabels from './PhotoLabels.jsx';

export default function ProjectPhoto({ photo, photos = [photo] }) {
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(0);
  const trigger = useRef(null);
  const closeButton = useRef(null);
  const current = photos[index] || photo;
  const close = () => { setExpanded(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!expanded) return undefined;
    closeButton.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(previous => (previous - 1 + photos.length) % photos.length); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setIndex(previous => (previous + 1) % photos.length); }
      if (event.key === 'Tab') {
        const controls = Array.from(closeButton.current.closest('[role="dialog"]').querySelectorAll('button'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [expanded, photos.length]);
  return <>
    <button ref={trigger} type="button" className={`project-photo-trigger ${photo.labels?.length ? 'has-labels' : ''}`} aria-label={`Abrir foto: ${photo.name}`} onClick={() => { setIndex(Math.max(0, photos.findIndex(item => item.id === photo.id))); setExpanded(true); }}><img src={photo.src} alt={photo.name} loading="lazy" /><PhotoLabels labels={photo.labels} /></button>
    {expanded && createPortal(<div role="dialog" aria-modal="true" aria-label={current.name || 'Foto'} className="project-photo-lightbox" onClick={close}>
      <div className="project-lightbox-toolbar" onClick={e => e.stopPropagation()}><span>{index + 1} / {photos.length}</span><button ref={closeButton} type="button" className="project-icon-button" onClick={close} aria-label="Cerrar foto">✕</button></div>
      <div className="project-lightbox-image" onClick={e => e.stopPropagation()}><img src={current.src} alt={current.name} /><PhotoLabels labels={current.labels} /></div>
      <div className="project-lightbox-caption" onClick={e => e.stopPropagation()}>{photos.length > 1 && <button type="button" className="project-icon-button" aria-label="Foto anterior" onClick={() => setIndex(previous => (previous - 1 + photos.length) % photos.length)}>‹</button>}<p>{current.name}</p>{photos.length > 1 && <button type="button" className="project-icon-button" aria-label="Foto siguiente" onClick={() => setIndex(previous => (previous + 1) % photos.length)}>›</button>}</div>
    </div>, document.body)}
  </>;
}
