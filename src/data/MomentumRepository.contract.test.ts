import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import type { ActiveTimerState, AppSettings, DailyReview, FocusSession, Task } from "../domain/models";
import { InMemoryMomentumRepository } from "./InMemoryMomentumRepository";
import { deleteMomentumDatabase, IndexedDbMomentumRepository } from "./IndexedDbMomentumRepository";
import type { MomentumRepository } from "./MomentumRepository";

const timestamp = "2026-06-20T14:00:00.000Z";

const task: Task = {
  id: "task-1",
  title: "Shape the day",
  notes: "Choose one meaningful outcome",
  tag: "planning",
  estimatedSessions: 2,
  status: "today",
  plannedFor: "2026-06-20",
  position: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: null,
};

const session: FocusSession = {
  id: "session-1",
  taskId: task.id,
  plannedMinutes: 25,
  startedAt: timestamp,
  endedAt: "2026-06-20T14:25:00.000Z",
  outcome: "completed",
};

const review: DailyReview = {
  date: "2026-06-20",
  reflection: "Protected the important work.",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const settings: AppSettings = { theme: "dark", focusDurationMinutes: 45 };

const runningTimer: ActiveTimerState = {
  sessionId: "active-1",
  taskId: task.id,
  status: "running",
  startedAt: timestamp,
  targetEndAt: "2026-06-20T14:25:00.000Z",
  remainingMsWhenPaused: null,
  updatedAt: timestamp,
};

interface RepositoryHarness {
  repository: MomentumRepository;
  cleanup(): Promise<void>;
}

function repositoryContract(label: string, createHarness: () => Promise<RepositoryHarness>) {
  describe(`${label} repository contract`, () => {
    let harness: RepositoryHarness | null = null;

    afterEach(async () => {
      await harness?.cleanup();
      harness = null;
    });

    async function repository() {
      harness = await createHarness();
      await harness.repository.initialize();
      return harness.repository;
    }

    it("provides default settings and persists updates", async () => {
      const repo = await repository();
      expect(await repo.getSettings()).toEqual({ theme: "system", focusDurationMinutes: 25 });
      await repo.putSettings(settings);
      expect(await repo.getSettings()).toEqual(settings);
    });

    it("creates, reads, updates, lists, and deletes tasks", async () => {
      const repo = await repository();
      await repo.putTask(task);
      expect(await repo.getTask(task.id)).toEqual(task);
      expect(await repo.listTasks()).toEqual([task]);

      await repo.putTask({ ...task, title: "Shape tomorrow", updatedAt: "2026-06-20T15:00:00.000Z" });
      expect((await repo.getTask(task.id))?.title).toBe("Shape tomorrow");
      await repo.deleteTask(task.id);
      expect(await repo.getTask(task.id)).toBeNull();
    });

    it("deletes and restores a task with its related sessions and active timer atomically", async () => {
      const repo = await repository();
      const activeSession = { ...session, endedAt: null, outcome: "cancelled" as const };
      const matchingTimer = { ...runningTimer, sessionId: activeSession.id };
      await repo.putTask(task);
      await repo.putFocusSession(activeSession);
      await repo.setActiveTimer(matchingTimer);

      const deleted = await repo.deleteTask(task.id);
      expect(deleted).toEqual({ task, focusSessions: [activeSession], activeTimer: matchingTimer });
      expect(await repo.getTask(task.id)).toBeNull();
      expect(await repo.listFocusSessions()).toEqual([]);
      expect(await repo.getActiveTimer()).toBeNull();
      if (!deleted) throw new Error("Expected deleted task snapshot");
      await repo.restoreDeletedTask(deleted);
      expect(await repo.getTask(task.id)).toEqual(task);
      expect(await repo.listFocusSessions()).toEqual([activeSession]);
      expect(await repo.getActiveTimer()).toEqual(matchingTimer);
    });

    it("writes multiple tasks through the bulk operation", async () => {
      const repo = await repository();
      const second = { ...task, id: "task-2", title: "Second task", position: 1 };
      await repo.putTasks([task, second]);
      expect(await repo.listTasks()).toEqual([task, second]);
    });

    it("creates, reads, updates, lists, and deletes focus sessions", async () => {
      const repo = await repository();
      await repo.putFocusSession(session);
      expect(await repo.getFocusSession(session.id)).toEqual(session);
      expect(await repo.listFocusSessions()).toEqual([session]);

      await repo.putFocusSession({ ...session, outcome: "cancelled" });
      expect((await repo.getFocusSession(session.id))?.outcome).toBe("cancelled");
      await repo.deleteFocusSession(session.id);
      expect(await repo.getFocusSession(session.id)).toBeNull();
    });

    it("creates, reads, updates, lists, and deletes daily reviews", async () => {
      const repo = await repository();
      await repo.putDailyReview(review);
      expect(await repo.getDailyReview(review.date)).toEqual(review);
      expect(await repo.listDailyReviews()).toEqual([review]);

      await repo.putDailyReview({ ...review, reflection: "A calmer day." });
      expect((await repo.getDailyReview(review.date))?.reflection).toBe("A calmer day.");
      await repo.deleteDailyReview(review.date);
      expect(await repo.getDailyReview(review.date)).toBeNull();
    });

    it("keeps exactly one active timer and can clear it", async () => {
      const repo = await repository();
      expect(await repo.getActiveTimer()).toBeNull();
      await repo.setActiveTimer(runningTimer);

      const pausedTimer: ActiveTimerState = {
        ...runningTimer,
        sessionId: "active-2",
        status: "paused",
        targetEndAt: null,
        remainingMsWhenPaused: 900_000,
      };
      await repo.setActiveTimer(pausedTimer);
      expect(await repo.getActiveTimer()).toEqual(pausedTimer);

      await repo.setActiveTimer(null);
      expect(await repo.getActiveTimer()).toBeNull();
    });

    it("atomically starts and finishes the singleton focus session", async () => {
      const repo = await repository();
      await repo.putTask(task);
      const activeSession = { ...session, endedAt: null, outcome: "cancelled" as const };
      const matchingTimer = { ...runningTimer, sessionId: activeSession.id };
      await repo.startFocusSession(activeSession, matchingTimer);
      await expect(repo.startFocusSession({ ...activeSession, id: "session-2" }, { ...matchingTimer, sessionId: "session-2" }))
        .rejects.toThrow("already active");
      expect(await repo.listFocusSessions()).toEqual([activeSession]);

      await repo.finishFocusSession(session);
      expect(await repo.getActiveTimer()).toBeNull();
      expect(await repo.getFocusSession(session.id)).toEqual(session);
    });

    it("returns defensive copies rather than mutable stored references", async () => {
      const repo = await repository();
      await repo.putTask(task);
      const fetched = await repo.getTask(task.id);
      if (!fetched) throw new Error("Expected the stored task");
      fetched.title = "Mutated outside the repository";
      expect((await repo.getTask(task.id))?.title).toBe(task.title);
    });

    it("atomically replaces durable data and clears the active timer", async () => {
      const repo = await repository();
      await repo.putTask(task);
      await repo.setActiveTimer(runningTimer);
      const replacement = { ...task, id: "replacement", title: "Replacement" };
      await repo.replaceDurableData({
        tasks: [replacement],
        focusSessions: [],
        dailyReviews: [review],
        settings,
      });
      expect(await repo.listTasks()).toEqual([replacement]);
      expect(await repo.listFocusSessions()).toEqual([]);
      expect(await repo.listDailyReviews()).toEqual([review]);
      expect(await repo.getSettings()).toEqual(settings);
      expect(await repo.getActiveTimer()).toBeNull();
    });

    it("validates replacement data before mutation and can erase every store", async () => {
      const repo = await repository();
      await repo.putTask(task);
      await repo.setActiveTimer(runningTimer);
      await expect(repo.replaceDurableData({
        tasks: [{ ...task, title: "" }],
        focusSessions: [],
        dailyReviews: [],
        settings,
      })).rejects.toThrow();
      expect(await repo.getTask(task.id)).toEqual(task);
      expect(await repo.getActiveTimer()).toEqual(runningTimer);

      await repo.clearAllData();
      expect(await repo.listTasks()).toEqual([]);
      expect(await repo.listFocusSessions()).toEqual([]);
      expect(await repo.listDailyReviews()).toEqual([]);
      expect(await repo.getSettings()).toEqual({ theme: "system", focusDurationMinutes: 25 });
      expect(await repo.getActiveTimer()).toBeNull();
    });
  });
}

repositoryContract("in-memory", async () => {
  const repository = new InMemoryMomentumRepository();
  return { repository, cleanup: async () => repository.close() };
});

let databaseSequence = 0;

repositoryContract("IndexedDB", async () => {
  const databaseName = `momentum-contract-${databaseSequence++}`;
  const repository = new IndexedDbMomentumRepository(databaseName);
  return {
    repository,
    cleanup: async () => {
      repository.close();
      await deleteMomentumDatabase(databaseName);
    },
  };
});

describe("IndexedDB lifecycle", () => {
  const databases: string[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map(deleteMomentumDatabase));
  });

  it("retains every store after the database is closed and reopened", async () => {
    const databaseName = `momentum-reopen-${databaseSequence++}`;
    databases.push(databaseName);
    const first = new IndexedDbMomentumRepository(databaseName);
    await first.initialize();
    await first.putTask(task);
    await first.putFocusSession(session);
    await first.putDailyReview(review);
    await first.putSettings(settings);
    await first.setActiveTimer(runningTimer);
    first.close();

    const reopened = new IndexedDbMomentumRepository(databaseName);
    await reopened.initialize();
    expect(await reopened.getTask(task.id)).toEqual(task);
    expect(await reopened.getFocusSession(session.id)).toEqual(session);
    expect(await reopened.getDailyReview(review.date)).toEqual(review);
    expect(await reopened.getSettings()).toEqual(settings);
    expect(await reopened.getActiveTimer()).toEqual(runningTimer);
    reopened.close();
  });
});
