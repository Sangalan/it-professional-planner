export function isFixedTask(task) {
  return Number(task?.is_fixed) === 1;
}

export function canCompleteTask(task) {
  return !isFixedTask(task);
}

export function getEditableTaskStatuses(task) {
  const options = [
    { value: 'pending', label: 'Pendiente' },
    { value: 'in_progress', label: 'En curso' },
    { value: 'blocked', label: 'Bloqueada' },
  ];
  if (canCompleteTask(task)) {
    options.splice(2, 0, { value: 'completed', label: 'Completada' });
  }
  return options;
}
