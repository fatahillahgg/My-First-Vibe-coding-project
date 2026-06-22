import { describe, expect, it } from "vitest";
import { InMemoryMomentumRepository } from "../data/InMemoryMomentumRepository";
import { formatLocalDate } from "../domain/date";
import type { DailyReview, FocusSession, Task } from "../domain/models";
import { DailyPlanLimitError } from "./TaskPlanningService";
import { DailyReviewService } from "./DailyReviewService";

const localInstant = new Date(2026, 5, 21, 10, 0, 0);
const today = formatLocalDate(localInstant);
const updatedAt = localInstant.toISOString();

function task(id: string, plannedFor: string | null, status: "inbox" | "today" | "completed" = "today"): Task {
  return {
    id,
    title: `Task ${id}`,
    notes: "",
    tag: null,
    estimatedSessions: 1,
    status,
    plannedFor,
    position: 0,
    createdAt: updatedAt,
    updatedAt,
    completedAt: status === "completed" ? updatedAt : null,
  };
}

describe("DailyReviewService", () => {
  it("derives today's completed tasks and sessions from persisted instants", async () => {
    const repository = new InMemoryMomentumRepository();
    const completed = task("done", today, "completed");
    const session: FocusSession = { id: "session", taskId: completed.id, plannedMinutes: 25, startedAt: updatedAt, endedAt: updatedAt, outcome: "completed" };
    await repository.putTasks([completed, task("open", today)]);
    await repository.putFocusSession(session);

    const summary = await new DailyReviewService(repository).getSummary(today);
    expect(summary.completedTasks).toEqual([completed]);
    expect(summary.completedSessions).toEqual([session]);
  });

  it("upserts one reflection per date, preserves createdAt, and rejects excess length", async () => {
    const repository = new InMemoryMomentumRepository();
    let tick = 0;
    const service = new DailyReviewService(repository, () => new Date(localInstant.getTime() + tick++ * 1_000));
    const first = await service.saveReflection(today, "Protected the important work.");
    const updated = await service.saveReflection(today, "A calm and useful day.");

    expect(updated.createdAt).toBe(first.createdAt);
    expect(updated.updatedAt).not.toBe(first.updatedAt);
    expect(await repository.listDailyReviews()).toEqual([updated]);
    await expect(service.saveReflection(today, "x".repeat(501))).rejects.toThrow("500 characters");
  });

  it("keeps overdue tasks visible and moves one to tomorrow without duplication", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([task("overdue", "2026-06-19"), task("current", today)]);
    const service = new DailyReviewService(repository, () => localInstant);
    expect((await service.getSummary(today)).overdueTasks.map((item) => item.id)).toEqual(["overdue"]);

    const moved = await service.moveToTomorrow("overdue", today);
    expect(moved).toEqual(expect.objectContaining({ status: "today", plannedFor: "2026-06-22" }));
    expect((await repository.listTasks()).filter((item) => item.id === "overdue")).toHaveLength(1);
  });

  it("rejects rollover when tomorrow already has five incomplete tasks", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      task("overdue", "2026-06-19"),
      ...Array.from({ length: 5 }, (_, index) => ({ ...task(`tomorrow-${index}`, "2026-06-22"), position: index })),
    ]);
    await expect(new DailyReviewService(repository).moveToTomorrow("overdue", today)).rejects.toBeInstanceOf(DailyPlanLimitError);
    expect((await repository.getTask("overdue"))?.plannedFor).toBe("2026-06-19");
  });

  it("returns overdue tasks to Inbox and lists past reviews newest first", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(task("overdue", "2026-06-19"));
    const reviews: DailyReview[] = [
      { date: "2026-06-19", reflection: "First", createdAt: updatedAt, updatedAt },
      { date: "2026-06-20", reflection: "Second", createdAt: updatedAt, updatedAt },
    ];
    for (const review of reviews) await repository.putDailyReview(review);
    const service = new DailyReviewService(repository, () => localInstant);

    expect(await service.returnToInbox("overdue", today)).toEqual(expect.objectContaining({ status: "inbox", plannedFor: null }));
    expect((await service.getSummary(today)).history.map((review) => review.date)).toEqual(["2026-06-20", "2026-06-19"]);
  });
});
