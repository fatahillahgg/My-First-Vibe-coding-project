import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMomentumRepository } from "../../app/ApplicationDataContext";
import { parseLocalDate } from "../../domain/date";
import { DailyReviewService, type DailyReviewSummary } from "../../services/DailyReviewService";
import { useCurrentLocalDate } from "../today/useCurrentLocalDate";

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "An unknown storage error occurred";
}

function dateLabel(date: string) {
  const parts = parseLocalDate(date);
  if (!parts) return date;
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(parts.year, parts.month - 1, parts.day, 12));
}

export function ReviewWorkspace({ date: dateOverride }: { date?: string }) {
  const liveDate = useCurrentLocalDate();
  const date = dateOverride ?? liveDate;
  const repository = useMomentumRepository();
  const service = useMemo(() => new DailyReviewService(repository), [repository]);
  const [summary, setSummary] = useState<DailyReviewSummary | null>(null);
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await service.getSummary(date);
      setSummary(next);
      setReflection(next.review?.reflection ?? "");
    } catch (loadError) {
      console.error("Daily review loading failed", loadError);
      setError(messageFrom(loadError));
    } finally {
      setLoading(false);
    }
  }, [date, service]);

  useEffect(() => { void load(); }, [load]);

  async function saveReflection() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const review = await service.saveReflection(date, reflection);
      setSummary((current) => current ? { ...current, review } : current);
      setSaved(true);
    } catch (saveError) {
      console.error("Reflection save failed", saveError);
      setError(messageFrom(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function actOnOverdue(taskId: string, action: "tomorrow" | "inbox") {
    setBusyTaskId(taskId);
    setError(null);
    try {
      if (action === "tomorrow") await service.moveToTomorrow(taskId, date);
      else await service.returnToInbox(taskId, date);
      const next = await service.getSummary(date);
      setSummary(next);
    } catch (actionError) {
      console.error("Overdue task update failed", actionError);
      setError(messageFrom(actionError));
    } finally {
      setBusyTaskId(null);
    }
  }

  if (loading) return <section className="review-state" aria-busy="true"><p role="status">Gathering today’s progress…</p></section>;
  if (!summary) return <section className="review-state"><h2>Review couldn’t be loaded.</h2><p role="alert">{error}</p><div className="recovery-actions"><button className="button button-dark" type="button" onClick={() => void load()}>Try again</button><Link className="button" to="/settings">Open data controls</Link></div></section>;

  return (
    <div className="review-workspace">
      <section className="review-summary-card" aria-labelledby="review-summary-title">
        <div className="section-title-row">
          <div><p className="eyebrow">Today’s progress</p><h2 id="review-summary-title">What moved forward</h2></div>
          <span className="count-badge">{dateLabel(date)}</span>
        </div>
        <div className="review-stats">
          <div><strong>{summary.completedTasks.length}</strong><span>tasks completed</span></div>
          <div><strong>{summary.completedSessions.length}</strong><span>focus sessions</span></div>
        </div>
        {summary.completedTasks.length === 0 ? (
          <p className="review-empty-copy">Completed tasks will appear here. A quiet day still deserves a thoughtful close.</p>
        ) : (
          <ul className="review-completed-list">
            {summary.completedTasks.map((task) => <li key={task.id}><span aria-hidden="true">✓</span><strong>{task.title}</strong>{task.tag && <span className="tag-chip">{task.tag}</span>}</li>)}
          </ul>
        )}
      </section>

      <section className="reflection-card" aria-labelledby="reflection-title">
        <p className="eyebrow">Reflection</p>
        <h2 id="reflection-title">Leave a note for yourself.</h2>
        <label htmlFor="daily-reflection">What worked, what felt difficult, or what matters tomorrow?</label>
        <textarea id="daily-reflection" maxLength={500} rows={6} value={reflection} onChange={(event) => { setReflection(event.target.value); setSaved(false); }} />
        <div className="reflection-actions">
          <span>{reflection.length} / 500 characters</span>
          <button className="button button-dark" disabled={saving} type="button" onClick={() => void saveReflection()}>{saving ? "Saving…" : "Save reflection"}</button>
        </div>
        {saved && <p className="save-success" role="status">Reflection saved for {dateLabel(date)}.</p>}
      </section>

      <section className="overdue-card" aria-labelledby="overdue-title">
        <div className="section-title-row"><div><p className="eyebrow">Needs a decision</p><h2 id="overdue-title">Overdue tasks</h2></div><span className="count-badge">{summary.overdueTasks.length}</span></div>
        {summary.overdueTasks.length === 0 ? <p className="review-empty-copy">Nothing is trailing behind. Nicely closed.</p> : (
          <ul className="overdue-list">
            {summary.overdueTasks.map((task) => (
              <li key={task.id}>
                <div><strong>{task.title}</strong><span>Planned for {dateLabel(task.plannedFor ?? "")}</span></div>
                <div className="overdue-actions">
                  <button className="plan-today-button" disabled={busyTaskId === task.id} type="button" onClick={() => void actOnOverdue(task.id, "tomorrow")}>Move {task.title} to tomorrow</button>
                  <button className="text-button" disabled={busyTaskId === task.id} type="button" onClick={() => void actOnOverdue(task.id, "inbox")}>Return {task.title} to Inbox</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="history-card" aria-labelledby="history-title">
        <p className="eyebrow">Looking back</p><h2 id="history-title">Past reflections</h2>
        {summary.history.length === 0 ? <p className="review-empty-copy">Your saved reflections will collect here over time.</p> : (
          <ol className="review-history">
            {summary.history.map((review) => <li key={review.date}><time dateTime={review.date}>{dateLabel(review.date)}</time><p>{review.reflection || "No written reflection."}</p></li>)}
          </ol>
        )}
      </section>

      {error && <p className="action-error" role="alert">Review update failed: {error}</p>}
    </div>
  );
}
