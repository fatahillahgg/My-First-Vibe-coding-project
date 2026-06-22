import { DEFAULT_SETTINGS } from "../domain/models";
import type { ActiveTimerState, AppSettings, DailyReview, FocusSession, Task } from "../domain/models";
import { parseActiveTimerState, parseAppSettings, parseDailyReview, parseFocusSession, parseTask } from "../domain/validation";
import type { DeletedTaskData, DurableDataSet, MomentumRepository } from "./MomentumRepository";

export const MOMENTUM_DATABASE_NAME = "momentum";
export const MOMENTUM_DATABASE_VERSION = 1;

const stores = {
  tasks: "tasks",
  sessions: "focusSessions",
  reviews: "dailyReviews",
  settings: "settings",
  activeTimer: "activeTimer",
} as const;

const SETTINGS_KEY = "preferences";
const ACTIVE_TIMER_KEY = "current";

interface SettingsRecord extends AppSettings { key: typeof SETTINGS_KEY }
interface ActiveTimerRecord { key: typeof ACTIVE_TIMER_KEY; value: ActiveTimerState }

function recordField(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return Object.getOwnPropertyDescriptor(value, field)?.value;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed")), { once: true });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed")), { once: true });
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, MOMENTUM_DATABASE_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(stores.tasks)) database.createObjectStore(stores.tasks, { keyPath: "id" });
      if (!database.objectStoreNames.contains(stores.sessions)) database.createObjectStore(stores.sessions, { keyPath: "id" });
      if (!database.objectStoreNames.contains(stores.reviews)) database.createObjectStore(stores.reviews, { keyPath: "date" });
      if (!database.objectStoreNames.contains(stores.settings)) database.createObjectStore(stores.settings, { keyPath: "key" });
      if (!database.objectStoreNames.contains(stores.activeTimer)) database.createObjectStore(stores.activeTimer, { keyPath: "key" });
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Unable to open Momentum storage")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Momentum storage upgrade is blocked by another tab")), { once: true });
  });
}

