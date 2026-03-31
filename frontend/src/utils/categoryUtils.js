export const CAT_COLORS = {
  linkedin:        '#2563eb',
  contenido:       '#7c3aed',
  github:          '#059669',
  eventos:         '#ea580c',
  certificaciones: '#dc2626',
  web:             '#0f766e',
  admin:           '#6b7280',
  opensearchcon:   '#b91c1c',
};

export const CAT_LABELS = {
  linkedin:        'LinkedIn',
  contenido:       'Contenido',
  github:          'GitHub/OSS',
  eventos:         'Eventos',
  certificaciones: 'Certs',
  web:             'Web',
  admin:           'Admin',
  opensearchcon:   'OpenSearchCon',
};

export function getCatColor(id) {
  return CAT_COLORS[id] || '#94a3b8';
}

export function getCatLabel(id) {
  return CAT_LABELS[id] || id;
}

export function getCatBadgeClass(id) {
  return `badge badge-${id}`;
}

export const STATUS_LABELS = {
  pending:     'Pendiente',
  in_progress: 'En curso',
  completed:   'Completada',
  not_started: 'No iniciado',
  blocked:     'Bloqueado',
};

export function statusLabel(s) {
  return STATUS_LABELS[s] || s;
}
