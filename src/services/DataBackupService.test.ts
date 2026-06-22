import { describe, expect, it } from "vitest";
import { InMemoryMomentumRepository } from "../data/InMemoryMomentumRepository";
import type { ActiveTimerState, DailyReview, FocusSession, Task } from "../domain/models";
import { BackupValidationError, DataBackupService, parseBackupJson, validateBackup } from "./DataBackupService";

const timestamp = "2026-06-22T08:00:00.000Z";
const task: Task = { id: "task-1", title: "Keep the data", notes: "", tag: null, estimatedSessions: 1, status: "today", plannedFor: "2026-06-22", position: 0, createdAt: timestamp, updatedAt: timestamp, completedAt: null };
const session: FocusSession = { id: "session-1", taskId: task.id, plannedMinutes: 25, startedAt: timestamp, endedAt: "2026-06-22T08:25:00.000Z", outcome: "completed" };
const review: DailyReview = { date: "2026-06-22", reflection: "Useful day", createdAt: timestamp, updatedAt: timestamp };
const activeTimer: ActiveTimerState = { sessionId: "active-session", taskId: task.id, status: "running", startedAt: timestamp, targetEndAt: "2026-06-22T08:25:00.000Z", remainingMsWhenPaused: null, updatedAt: timestamp };

describe("DataBackupService", () => {
  it("exports versioned durable data without active timer state or unfinished sessions", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(task);
    await repository.putFocusSession(session);
    await repository.putFocusSession({ ...session, id: "active-session", endedAt: null, outcome: "cancelled" });
    await repository.putDailyReview(review);
    await repository.putSettings({ theme: "dark", focusDurationMinutes: 45 });
    await repository.setActiveTimer(activeTimer);

    const backup = await new DataBackupService(repository, () => new Date(timestamp)).createBackup();
    expect(backup).toMatchObject({ format: "momentum-backup", formatVersion: 1, exportedAt: timestamp });
    expect(backup.data.focusSessions).toEqual([session]);
    expect(JSON.stringify(backup)).not.toContain("activeTimer");
    expect(JSON.stringify(backup)).not.toContain("targetEndAt");
  });

  it("round-trips every supported durable field and clears active timer on import", async () => {
    const source = new InMemoryMomentumRepository();
    await source.putTask(task);
    await source.putFocusSession(session);
    await source.putDailyReview(review);
    await source.putSettings({ theme: "light", focusDurationMinutes: 60 });
    const backup = await new DataBackupService(source, () => new Date(timestamp)).createBackup();

    const target = new InMemoryMomentumRepository();
    await target.putTask({ ...task, id: "old-task", title: "Old task" });
    await target.setActiveTimer(activeTimer);
    await new DataBackupService(target).importBackup(parseBackupJson(JSON.stringify(backup)));
    expect(await target.listTasks()).toEqual([task]);
    expect(await target.listFocusSessions()).toEqual([session]);
    expect(await target.listDailyReviews()).toEqual([review]);
    expect(await target.getSettings()).toEqual({ theme: "light", focusDurationMinutes: 60 });
    expect(await target.getActiveTimer()).toBeNull();
  });

  it("rejects malformed JSON, unsupported versions, duplicates, broken references, and overfull plans", () => {
    expect(() => parseBackupJson("not json")).toThrow(BackupValidationError);
    const base = {
      format: "momentum-backup",
      formatVersion: 1,
      exportedAt: timestamp,
      data: { tasks: [task], focusSessions: [session], dailyReviews: [review], settings: { theme: "system", focusDurationMinutes: 25 } },
    };
    expect(() => validateBackup({ ...base, formatVersion: 2 })).toThrow(/formatVersion/);
    expect(() => validateBackup({ ...base, activeTimer: activeTimer })).toThrow(/unsupported field/);
    expect(() => validateBackup({ ...base, data: { ...base.data, tasks: [task, task] } })).toThrow(/duplicate/);
    expect(() => validateBackup({ ...base, data: { ...base.data, focusSessions: [{ ...session, taskId: "missing" }] } })).toThrow(/missing task/);
    expect(() => validateBackup({ ...base, data: { ...base.data, focusSessions: [], tasks: Array.from({ length: 6 }, (_, index) => ({ ...task, id: `task-${index}`, position: index })) } })).toThrow(/daily task limit/);
  });

  it("leaves current data and active timer untouched when validation fails", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(task);
    await repository.setActiveTimer(activeTimer);
    const invalid = { format: "momentum-backup", formatVersion: 1, exportedAt: timestamp, data: { tasks: [], focusSessions: [session], dailyReviews: [], settings: { theme: "system", focusDurationMinutes: 25 } } };
    expect(() => validateBackup(invalid)).toThrow();
    expect(await repository.listTasks()).toEqual([task]);
    expect(await repository.getActiveTimer()).toEqual(activeTimer);
  });
});