export class IndexedDbMomentumRepository implements MomentumRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly databaseName = MOMENTUM_DATABASE_NAME) {}

  async initialize() { await this.database(); }

  close() {
    const pending = this.databasePromise;
    this.databasePromise = null;
    if (pending) void pending.then((database) => database.close());
  }

  private database() {
    this.databasePromise ??= openDatabase(this.databaseName);
    return this.databasePromise;
  }

  private async get(storeName: string, key: IDBValidKey): Promise<unknown> {
    const database = await this.database();
    const transaction = database.transaction(storeName, "readonly");
    return requestResult(transaction.objectStore(storeName).get(key));
  }

  private async getAll(storeName: string): Promise<unknown[]> {
    const database = await this.database();
    const transaction = database.transaction(storeName, "readonly");
    return requestResult(transaction.objectStore(storeName).getAll());
  }

  private async put(storeName: string, value: unknown): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionComplete(transaction);
  }

  private async putMany(storeName: string, values: unknown[]): Promise<void> {
    if (values.length === 0) return;
    const database = await this.database();
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    values.forEach((value) => store.put(value));
    await transactionComplete(transaction);
  }

  private async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    await transactionComplete(transaction);
  }

  async listTasks() { return (await this.getAll(stores.tasks)).map(parseTask); }
  async getTask(id: string) { const value = await this.get(stores.tasks, id); return value === undefined ? null : parseTask(value); }
  async putTask(task: Task) { await this.put(stores.tasks, parseTask(task)); }
  async putTasks(tasks: Task[]) { await this.putMany(stores.tasks, tasks.map(parseTask)); }
  async deleteTask(id: string) {
    const database = await this.database();
    const transaction = database.transaction([stores.tasks, stores.sessions, stores.activeTimer], "readwrite");
    const completion = transactionComplete(transaction);
    const [taskValue, sessionValues, activeRecord] = await Promise.all([
      requestResult(transaction.objectStore(stores.tasks).get(id)),
      requestResult(transaction.objectStore(stores.sessions).getAll()),
      requestResult(transaction.objectStore(stores.activeTimer).get(ACTIVE_TIMER_KEY)),
    ]);
    if (taskValue === undefined) {
      await completion;
      return null;
    }
    const task = parseTask(taskValue);
    const focusSessions = sessionValues.map(parseFocusSession).filter((session) => session.taskId === id);
    const storedTimer = activeRecord === undefined ? null : parseActiveTimerState(recordField(activeRecord, "value"));
    const activeTimer = storedTimer?.taskId === id ? storedTimer : null;
    transaction.objectStore(stores.tasks).delete(id);
    focusSessions.forEach((session) => transaction.objectStore(stores.sessions).delete(session.id));
    if (activeTimer) transaction.objectStore(stores.activeTimer).delete(ACTIVE_TIMER_KEY);
    await completion;
    return { task, focusSessions, activeTimer };
  }

  async restoreDeletedTask(data: DeletedTaskData) {
    const task = parseTask(data.task);
    const sessions = data.focusSessions.map(parseFocusSession);
    const activeTimer = data.activeTimer === null ? null : parseActiveTimerState(data.activeTimer);
    if (sessions.some((session) => session.taskId !== task.id) || (activeTimer && activeTimer.taskId !== task.id)) {
      throw new Error("Deleted task snapshot contains mismatched references");
    }
    const database = await this.database();
    const transaction = database.transaction([stores.tasks, stores.sessions, stores.activeTimer], "readwrite");
    const completion = transactionComplete(transaction);
    if (activeTimer) {
      const current = await requestResult(transaction.objectStore(stores.activeTimer).get(ACTIVE_TIMER_KEY));
      if (current !== undefined) {
        transaction.abort();
        await completion.catch(() => undefined);
        throw new Error("Another focus timer is already active");
      }
    }
    transaction.objectStore(stores.tasks).put(task);
    sessions.forEach((session) => transaction.objectStore(stores.sessions).put(session));
    if (activeTimer) transaction.objectStore(stores.activeTimer).put({ key: ACTIVE_TIMER_KEY, value: activeTimer } satisfies ActiveTimerRecord);
    await completion;
  }

  async listFocusSessions() { return (await this.getAll(stores.sessions)).map(parseFocusSession); }
  async getFocusSession(id: string) { const value = await this.get(stores.sessions, id); return value === undefined ? null : parseFocusSession(value); }
  async putFocusSession(session: FocusSession) { await this.put(stores.sessions, parseFocusSession(session)); }
  async deleteFocusSession(id: string) { await this.delete(stores.sessions, id); }

  async listDailyReviews() { return (await this.getAll(stores.reviews)).map(parseDailyReview); }
  async getDailyReview(date: string) { const value = await this.get(stores.reviews, date); return value === undefined ? null : parseDailyReview(value); }
  async putDailyReview(review: DailyReview) { await this.put(stores.reviews, parseDailyReview(review)); }
  async deleteDailyReview(date: string) { await this.delete(stores.reviews, date); }

  async getSettings() {
    const value = await this.get(stores.settings, SETTINGS_KEY);
    if (value === undefined) return { ...DEFAULT_SETTINGS };
    return parseAppSettings(value);
  }

  async putSettings(settings: AppSettings) {
    const parsed = parseAppSettings(settings);
    await this.put(stores.settings, { key: SETTINGS_KEY, ...parsed } satisfies SettingsRecord);
  }

  async getActiveTimer() {
    const value = await this.get(stores.activeTimer, ACTIVE_TIMER_KEY);
    if (value === undefined) return null;
    return parseActiveTimerState(recordField(value, "value"));
  }

  async setActiveTimer(timer: ActiveTimerState | null) {
    if (timer === null) {
      await this.delete(stores.activeTimer, ACTIVE_TIMER_KEY);
      return;
    }
    await this.put(stores.activeTimer, {
      key: ACTIVE_TIMER_KEY,
      value: parseActiveTimerState(timer),
    } satisfies ActiveTimerRecord);
  }

  async startFocusSession(session: FocusSession, timer: ActiveTimerState) {
    const parsedSession = parseFocusSession(session);
    const parsedTimer = parseActiveTimerState(timer);
    if (parsedSession.id !== parsedTimer.sessionId || parsedSession.taskId !== parsedTimer.taskId) {
      throw new Error("Focus session and timer do not match");
    }

    const database = await this.database();
    const transaction = database.transaction([stores.sessions, stores.activeTimer], "readwrite");
    const activeStore = transaction.objectStore(stores.activeTimer);
    const existing = await requestResult(activeStore.get(ACTIVE_TIMER_KEY));
    if (existing !== undefined) {
      transaction.abort();
      await transactionComplete(transaction).catch(() => undefined);
      throw new Error("A focus session is already active");
    }
    transaction.objectStore(stores.sessions).put(parsedSession);
    activeStore.put({ key: ACTIVE_TIMER_KEY, value: parsedTimer } satisfies ActiveTimerRecord);
    await transactionComplete(transaction);
  }

  async finishFocusSession(session: FocusSession) {
    const parsed = parseFocusSession(session);
    const database = await this.database();
    const transaction = database.transaction([stores.sessions, stores.activeTimer], "readwrite");
    const activeStore = transaction.objectStore(stores.activeTimer);
    const existing = await requestResult(activeStore.get(ACTIVE_TIMER_KEY));
    const activeValue = existing === undefined ? null : parseActiveTimerState(recordField(existing, "value"));
    if (activeValue?.sessionId !== parsed.id) {
      transaction.abort();
      await transactionComplete(transaction).catch(() => undefined);
      throw new Error("The active focus session changed");
    }
    transaction.objectStore(stores.sessions).put(parsed);
    activeStore.delete(ACTIVE_TIMER_KEY);
    await transactionComplete(transaction);
  }

  async replaceDurableData(data: DurableDataSet) {
    const tasks = data.tasks.map(parseTask);
    const sessions = data.focusSessions.map(parseFocusSession);
    const reviews = data.dailyReviews.map(parseDailyReview);
    const settings = parseAppSettings(data.settings);
    const database = await this.database();
    const transaction = database.transaction(Object.values(stores), "readwrite");
    const completion = transactionComplete(transaction);
    Object.values(stores).forEach((storeName) => transaction.objectStore(storeName).clear());
    tasks.forEach((task) => transaction.objectStore(stores.tasks).put(task));
    sessions.forEach((session) => transaction.objectStore(stores.sessions).put(session));
    reviews.forEach((review) => transaction.objectStore(stores.reviews).put(review));
    transaction.objectStore(stores.settings).put({ key: SETTINGS_KEY, ...settings } satisfies SettingsRecord);
    await completion;
  }

  async clearAllData() {
    const database = await this.database();
    const transaction = database.transaction(Object.values(stores), "readwrite");
    const completion = transactionComplete(transaction);
    Object.values(stores).forEach((storeName) => transaction.objectStore(storeName).clear());
    await completion;
  }
}

export function deleteMomentumDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Unable to delete test database")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Database deletion is blocked")), { once: true });
  });
}
