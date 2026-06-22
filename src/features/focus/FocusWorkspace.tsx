import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppSettings, useMomentumRepository } from "../../app/ApplicationDataContext";
import { formatLocalDate } from "../../domain/date";
import type { FocusDurationMinutes, Task } from "../../domain/models";
import { FocusTimerService, type FocusTimerSnapshot } from "../../services/FocusTimerService";

type LoadState = "loading" | "ready" | "error";
type NotificationState = "unsupported" | NotificationPermission;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unknown storage error occurred";
}

function notificationState(): NotificationState {
  return "Notification" in window ? Notification.permission : "unsupported";
}

function formatTimer(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function FocusWorkspace() {
  const repository = useMomentumRepository();
  const { settings, saveSettings } = useAppSettings();
  const service = useMemo(() => new FocusTimerService(repository), [repository]);
  const [searchParams] = useSearchParams();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [snapshot, setSnapshot] = useState<FocusTimerSnapshot>({ status: "idle", remainingMs: 0, task: null, session: null });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState(searchParams.get("task") ?? "");
  const [duration, setDuration] = useState<FocusDurationMinutes>(25);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<NotificationState>(notificationState);

  const notifyCompleted = useCallback((result: FocusTimerSnapshot) => {
    if (result.status === "completed" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Focus session complete", { body: `${result.task.title} is ready for your next step.` });
    }
  }, []);

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const [allTasks, current] = await Promise.all([
        repository.listTasks(),
        service.load(),
      ]);
      const today = formatLocalDate(new Date());
      const available = allTasks
        .filter((task) => task.status === "today" && task.plannedFor === today && task.completedAt === null)
        .sort((left, right) => left.position - right.position);
      setTasks(available);
      setDuration(settings.focusDurationMinutes);
      setSelectedTaskId((selected) => available.some((task) => task.id === selected) ? selected : (available[0]?.id ?? ""));
      setSnapshot((previous) => (
        current.status === "idle" && (previous.status === "completed" || previous.status === "cancelled")
          ? previous
          : current
      ));
      notifyCompleted(current);
      setLoadState("ready");
    } catch (loadError) {
      console.error("Focus workspace loading failed", loadError);
      setError(errorMessage(loadError));
      setLoadState("error");
    }
  }, [notifyCompleted, repository, service, settings.focusDurationMinutes]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (snapshot.status !== "running") return;
    const interval = window.setInterval(() => {
      void service.load().then((next) => {
        setSnapshot(next);
        notifyCompleted(next);
      }).catch((tickError: unknown) => {
        console.error("Focus timer update failed", tickError);
        setError(errorMessage(tickError));
      });
    }, 500);
    return () => window.clearInterval(interval);
  }, [notifyCompleted, service, snapshot.status]);

  const perform = useCallback(async (action: () => Promise<FocusTimerSnapshot>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setSnapshot(next);
      notifyCompleted(next);
    } catch (actionError) {
      console.error("Focus timer action failed", actionError);
      setError(errorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }, [notifyCompleted]);

  async function changeDuration(value: string) {
    const next = Number(value) as FocusDurationMinutes;
    setDuration(next);
    try {
      await saveSettings({ ...settings, focusDurationMinutes: next });
    } catch (settingsError) {
      console.error("Focus duration update failed", settingsError);
      setError(errorMessage(settingsError));
    }
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifications(permission);
  }

  function cancel() {
    if (snapshot.status !== "running" && snapshot.status !== "paused") return;
    const plannedMs = snapshot.session.plannedMinutes * 60_000;
    const hasProgress = snapshot.remainingMs < plannedMs;
    if (hasProgress && !window.confirm("Cancel this focus session? Its progress will not count as completed.")) return;
    void perform(() => service.cancel());
  }

  if (loadState === "loading") {
    return <section className="focus-card focus-state" aria-busy="true"><p role="status">Recovering your focus timer…</p></section>;
  }
  if (loadState === "error") {
    return <section className="focus-card focus-state"><h2>Focus couldn’t be loaded.</h2><p role="alert">{error}</p><div className="recovery-actions"><button className="button button-dark" type="button" onClick={() => void load()}>Try again</button><Link className="button" to="/settings">Open data controls</Link></div></section>;
  }

  const active = snapshot.status === "running" || snapshot.status === "paused";
  const task = active || snapshot.status === "completed" || snapshot.status === "cancelled" ? snapshot.task : null;

  return (
    <section className="focus-card" aria-label="Focus timer">
      {active ? (
        <>
          <p className="eyebrow">{snapshot.status === "paused" ? "Session paused" : "Focus in progress"}</p>
          <h2>{task?.title}</h2>
          <div className="timer-face" role="timer" aria-label={`${formatTimer(snapshot.remainingMs)} remaining`}>
            {formatTimer(snapshot.remainingMs).split(":").map((part, index) => index === 0 ? part : <span key={part}>:{part}</span>)}
          </div>
          <p>{snapshot.session.plannedMinutes}-minute session · time stays accurate if you refresh.</p>
          <div className="focus-controls">
            {snapshot.status === "running" ? (
              <button className="button button-dark" disabled={busy} type="button" onClick={() => void perform(() => service.pause())}>Pause</button>
            ) : (
              <button className="button button-dark" disabled={busy} type="button" onClick={() => void perform(() => service.resume())}>Resume</button>
            )}
            <button className="button focus-cancel" disabled={busy} type="button" onClick={cancel}>Cancel session</button>
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow">{snapshot.status === "completed" ? "Session complete" : snapshot.status === "cancelled" ? "Session cancelled" : "Ready when you are"}</p>
          <h2>{snapshot.status === "completed" ? `Nice work on ${task?.title}.` : "Choose one priority."}</h2>
          {tasks.length === 0 ? (
            <div className="focus-empty"><p>Plan an incomplete task for today before starting a focus session.</p><Link className="button" to="/inbox">Visit your inbox</Link></div>
          ) : (
            <div className="focus-setup">
              <label>Task<select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)}>{tasks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
              <label>Session length<select aria-label="Session length" value={duration} onChange={(event) => void changeDuration(event.target.value)}>{[15, 25, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
              <button className="button button-dark" disabled={busy || !selectedTaskId} type="button" onClick={() => void perform(() => service.start(selectedTaskId, duration))}>Start focus session</button>
            </div>
          )}
        </>
      )}

      <div className="notification-row">
        <div><strong>Completion notification</strong><span>{notifications === "granted" ? "Enabled" : notifications === "denied" ? "Blocked by your browser" : notifications === "unsupported" ? "Not supported in this browser" : "Optional"}</span></div>
        {notifications === "default" && <button className="text-button" type="button" onClick={() => void requestNotifications()}>Enable notifications</button>}
      </div>
      {error && <p className="action-error" role="alert">Focus action failed: {error}</p>}
    </section>
  );
}
