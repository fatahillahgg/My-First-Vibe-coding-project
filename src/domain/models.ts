export type TaskStatus = "inbox" | "today" | "completed";

export interface Task {
  id: string;
  title: string;
  notes: string;
  tag: string | null;
  estimatedSessions: number;
  status: TaskStatus;
  plannedFor: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type FocusSessionOutcome = "completed" | "cancelled";

export interface FocusSession {
  id: string;
  taskId: string;
  plannedMinutes: FocusDurationMinutes;
  startedAt: string;
  endedAt: string | null;
  outcome: FocusSessionOutcome;
}

export interface DailyReview {
  date: string;
  reflection: string;
  createdAt: string;
  updatedAt: string;
}

interface ActiveTimerBase {
  sessionId: string;
  taskId: string;
  startedAt: string;
  updatedAt: string;
}

export interface RunningTimerState extends ActiveTimerBase {
  status: "running";
  targetEndAt: string;
  remainingMsWhenPaused: null;
}

export interface PausedTimerState extends ActiveTimerBase {
  status: "paused";
  targetEndAt: null;
  remainingMsWhenPaused: number;
}

export type ActiveTimerState = RunningTimerState | PausedTimerState;

export type ThemePreference = "light" | "dark" | "system";
export type FocusDurationMinutes = 15 | 25 | 45 | 60;

export interface AppSettings {
  theme: ThemePreference;
  focusDurationMinutes: FocusDurationMinutes;
}

export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  theme: "system",
  focusDurationMinutes: 25,
};
