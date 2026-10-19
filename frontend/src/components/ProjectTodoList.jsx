import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import { fmtDate } from '../utils/dateUtils.js';
import { isTodoTask } from '../utils/taskUtils.js';
import TaskModal from './TaskModal.jsx';

export default function ProjectTodoList({ projectId, objectiveId, disabled, allowNew = true, onDialogChange, onTasksChanged }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [updating, setUpdating] = useState(null);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const rows = await api.tasks({ milestone_id: projectId });
      setTasks(rows.filter(task => task.milestone_id === projectId && isTodoTask(task)));
      setError('');
    } catch (_) { setError('No se pudieron cargar las tareas. Vuelve a intentarlo.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => {
    onDialogChange(Boolean(editing));
    return () => onDialogChange(false);
  }, [editing, onDialogChange]);

  async function toggle(task) {
    setUpdating(task.id);
    try {
      await api.updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
      await load();
      onTasksChanged();
    } catch (_) { setError('No se pudo actualizar la tarea. Vuelve a intentarlo.'); }
    finally { setUpdating(null); }
  }
  function saved() { setEditing(null); load(); onTasksChanged(); }
  const sorted = [...tasks].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')
    || (a.date || '9999').localeCompare(b.date || '9999') || (a.todo_order ?? Infinity) - (b.todo_order ?? Infinity) || a.title.localeCompare(b.title, 'es'));
  const completed = tasks.filter(task => task.status === 'completed').length;

  return <section className="project-todo-section">
    <div className="project-section-heading"><div><h3>ToDo List <span className="project-count">{tasks.length}</span></h3><p>Las tareas de este proyecto, también disponibles en Todo list y en su objetivo.</p></div>
      {allowNew && <button type="button" className="btn btn-primary" disabled={!projectId || disabled || updating !== null} onClick={() => setEditing({ objective_id: objectiveId || null, milestone_id: projectId })}>+ Nueva tarea</button>}
    </div>
    {!projectId ? <div className="project-empty-card"><h4>Primero crea el proyecto</h4><p>Añade un título en Detalles y pulsa «Crear proyecto» para vincular sus tareas.</p></div> : <>
      {error && <p role="alert" className="project-form-error">{error} <button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={load}>Reintentar</button></p>}
      {loading && <p role="status" className="project-hint">Cargando tareas…</p>}
      {!loading && !error && !tasks.length && <div className="project-empty-card"><h4>¿Cuál es el siguiente paso?</h4><p>Crea tu primera tarea. Puedes añadir una fecha o dejarla sin fecha.</p></div>}
      {tasks.length > 0 && <p className="project-hint">{completed} de {tasks.length} completadas</p>}
      <div className="project-todo-list">{sorted.map(task => <div key={task.id} className={`project-todo-row ${task.status === 'completed' ? 'is-completed' : ''}`}>
        <input type="checkbox" aria-label={`Marcar como ${task.status === 'completed' ? 'pendiente' : 'completada'}: ${task.title}`} checked={task.status === 'completed'} disabled={disabled || updating !== null} onChange={() => toggle(task)} />
        <button type="button" className="project-todo-content" disabled={disabled || updating !== null} aria-label={`Editar tarea: ${task.title}`} onClick={() => setEditing(task)}><span className="project-todo-heading"><strong>{task.title}</strong><time>{task.date ? fmtDate(task.date) : 'Sin fecha'}</time></span><span>{({ pending: 'Pendiente', in_progress: 'En curso', blocked: 'Bloqueada', completed: 'Completada' })[task.status] || task.status}</span>{task.description && <p>{task.description}</p>}</button>
      </div>)}</div>
    </>}
    {editing && createPortal(<div className="project-task-modal"><TaskModal initial={editing} onClose={() => setEditing(null)} onSave={saved} onDeleted={saved} /></div>, document.body)}
  </section>;
}
