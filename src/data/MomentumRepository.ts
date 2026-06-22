import type { ActiveTimerState, AppSettings, DailyReview, FocusSession, Task } from "../domain/models";

export interface DurableDataSet {
  tasks: Task[];
  focusSessions: FocusSession[];
  dailyReviews: DailyReview[];
  settings: AppSettings;
}

export interface DeletedTaskData {
  task: Task;
  focusSessions: FocusSession[];
  activeTimer: ActiveTimerState | null;
}

export interface MomentumRepository {
  initialize(): Promise<void>;
  close(): void;

  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  putTask(task: Task): Promise<void>;
  putTasks(tasks: Task[]): Promise<void>;
  deleteTask(id: string): Promise<DeletedTaskData | null>;
  restoreDeletedTask(data: DeletedTaskData): Promise<void>;

  listFocusSessions(): Promise<FocusSession[]>;
  getFocusSession(id: string): Promise<FocusSession | null>;
  putFocusSession(session: FocusSession): Promise<void>;
  deleteFocusSession(id: string): Promise<void>;

  listDailyReviews(): Promise<DailyReview[]>;
  getDailyReview(date: string): Promise<DailyReview | null>;
  putDailyReview(review: DailyReview): Promise<void>;
  deleteDailyReview(date: string): Promise<void>;

  getSettings(): Promise<AppSettings>;
  putSettings(settings: AppSettings): Promise<void>;

  getActiveTimer(): Promise<ActiveTimerState | null>;
  setActiveTimer(timer: ActiveTimerState | null): Promise<void>;
  startFocusSession(session: FocusSession, timer: ActiveTimerState): Promise<void>;
  finishFocusSession(session: FocusSession): Promise<void>;
  replaceDurableData(data: DurableDataSet): Promise<void>;
  clearAllData(): Promise<void>;
}
