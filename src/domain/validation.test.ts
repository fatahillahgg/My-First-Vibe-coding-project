import { describe, expect, it } from "vitest";
import { parseActiveTimerState, parseTask } from "./validation";

const baseTimer = {
  sessionId: "session-1",
  taskId: "task-1",
  startedAt: "2026-06-20T14:00:00.000Z",
  updatedAt: "2026-06-20T14:05:00.000Z",
};

describe("active timer validation", () => {
  it("accepts a running timer with only a target end", () => {
    expect(parseActiveTimerState({
      ...baseTimer,
      status: "running",
      targetEndAt: "2026-06-20T14:25:00.000Z",
      remainingMsWhenPaused: null,
    }).status).toBe("running");
  });

  it("accepts a paused timer with only a frozen remainder", () => {
    expect(parseActiveTimerState({
      ...baseTimer,
      status: "paused",
      targetEndAt: null,
      remainingMsWhenPaused: 1_200_000,
    }).status).toBe("paused");
  });

  it.each([
    { status: "running", targetEndAt: "2026-06-20T14:25:00.000Z", remainingMsWhenPaused: 1 },
    { status: "paused", targetEndAt: "2026-06-20T14:25:00.000Z", remainingMsWhenPaused: 100 },
    { status: "paused", targetEndAt: null, remainingMsWhenPaused: 0 },
  ])("rejects an impossible timer state", (state) => {
    expect(() => parseActiveTimerState({ ...baseTimer, ...state })).toThrow(/Invalid active timer/);
  });
});

describe("task lifecycle validation", () => {
  const task = {
    id: "task-1",
    title: "A valid task",
    notes: "",
    tag: null,
    estimatedSessions: 1,
    status: "today",
    plannedFor: "2026-06-20",
    position: 0,
    createdAt: "2026-06-20T08:00:00.000Z",
    updatedAt: "2026-06-20T08:00:00.000Z",
    completedAt: null,
  };

  it.each([
    { status: "completed", plannedFor: "2026-06-20", completedAt: null },
    { status: "today", plannedFor: "2026-06-20", completedAt: "2026-06-20T09:00:00.000Z" },
    { status: "inbox", plannedFor: "2026-06-20", completedAt: null },
    { status: "today", plannedFor: null, completedAt: null },
  ])("rejects inconsistent task lifecycle fields", (state) => {
    expect(() => parseTask({ ...task, ...state })).toThrow(/Invalid task/);
  });
});
