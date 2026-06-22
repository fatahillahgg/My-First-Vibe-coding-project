import type { Task } from "../../domain/models";

export interface TaskDraft {
  title: string;
  notes: string;
  tag: string;
  estimatedSessions: number;
}

export interface TaskDraftErrors {
  title?: string;
  estimatedSessions?: string;
}

export const EMPTY_TASK_DRAFT: Readonly<TaskDraft> = {
  title: "",
  notes: "",
  tag: "",
  estimatedSessions: 1,
};

export function validateTaskDraft(draft: TaskDraft): TaskDraftErrors {
  const errors: TaskDraftErrors = {};
  if (draft.title.trim().length === 0) errors.title = "Add a title so you can recognize this task.";
  if (!Number.isInteger(draft.estimatedSessions) || draft.estimatedSessions < 1 || draft.estimatedSessions > 8) {
    errors.estimatedSessions = "Choose an estimate from 1 to 8 focus sessions.";
  }
  return errors;
}

export function taskToDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    notes: task.notes,
    tag: task.tag ?? "",
    estimatedSessions: task.estimatedSessions,
  };
}

export function createInboxTask(
  draft: TaskDraft,
  position: number,
  now = new Date(),
  id = crypto.randomUUID(),
): Task {
  const timestamp = now.toISOString();
  return {
    id,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    tag: draft.tag.trim() || null,
    estimatedSessions: draft.estimatedSessions,
    status: "inbox",
    plannedFor: null,
    position,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

export function updateTaskFromDraft(task: Task, draft: TaskDraft, now = new Date()): Task {
  return {
    ...task,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    tag: draft.tag.trim() || null,
    estimatedSessions: draft.estimatedSessions,
    updatedAt: now.toISOString(),
  };
}
