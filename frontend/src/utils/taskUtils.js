export function isFixedTask(task) {
  return Number(task?.is_fixed) === 1;
}

export const MONEY_OBJECTIVE_TITLE = "let's make some money";

export function isMoneyObjective(objective) {
  return (objective?.title || '').trim().toLocaleLowerCase('en-US').replace(/[!?.]+$/g, '').trim() === MONEY_OBJECTIVE_TITLE;
}

export function isMoneyMakerTask(task) {
  return Number(task?.is_money_maker) === 1;
}

export function isTodoTask(task) {
  return !isFixedTask(task) && (!task?.date || (!task?.start_time && !task?.end_time));
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
