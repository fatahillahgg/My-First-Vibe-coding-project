import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Task } from "../../domain/models";
import type { DeletedTaskData } from "../../data/MomentumRepository";
import { TaskForm } from "./TaskForm";
import { EMPTY_TASK_DRAFT, taskToDraft } from "./taskDraft";
import { useInboxTasks } from "./useInboxTasks";

function displayTag(tag: string) {
  return tag.trim().toLocaleLowerCase();
}

export function InboxWorkspace() {
  const { tasks, todayPlanCount, isTodayPlanFull, isLoading, loadError, actionError, reload, createTask, updateTask, deleteTask, restoreTask, planTaskToday } = useInboxTasks();
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deletedTasks, setDeletedTasks] = useState<DeletedTaskData[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const tags = useMemo(
    () => [...new Set(tasks.flatMap((task) => task.tag ? [task.tag] : []))].sort((left, right) => left.localeCompare(right)),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return tasks.filter((task) => {
      const titleMatches = normalizedQuery.length === 0 || task.title.toLocaleLowerCase().includes(normalizedQuery);
      const tagMatches = selectedTag.length === 0 || (task.tag !== null && displayTag(task.tag) === displayTag(selectedTag));
      return titleMatches && tagMatches;
    });
  }, [query, selectedTag, tasks]);

  const filtersActive = query.length > 0 || selectedTag.length > 0;

  async function handleDelete(task: Task) {
    try {
      const deleted = await deleteTask(task);
      setDeletedTasks((current) => [...current, deleted]);
      setEditingTaskId((current) => current === task.id ? null : current);
      setAnnouncement(`${task.title} deleted.`);
    } catch {
      setAnnouncement(`${task.title} could not be deleted.`);
    }
  }

  async function handleUndo() {
    const deleted = deletedTasks.at(-1);
    if (!deleted) return;
    const task = deleted.task;
    try {
      await restoreTask(deleted);
      setDeletedTasks((current) => current.slice(0, -1));
      setAnnouncement(`${task.title} restored.`);
    } catch {
      setAnnouncement(`${task.title} could not be restored.`);
    }
  }

  async function handlePlanToday(task: Task) {
    try {
      await planTaskToday(task);
      setAnnouncement(`${task.title} added to today’s plan.`);
    } catch {
      setAnnouncement(`${task.title} could not be added to today’s plan.`);
    }
  }

  if (isLoading) {
    return <section className="inbox-state" aria-busy="true"><p role="status">Gathering your inbox…</p></section>;
  }

  if (loadError) {
    return (
      <section className="inbox-state">
        <p className="eyebrow">Inbox unavailable</p>
        <h2>Tasks couldn’t be loaded.</h2>
        <p role="alert">{loadError}</p>
        <div className="recovery-actions"><button className="button button-dark" type="button" onClick={() => void reload()}>Try again</button><Link className="button" to="/settings">Open data controls</Link></div>
      </section>
    );
  }

  return (
    <div className="inbox-workspace">
      <section className="capture-card" aria-labelledby="capture-heading">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Quick capture</p>
            <h2 id="capture-heading">Add to your inbox</h2>
          </div>
          <span className="count-badge">{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
        </div>
        <TaskForm
          initialDraft={{ ...EMPTY_TASK_DRAFT }}
          submitLabel="Add task"
          onSubmit={async (draft) => {
            const task = await createTask(draft);
            setAnnouncement(`${task.title} added to Inbox.`);
          }}
        />
      </section>

      <section className="inbox-list-section" aria-labelledby="inbox-list-heading">
        <div className="inbox-list-header">
          <div>
            <p className="eyebrow">Unsorted thoughts</p>
            <h2 id="inbox-list-heading">Your inbox</h2>
          </div>
          {tasks.length > 0 && (
            <div className="inbox-filters" role="search">
              <div className="field compact-field">
                <label className="sr-only" htmlFor="inbox-search">Search task titles</label>
                <input id="inbox-search" type="search" placeholder="Search titles" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="field compact-field">
                <label className="sr-only" htmlFor="inbox-tag-filter">Filter by tag</label>
                <select id="inbox-tag-filter" value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
                  <option value="">All tags</option>
                  {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </div>
              {filtersActive && (
                <button className="text-button" type="button" onClick={() => { setQuery(""); setSelectedTag(""); }}>Clear filters</button>
              )}
            </div>
          )}
        </div>

        {isTodayPlanFull && tasks.length > 0 && (
          <p className="plan-limit-notice" id="today-plan-limit" role="status">
            Today’s plan is full ({todayPlanCount}/5). Return a task to Inbox before adding another.
          </p>
        )}

        {tasks.length === 0 ? (
          <div className="inbox-empty">
            <span aria-hidden="true">✦</span>
            <h3>Your inbox is clear</h3>
            <p>Capture the first loose end above. You can decide when to do it later.</p>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="inbox-empty no-results">
            <h3>No matching tasks</h3>
            <p>Try another title or tag, or clear the filters above. Your stored tasks haven’t changed.</p>
          </div>
        ) : (
          <ul className="task-list">
            {visibleTasks.map((task) => (
              <li className="task-card" key={task.id}>
                {editingTaskId === task.id ? (
                  <div className="task-editor" role="region" aria-label={`Edit ${task.title}`}>
                    <p className="eyebrow">Editing task</p>
                    <TaskForm
                      autoFocusTitle
                      initialDraft={taskToDraft(task)}
                      submitLabel="Save changes"
                      onCancel={() => setEditingTaskId(null)}
                      onSubmit={async (draft) => {
                        const updated = await updateTask(task, draft);
                        setEditingTaskId(null);
                        setAnnouncement(`${updated.title} updated.`);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="task-card-body">
                      <div className="task-card-heading">
                        <h3>{task.title}</h3>
                        {task.tag && <span className="tag-chip">{task.tag}</span>}
                      </div>
                      {task.notes && <p>{task.notes}</p>}
                      <span className="session-estimate">{task.estimatedSessions} {task.estimatedSessions === 1 ? "focus session" : "focus sessions"}</span>
                    </div>
                    <div className="task-actions">
                      <button
                        aria-describedby={isTodayPlanFull ? "today-plan-limit" : undefined}
                        aria-label={`Plan ${task.title} for today`}
                        className="plan-today-button"
                        disabled={isTodayPlanFull}
                        type="button"
                        onClick={() => void handlePlanToday(task)}
                      >
                        Plan <span className="sr-only">{task.title} for </span>today
                      </button>
                      <button className="text-button" type="button" onClick={() => setEditingTaskId(task.id)}>Edit <span className="sr-only">{task.title}</span></button>
                      <button className="text-button danger-button" type="button" onClick={() => void handleDelete(task)}>Delete <span className="sr-only">{task.title}</span></button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sr-only" aria-live="polite">{announcement}</div>
      {actionError && <p className="action-error" role="alert">Storage action failed: {actionError}</p>}
      {deletedTasks.length > 0 && (
        <div className="undo-bar" role="status">
          <span>{deletedTasks.at(-1)?.task.title} deleted{deletedTasks.length > 1 ? ` · ${deletedTasks.length} undoable` : ""}</span>
          <button type="button" onClick={() => void handleUndo()}>Undo</button>
        </div>
      )}
    </div>
  );
}
