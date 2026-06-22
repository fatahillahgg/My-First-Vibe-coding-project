import type { ActiveTimerState, FocusDurationMinutes, FocusSession, Task } from "../domain/models";
import type { MomentumRepository } from "../data/MomentumRepository";

const MINUTE_MS = 60_000;

export class FocusTimerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FocusTimerError";
  }
}

export type FocusTimerSnapshot =
  | { status: "idle"; remainingMs: 0; task: null; session: null }
  | { status: "running" | "paused"; remainingMs: number; task: Task; session: FocusSession; timer: ActiveTimerState }
  | { status: "completed" | "cancelled"; remainingMs: 0; task: Task; session: FocusSession };

function timestamp(date: Date) {
  return date.toISOString();
}

export function calculateRemainingMs(
  timer: ActiveTimerState,
  now: Date,
  plannedMinutes: FocusDurationMinutes,
) {
  const maximum = plannedMinutes * MINUTE_MS;
  const raw = timer.status === "paused"
    ? timer.remainingMsWhenPaused
    : Date.parse(timer.targetEndAt) - now.getTime();
  return Math.min(maximum, Math.max(0, raw));
}

export class FocusTimerService {
  private operation = Promise.resolve<unknown>(undefined);

  constructor(
    private readonly repository: MomentumRepository,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const result = this.operation.then(action, action);
    this.operation = result;
    return result;
  }

  async load(now = new Date()): Promise<FocusTimerSnapshot> {
    return this.serialize(() => this.loadCurrent(now));
  }

  private async loadCurrent(now: Date): Promise<FocusTimerSnapshot> {
    const timer = await this.repository.getActiveTimer();
    if (!timer) return { status: "idle", remainingMs: 0, task: null, session: null };

    const [session, task] = await Promise.all([
      this.repository.getFocusSession(timer.sessionId),
      this.repository.getTask(timer.taskId),
    ]);
    if (!session || !task) throw new FocusTimerError("The active timer references missing data");

    const remainingMs = calculateRemainingMs(timer, now, session.plannedMinutes);
    if (timer.status === "running" && remainingMs === 0) {
      return this.finish(session, task, "completed", new Date(timer.targetEndAt));
    }
    return { status: timer.status, remainingMs, task, session, timer };
  }

  start(taskId: string, plannedMinutes: FocusDurationMinutes, now = new Date()) {
    return this.serialize(async (): Promise<FocusTimerSnapshot> => {
      const task = await this.repository.getTask(taskId);
      if (!task || task.status !== "today" || task.completedAt !== null) {
        throw new FocusTimerError("Choose an incomplete task from Today before starting focus");
      }

      const startedAt = timestamp(now);
      const session: FocusSession = {
        id: this.createId(),
        taskId,
        plannedMinutes,
        startedAt,
        endedAt: null,
        outcome: "cancelled",
      };
      const timer: ActiveTimerState = {
        sessionId: session.id,
        taskId,
        status: "running",
        startedAt,
        targetEndAt: timestamp(new Date(now.getTime() + plannedMinutes * MINUTE_MS)),
        remainingMsWhenPaused: null,
        updatedAt: startedAt,
      };
      await this.repository.startFocusSession(session, timer);
      return { status: "running", remainingMs: plannedMinutes * MINUTE_MS, task, session, timer };
    });
  }

  pause(now = new Date()) {
    return this.serialize(async (): Promise<FocusTimerSnapshot> => {
      const current = await this.requireCurrent(now, "running");
      if (current.remainingMs === 0) {
        return this.finish(current.session, current.task, "completed", new Date(current.timer.targetEndAt!));
      }
      const updatedAt = timestamp(now);
      const timer: ActiveTimerState = {
        ...current.timer,
        status: "paused",
        targetEndAt: null,
        remainingMsWhenPaused: current.remainingMs,
        updatedAt,
      };
      await this.repository.setActiveTimer(timer);
      return { ...current, status: "paused", timer };
    });
  }

  resume(now = new Date()) {
    return this.serialize(async (): Promise<FocusTimerSnapshot> => {
      const current = await this.requireCurrent(now, "paused");
      const updatedAt = timestamp(now);
      const timer: ActiveTimerState = {
        ...current.timer,
        status: "running",
        targetEndAt: timestamp(new Date(now.getTime() + current.remainingMs)),
        remainingMsWhenPaused: null,
        updatedAt,
      };
      await this.repository.setActiveTimer(timer);
      return { ...current, status: "running", timer };
    });
  }

  cancel(now = new Date()) {
    return this.serialize(async () => {
      const current = await this.requireCurrent(now);
      return this.finish(current.session, current.task, "cancelled", now);
    });
  }

  private async requireCurrent(now: Date, expected?: "running" | "paused") {
    const current = await this.loadCurrentWithoutFinishing(now);
    if (current.status === "idle") throw new FocusTimerError("No focus session is active");
    if (expected && current.status !== expected) throw new FocusTimerError(`The focus session is not ${expected}`);
    return current;
  }

  private async loadCurrentWithoutFinishing(now: Date) {
    const timer = await this.repository.getActiveTimer();
    if (!timer) return { status: "idle" as const };
    const [session, task] = await Promise.all([
      this.repository.getFocusSession(timer.sessionId),
      this.repository.getTask(timer.taskId),
    ]);
    if (!session || !task) throw new FocusTimerError("The active timer references missing data");
    return {
      status: timer.status,
      remainingMs: calculateRemainingMs(timer, now, session.plannedMinutes),
      timer,
      session,
      task,
    };
  }

  private async finish(
    session: FocusSession,
    task: Task,
    outcome: "completed" | "cancelled",
    endedAt: Date,
  ): Promise<FocusTimerSnapshot> {
    const finished = { ...session, endedAt: timestamp(endedAt), outcome };
    await this.repository.finishFocusSession(finished);
    return { status: outcome, remainingMs: 0, task, session: finished };
  }
}
