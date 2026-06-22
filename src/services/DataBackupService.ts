import type { MomentumRepository, DurableDataSet } from "../data/MomentumRepository";
import type { AppSettings, DailyReview, FocusSession, Task } from "../domain/models";
import { isIsoTimestamp } from "../domain/date";
import { parseAppSettings, parseDailyReview, parseFocusSession, parseTask } from "../domain/validation";
import { DAILY_TASK_LIMIT } from "./TaskPlanningService";

export const BACKUP_FORMAT = "momentum-backup";
export const BACKUP_FORMAT_VERSION = 1;

export interface MomentumBackup {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  data: DurableDataSet;
}

export interface ImportSummary {
  tasks: number;
  focusSessions: number;
  dailyReviews: number;
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(`Invalid Momentum backup: ${message}`);
    this.name = "BackupValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new BackupValidationError(`${label} must be an object`);
  return Object.fromEntries(Object.entries(value));
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new BackupValidationError(`${label} must be an array`);
  return value;
}

function requireKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new BackupValidationError(`${label} contains unsupported field ${unexpected}`);
}

function unique<T>(values: T[], key: (value: T) => string, label: string) {
  const keys = new Set<string>();
  values.forEach((value) => {
    const itemKey = key(value);
    if (keys.has(itemKey)) throw new BackupValidationError(`${label} contains duplicate key ${itemKey}`);
    keys.add(itemKey);
  });
}

export function validateBackup(value: unknown): MomentumBackup {
  const root = record(value, "backup");
  requireKeys(root, ["format", "formatVersion", "exportedAt", "data"], "backup");
  if (root.format !== BACKUP_FORMAT) throw new BackupValidationError("format is not supported");
  if (root.formatVersion !== BACKUP_FORMAT_VERSION) throw new BackupValidationError("formatVersion is not supported");
  if (!isIsoTimestamp(root.exportedAt)) throw new BackupValidationError("exportedAt must be a canonical ISO timestamp");
  const source = record(root.data, "data");
  requireKeys(source, ["tasks", "focusSessions", "dailyReviews", "settings"], "data");

  let tasks: Task[];
  let focusSessions: FocusSession[];
  let dailyReviews: DailyReview[];
  let settings: AppSettings;
  try {
    tasks = array(source.tasks, "data.tasks").map(parseTask);
    focusSessions = array(source.focusSessions, "data.focusSessions").map(parseFocusSession);
    dailyReviews = array(source.dailyReviews, "data.dailyReviews").map(parseDailyReview);
    settings = parseAppSettings(source.settings);
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    throw new BackupValidationError(error instanceof Error ? error.message : "data contains an invalid value");
  }

  unique(tasks, (task) => task.id, "tasks");
  unique(focusSessions, (session) => session.id, "focusSessions");
  unique(dailyReviews, (review) => review.date, "dailyReviews");
  const taskIds = new Set(tasks.map((task) => task.id));
  focusSessions.forEach((session) => {
    if (session.endedAt === null) throw new BackupValidationError(`focus session ${session.id} is still active`);
    if (!taskIds.has(session.taskId)) throw new BackupValidationError(`focus session ${session.id} references a missing task`);
  });
  const dailyCounts = new Map<string, number>();
  tasks.forEach((task) => {
    if (task.status !== "today" || task.plannedFor === null) return;
    const count = (dailyCounts.get(task.plannedFor) ?? 0) + 1;
    if (count > DAILY_TASK_LIMIT) throw new BackupValidationError(`plan ${task.plannedFor} exceeds the daily task limit`);
    dailyCounts.set(task.plannedFor, count);
  });

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: root.exportedAt,
    data: { tasks, focusSessions, dailyReviews, settings },
  };
}

export function parseBackupJson(contents: string): MomentumBackup {
  try {
    const parsed: unknown = JSON.parse(contents);
    return validateBackup(parsed);
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    throw new BackupValidationError("file is not valid JSON");
  }
}

export function validateBackupFile(file: Pick<File, "name" | "type">) {
  if (!file.name.toLowerCase().endsWith(".json")) throw new BackupValidationError("file name must end in .json");
  if (file.type !== "" && file.type !== "application/json") throw new BackupValidationError("file type must be JSON");
}

export class DataBackupService {
  constructor(
    private readonly repository: MomentumRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createBackup(): Promise<MomentumBackup> {
    const [tasks, sessions, dailyReviews, settings] = await Promise.all([
      this.repository.listTasks(),
      this.repository.listFocusSessions(),
      this.repository.listDailyReviews(),
      this.repository.getSettings(),
    ]);
    return validateBackup({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: this.now().toISOString(),
      data: {
        tasks,
        focusSessions: sessions.filter((session) => session.endedAt !== null),
        dailyReviews,
        settings,
      },
    });
  }

  async importBackup(backup: MomentumBackup) {
    const validated = validateBackup(backup);
    await this.repository.replaceDurableData(validated.data);
  }

  async eraseAll() {
    await this.repository.clearAllData();
  }

  summary(backup: MomentumBackup): ImportSummary {
    return {
      tasks: backup.data.tasks.length,
      focusSessions: backup.data.focusSessions.length,
      dailyReviews: backup.data.dailyReviews.length,
    };
  }
}
