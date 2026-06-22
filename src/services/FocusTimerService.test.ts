import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryMomentumRepository } from "../data/InMemoryMomentumRepository";
import type { Task } from "../domain/models";
import { calculateRemainingMs, FocusTimerService } from "./FocusTimerService";

const start = new Date("2026-06-21T08:00:00.000Z");
const task: Task = {
  id: "task-1",
  title: "Write the proposal",
  notes: "",
  tag: null,
  estimatedSessions: 2,
  status: "today",
  plannedFor: "2026-06-21",
  position: 0,
  createdAt: start.toISOString(),
  updatedAt: start.toISOString(),
  completedAt: null,
};

describe("FocusTimerService", () => {
  let repository: InMemoryMomentumRepository;
  let service: FocusTimerService;

  beforeEach(async () => {
    repository = new InMemoryMomentumRepository();
    await repository.putTask(task);
    service = new FocusTimerService(repository, () => "session-1");
  });

  it("starts one timestamp-based session and rejects another active session", async () => {
    const running = await service.start(task.id, 25, start);
    expect(running).toMatchObject({ status: "running", remainingMs: 1_500_000 });
    expect(await repository.getActiveTimer()).toMatchObject({
      targetEndAt: "2026-06-21T08:25:00.000Z",
      remainingMsWhenPaused: null,
    });
    await expect(service.start(task.id, 25, start)).rejects.toThrow("already active");
    expect(await repository.listFocusSessions()).toHaveLength(1);
  });

  it("freezes the calculated remainder when paused and creates a fresh target when resumed", async () => {
    await service.start(task.id, 25, start);
    const paused = await service.pause(new Date("2026-06-21T08:05:30.000Z"));
    expect(paused).toMatchObject({ status: "paused", remainingMs: 1_170_000 });
    if (paused.status !== "paused") throw new Error("Expected a paused timer");
    expect(paused.timer).toMatchObject({ targetEndAt: null, remainingMsWhenPaused: 1_170_000 });

    const stillPaused = await service.load(new Date("2026-06-21T12:00:00.000Z"));
    expect(stillPaused.remainingMs).toBe(1_170_000);
    const resumed = await service.resume(new Date("2026-06-21T12:00:00.000Z"));
    if (resumed.status !== "running") throw new Error("Expected a running timer");
    expect(resumed.timer).toMatchObject({ targetEndAt: "2026-06-21T12:19:30.000Z" });
  });

  it("recovers after refresh and completes an expired delayed tick exactly once", async () => {
    await service.start(task.id, 25, start);
    const recovered = new FocusTimerService(repository);
    const completed = await recovered.load(new Date("2026-06-21T08:40:00.000Z"));
    expect(completed).toMatchObject({ status: "completed" });
    expect(completed.session?.endedAt).toBe("2026-06-21T08:25:00.000Z");
    expect(await repository.getActiveTimer()).toBeNull();
    expect(await repository.listFocusSessions()).toEqual([expect.objectContaining({ outcome: "completed" })]);
    await expect(recovered.load(start)).resolves.toMatchObject({ status: "idle" });
  });

  it("records cancellation without counting it as completed", async () => {
    await service.start(task.id, 15, start);
    const cancelled = await service.cancel(new Date("2026-06-21T08:02:00.000Z"));
    expect(cancelled).toMatchObject({ status: "cancelled" });
    expect(await repository.listFocusSessions()).toEqual([
      expect.objectContaining({ outcome: "cancelled", endedAt: "2026-06-21T08:02:00.000Z" }),
    ]);
  });

  it("clamps clock drift so time cannot exceed the planned duration", () => {
    expect(calculateRemainingMs({
      sessionId: "session-1",
      taskId: task.id,
      status: "running",
      startedAt: start.toISOString(),
      targetEndAt: "2026-06-21T08:25:00.000Z",
      remainingMsWhenPaused: null,
      updatedAt: start.toISOString(),
    }, new Date("2026-06-21T07:00:00.000Z"), 25)).toBe(1_500_000);
  });
});
