import { parseLocalDate } from "../../domain/date";
import { Link } from "react-router-dom";
import { useCurrentLocalDate } from "./useCurrentLocalDate";
import { useTodayPlan } from "./useTodayPlan";

function dateLabel(date: string) {
  const parts = parseLocalDate(date);
  if (!parts) return date;
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(
    new Date(parts.year, parts.month - 1, parts.day, 12),
  );
}

export function TodayWorkspace({ date: dateOverride }: { date?: string }) {
  const liveDate = useCurrentLocalDate();
  const date = dateOverride ?? liveDate;
  const { tasks, sessionCounts, isLoading, loadError, actionError, reload, returnToInbox, moveTask, completeTask, reopenTask } = useTodayPlan(date);
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
  const completedSessionCount = tasks.reduce((total, task) => total + (sessionCounts[task.id] ?? 0), 0);

  return (
    <div className="page today-page">
      <header className="page-heading">
        <p className="eyebrow">{dateLabel(date)}</p>
        <h1>A clear day starts small.</h1>
        <p className="lede">Choose a few meaningful things. Momentum will help you protect the time for them.</p>
      </header>

      {isLoading ? (
        <section className="today-state" aria-busy="true"><p role="status">Opening today’s plan…</p></section>
      ) : loadError ? (
        <section className="today-state">
          <p className="eyebrow">Plan unavailable</p>
          <h2>Today couldn’t be loaded.</h2>
          <p role="alert">{loadError}</p>
          <div className="recovery-actions"><button className="button button-dark" type="button" onClick={() => void reload()}>Try again</button><Link className="button" to="/settings">Open data controls</Link></div>
        </section>
      ) : (
        <section className="today-layout" aria-label="Today's plan">
          <div className="today-plan-card">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Today’s plan</p>
                <h2>{tasks.length === 0 ? "Nothing planned yet" : `${tasks.length} ${tasks.length === 1 ? "priority" : "priorities"}`}</h2>
              </div>
              <span className="count-badge">{tasks.filter((task) => task.status !== "completed").length} / 5 open</span>
            </div>

            {tasks.length === 0 ? (
              <div className="today-empty">
                <div className="empty-illustration" aria-hidden="true">
                  <span className="orbit orbit-one" />
                  <span className="orbit orbit-two" />
                  <span className="sun" />
                </div>
                <p>Your day is open. Choose a task from the Inbox when you’re ready.</p>
                <Link className="button" to="/inbox">Visit your inbox <span aria-hidden="true">→</span></Link>
              </div>
            ) : (
              <ol className="today-task-list">
                {tasks.map((task, index) => (
                  <li className={`today-task${task.status === "completed" ? " is-complete" : ""}`} key={task.id}>
                    <div className="task-position" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                    <div className="today-task-copy">
                      <div className="task-card-heading">
                        <h3>{task.title}</h3>
                        {task.tag && <span className="tag-chip">{task.tag}</span>}
                      </div>
                      {task.notes && <p>{task.notes}</p>}
                      <span className="session-estimate">
                        {sessionCounts[task.id] ?? 0} of {task.estimatedSessions} focus sessions
                      </span>
                    </div>
                    <div className="today-task-actions">
                      {task.status !== "completed" && <Link className="plan-today-button" to={`/focus?task=${encodeURIComponent(task.id)}`}>Focus <span className="sr-only">on {task.title}</span></Link>}
                      <div className="move-actions" aria-label={`Reorder ${task.title}`}>
                        <button aria-label={`Move ${task.title} up`} disabled={index === 0} type="button" onClick={() => void moveTask(task.id, "up")}>↑</button>
                        <button aria-label={`Move ${task.title} down`} disabled={index === tasks.length - 1} type="button" onClick={() => void moveTask(task.id, "down")}>↓</button>
                      </div>
                      {task.status === "completed" ? (
                        <button className="text-button" type="button" onClick={() => void reopenTask(task.id)}>Reopen <span className="sr-only">{task.title}</span></button>
                      ) : (
                        <>
                          <button className="text-button complete-button" type="button" onClick={() => void completeTask(task.id)}>Complete <span className="sr-only">{task.title}</span></button>
                          <button className="text-button" type="button" onClick={() => void returnToInbox(task.id)}>Return <span className="sr-only">{task.title} to Inbox</span></button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <aside className="today-summary">
            <p className="eyebrow">Daily rhythm</p>
            <div className="rhythm-stat"><strong>{completedCount}</strong><span>of {tasks.length} tasks complete</span></div>
            <div className="progress-track" role="progressbar" aria-label={`${completedCount} of ${tasks.length} tasks completed`} aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={completedCount}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="summary-row"><span>Focus sessions</span><strong>{completedSessionCount}</strong></div>
            <div className="summary-row"><span>Plan date</span><strong>{date}</strong></div>
          </aside>
        </section>
      )}

      {actionError && <p className="action-error" role="alert">Plan update failed: {actionError}</p>}
    </div>
  );
}
