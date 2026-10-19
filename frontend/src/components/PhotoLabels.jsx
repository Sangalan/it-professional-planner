import React from 'react';

export default function PhotoLabels({ labels = [] }) {
  return labels.map(label => <span key={label.id} className="project-photo-label" style={{ left: `${label.x}%`, top: `${label.y}%`, transform: `translate(-${label.x}%, -${label.y}%)` }}>{label.text}</span>);
}
