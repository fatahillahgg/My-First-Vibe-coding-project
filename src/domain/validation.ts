import { isIsoTimestamp, isLocalDate } from "./date";
import type {
  ActiveTimerState,
  AppSettings,
  DailyReview,
  FocusDurationMinutes,
  FocusSession,
  Task,
  TaskStatus,
  ThemePreference,
} from "./models";

export class DomainValidationError extends Error {
  constructor(entity: string, detail: string) {
    super(`Invalid ${entity}: ${detail}`);
    this.name = "DomainValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, entity: string): Record<string, unknown> {
  if (!isRecord(value)) throw new DomainValidationError(entity, "expected an object");
  return value;
}

function requireString(value: unknown, entity: string, field: string): string {
  if (typeof value !== "string") throw new DomainValidationError(entity, `${field} must be a string`);
  return value;
}

function requireId(value: unknown, entity: string, field: string): string {
  const id = requireString(value, entity, field);
  if (id.trim().length === 0) throw new DomainValidationError(entity, `${field} cannot be empty`);
  return id;
}

function requireTimestamp(value: unknown, entity: string, field: string): string {
  if (!isIsoTimestamp(value)) throw new DomainValidationError(entity, `${field} must be a canonical ISO timestamp`);
  return value;
}

function nullableString(value: unknown, entity: string, field: string): string | null {
  if (value === null) return null;
  return requireString(value, entity, field);
}

function nullableTimestamp(value: unknown, entity: string, field: string): string | null {
  if (value === null) return null;
  return requireTimestamp(value, entity, field);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "inbox" || value === "today" || value === "completed";
}

function isTheme(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function isFocusDuration(value: unknown): value is FocusDurationMinutes {
  return value === 15 || value === 25 || value === 45 || value === 60;
}

export function parseTask(value: unknown): Task {
  const source = requireRecord(value, "task");
  const title = requireString(source.title, "task", "title");
  const estimatedSessions = source.estimatedSessions;
  const position = source.position;

  if (!Number.isInteger(estimatedSessions) || Number(estimatedSessions) < 1 || Number(estimatedSessions) > 8) {
    throw new DomainValidationError("task", "estimatedSessions must be an integer from 1 to 8");
  }
  if (!Number.isInteger(position) || Number(position) < 0) {
    throw new DomainValidationError("task", "position must be a non-negative integer");
  }
  if (title.trim().length === 0) {
    throw new DomainValidationError("task", "title cannot be empty");
  }
  if (!isTaskStatus(source.status)) {
    throw new DomainValidationError("task", "status is not supported");
  }
  if (source.plannedFor !== null && !isLocalDate(source.plannedFor)) {
    throw new DomainValidationError("task", "plannedFor must be null or a local date");
  }
  const completedAt = nullableTimestamp(source.completedAt, "task", "completedAt");
  if (source.status === "completed" && completedAt === null) {
    throw new DomainValidationError("task", "a completed task requires completedAt");
  }
  if (source.status !== "completed" && completedAt !== null) {
    throw new DomainValidationError("task", "an incomplete task cannot have completedAt");
  }
  if (source.status === "inbox" && source.plannedFor !== null) {
    throw new DomainValidationError("task", "an Inbox task cannot have plannedFor");
  }
  if (source.status !== "inbox" && source.plannedFor === null) {
    throw new DomainValidationError("task", "a planned or completed task requires plannedFor");
  }

  return {
    id: requireId(source.id, "task", "id"),
    title,
    notes: requireString(source.notes, "task", "notes"),
    tag: nullableString(source.tag, "task", "tag"),
    estimatedSessions: Number(estimatedSessions),
    status: source.status,
    plannedFor: source.plannedFor,
    position: Number(position),
    createdAt: requireTimestamp(source.createdAt, "task", "createdAt"),
    updatedAt: requireTimestamp(source.updatedAt, "task", "updatedAt"),
    completedAt,
  };
}

export function parseFocusSession(value: unknown): FocusSession {
  const source = requireRecord(value, "focus session");
  if (!isFocusDuration(source.plannedMinutes)) {
    throw new DomainValidationError("focus session", "plannedMinutes is not supported");
  }
  if (source.outcome !== "completed" && source.outcome !== "cancelled") {
    throw new DomainValidationError("focus session", "outcome is not supported");
  }
  if (source.outcome === "completed" && source.endedAt === null) {
    throw new DomainValidationError("focus session", "a completed session requires endedAt");
  }

  return {
    id: requireId(source.id, "focus session", "id"),
    taskId: requireId(source.taskId, "focus session", "taskId"),
    plannedMinutes: source.plannedMinutes,
    startedAt: requireTimestamp(source.startedAt, "focus session", "startedAt"),
    endedAt: nullableTimestamp(source.endedAt, "focus session", "endedAt"),
    outcome: source.outcome,
  };
}

export function parseDailyReview(value: unknown): DailyReview {
  const source = requireRecord(value, "daily review");
  const reflection = requireString(source.reflection, "daily review", "reflection");
  if (!isLocalDate(source.date)) throw new DomainValidationError("daily review", "date must be a local date");
  if (reflection.length > 500) throw new DomainValidationError("daily review", "reflection exceeds 500 characters");

  return {
    date: source.date,
    reflection,
    createdAt: requireTimestamp(source.createdAt, "daily review", "createdAt"),
    updatedAt: requireTimestamp(source.updatedAt, "daily review", "updatedAt"),
  };
}

export function parseAppSettings(value: unknown): AppSettings {
  const source = requireRecord(value, "settings");
  if (!isTheme(source.theme)) throw new DomainValidationError("settings", "theme is not supported");
  if (!isFocusDuration(source.focusDurationMinutes)) {
    throw new DomainValidationError("settings", "focusDurationMinutes is not supported");
  }
  return { theme: source.theme, focusDurationMinutes: source.focusDurationMinutes };
}

export function parseActiveTimerState(value: unknown): ActiveTimerState {
  const source = requireRecord(value, "active timer");
  const base = {
    sessionId: requireId(source.sessionId, "active timer", "sessionId"),
    taskId: requireId(source.taskId, "active timer", "taskId"),
    startedAt: requireTimestamp(source.startedAt, "active timer", "startedAt"),
    updatedAt: requireTimestamp(source.updatedAt, "active timer", "updatedAt"),
  };

  if (source.status === "running") {
    if (source.remainingMsWhenPaused !== null) {
      throw new DomainValidationError("active timer", "a running timer cannot have a paused remainder");
    }
    return {
      ...base,
      status: "running",
      targetEndAt: requireTimestamp(source.targetEndAt, "active timer", "targetEndAt"),
      remainingMsWhenPaused: null,
    };
  }

  if (source.status === "paused") {
    if (source.targetEndAt !== null) {
      throw new DomainValidationError("active timer", "a paused timer cannot have a target end");
    }
    if (typeof source.remainingMsWhenPaused !== "number" || !Number.isFinite(source.remainingMsWhenPaused) || source.remainingMsWhenPaused <= 0) {
      throw new DomainValidationError("active timer", "a paused timer requires a positive remaining duration");
    }
    return {
      ...base,
      status: "paused",
      targetEndAt: null,
      remainingMsWhenPaused: source.remainingMsWhenPaused,
    };
  }

  throw new DomainValidationError("active timer", "status is not supported");
}
