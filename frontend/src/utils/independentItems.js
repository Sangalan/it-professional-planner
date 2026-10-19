import { isMoneyMakerTask, isMoneyObjective } from './taskUtils.js';

export function getIndependentItems(objectives, milestones, repos, tasks = []) {
  const parents = new Map(objectives.map(objective => [objective.id, objective]));
  return [
    ...milestones.map(item => ({ ...item, type: 'milestone', icon: '🏁' })),
    ...repos.map(item => ({ ...item, project_type: item.type, type: 'repo', icon: item.type === 'notes' ? '📝' : '📦' })),
  ].filter(item => Number(item.show_independent) === 1).map(item => {
    const parent = parents.get(item.objective_id);
    const linkedTasks = tasks.filter(task => task.milestone_id === item.id && !Number(task.is_fixed));
    return { ...item, date: item.target_date, parent_title: parent?.title || '', color: item.independent_color || parent?.color || '#2563eb',
      task_total: linkedTasks.length, task_done: linkedTasks.filter(task => task.status === 'completed').length };
  });
}

export function asTodoColumn(item) {
  return { ...item, id: `${item.type}:${item.id}`, source_id: item.id, milestone_id: item.id, column_kind: item.type };
}

export function matchesTodoColumn(task, column) {
  if (!column) return false;
  if (column.milestone_id) return task.milestone_id === column.milestone_id;
  return task.objective_id === column.id || (isMoneyObjective(column) && isMoneyMakerTask(task));
}
