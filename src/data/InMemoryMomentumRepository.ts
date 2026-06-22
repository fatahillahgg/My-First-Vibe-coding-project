import { DEFAULT_SETTINGS } from "../domain/models";
import type { ActiveTimerState, AppSettings, DailyReview, FocusSession, Task } from "../domain/models";
import { parseActiveTimerState, parseAppSettings, parseDailyReview, parseFocusSession, parseTask } from "../domain/validation";
import type { DeletedTaskData, DurableDataSet, MomentumRepository } from "./MomentumRepository";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryMomentumRepository implements MomentumRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly sessions = new Map<string, FocusSession>();
  private readonly reviews = new Map<string, DailyReview>();
  private settings: AppSettings = clone(DEFAULT_SETTINGS);
  private activeTimer: ActiveTimerState | null = null;

  async initialize() {}

  close() {}

  async listTasks() { return [...this.tasks.values()].map(clone); }
  async getTask(id: string) { return clone(this.tasks.get(id) ?? null); }
  async putTask(task: Task) { const parsed = parseTask(task); this.tasks.set(parsed.id, clone(parsed)); }
  async putTasks(tasks: Task[]) {
    const parsed = tasks.map(parseTask);
    parsed.forEach((task) => this.tasks.set(task.id, clone(task)));
  }
  async deleteTask(id: string) {
    const task = this.tasks.get(id);
    if (!task) return null;
    const focusSessions = [...this.sessions.values()].filter((session) => session.taskId === id);
    const activeTimer = this.activeTimer?.taskId === id ? this.activeTimer : null;
    this.tasks.delete(id);
    focusSessions.forEach((session) => this.sessions.delete(session.id));
    if (activeTimer) this.activeTimer = null;
    return clone({ task, focusSessions, activeTimer });
  }
  async restoreDeletedTask(data: DeletedTaskData) {
    const task = parseTask(data.task);
    const sessions = data.focusSessions.map(parseFocusSession);
    const activeTimer = data.activeTimer === null ? null : parseActiveTimerState(data.activeTimer);
    if (sessions.some((session) => session.taskId !== task.id) || (activeTimer && activeTimer.taskId !== task.id)) {
      throw new Error("Deleted task snapshot contains mismatched references");
    }
    if (activeTimer && this.activeTimer) throw new Error("Another focus timer is already active");
    this.tasks.set(task.id, clone(task));
    sessions.forEach((session) => this.sessions.set(session.id, clone(session)));
    if (activeTimer) this.activeTimer = clone(activeTimer);
  }

  async listFocusSessions() { return [...this.sessions.values()].map(clone); }
  async getFocusSession(id: string) { return clone(this.sessions.get(id) ?? null); }
  async putFocusSession(session: FocusSession) { const parsed = parseFocusSession(session); this.sessions.set(parsed.id, clone(parsed)); }
  async deleteFocusSession(id: string) { this.sessions.delete(id); }

  async listDailyReviews() { return [...this.reviews.values()].map(clone); }
  async getDailyReview(date: string) { return clone(this.reviews.get(date) ?? null); }
  async putDailyReview(review: DailyReview) { const parsed = parseDailyReview(review); this.reviews.set(parsed.date, clone(parsed)); }
  async deleteDailyReview(date: string) { this.reviews.delete(date); }

  async getSettings() { return clone(this.settings); }
  async putSettings(settings: AppSettings) { this.settings = clone(parseAppSettings(settings)); }

  async getActiveTimer() { return clone(this.activeTimer); }
  async setActiveTimer(timer: ActiveTimerState | null) {
    this.activeTimer = timer === null ? null : clone(parseActiveTimerState(timer));
  }

  async startFocusSession(session: FocusSession, timer: ActiveTimerState) {
    if (this.activeTimer !== null) throw new Error("A focus session is already active");
    const parsedSession = parseFocusSession(session);
    const parsedTimer = parseActiveTimerState(timer);
    if (parsedSession.id !== parsedTimer.sessionId || parsedSession.taskId !== parsedTimer.taskId) {
      throw new Error("Focus session and timer do not match");
    }
    this.sessions.set(parsedSession.id, clone(parsedSession));
    this.activeTimer = clone(parsedTimer);
  }

  async finishFocusSession(session: FocusSession) {
    const parsed = parseFocusSession(session);
    if (this.activeTimer?.sessionId !== parsed.id) throw new Error("The active focus session changed");
    this.sessions.set(parsed.id, clone(parsed));
    this.activeTimer = null;
  }

  async replaceDurableData(data: DurableDataSet) {
    const tasks = data.tasks.map(parseTask);
    const sessions = data.focusSessions.map(parseFocusSession);
    const reviews = data.dailyReviews.map(parseDailyReview);
    const settings = parseAppSettings(data.settings);
    this.tasks.clear();
    this.sessions.clear();
    this.reviews.clear();
    tasks.forEach((task) => this.tasks.set(task.id, clone(task)));
    sessions.forEach((session) => this.sessions.set(session.id, clone(session)));
    reviews.forEach((review) => this.reviews.set(review.date, clone(review)));
    this.settings = clone(settings);
    this.activeTimer = null;
  }

  async clearAllData() {
    this.tasks.clear();
    this.sessions.clear();
    this.reviews.clear();
    this.settings = clone(DEFAULT_SETTINGS);
    this.activeTimer = null;
  }
}
