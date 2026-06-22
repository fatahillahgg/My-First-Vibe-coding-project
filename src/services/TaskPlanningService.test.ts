import { describe, expect, it } from "vitest";
import { InMemoryMomentumRepository } from "../data/InMemoryMomentumRepository";
import type { Task } from "../domain/models";
import { DailyPlanLimitError, TaskPlanningService } from "./TaskPlanningService";

const createdAt = "2026-06-20T08:00:00.000Z";
const updatedAt = "2026-06-20T09:00:00.000Z";

function task(id: string, position: number, plannedFor: string | null = null): Task {
  return {
    id,
    title: `Task ${id}`,
    notes: "",
    tag: null,
    estimatedSessions: 1,
    status: plannedFor ? "today" : "inbox",
    plannedFor,
    position,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
  };
}

describe("TaskPlanningService", () => {
  it("plans an Inbox task for a date and assigns the next position", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([task("planned", 3, "2026-06-20"), task("inbox", 0)]);
    const service = new TaskPlanningService(repository, () => new Date(updatedAt));

    const planned = await service.planTask("inbox", "2026-06-20");
    expect(planned).toEqual(expect.objectContaining({
      status: "today",
      plannedFor: "2026-06-20",
      position: 4,
      updatedAt,
    }));
  });

  it("enforces five incomplete tasks independently for each date", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      ...Array.from({ length: 5 }, (_, index) => task(`today-${index}`, index, "2026-06-20")),
      task("tomorrow", 0, "2026-06-21"),
      task("candidate", 0),
    ]);
    const service = new TaskPlanningService(repository);

    await expect(service.planTask("candidate", "2026-06-20")).rejects.toBeInstanceOf(DailyPlanLimitError);
    await expect(service.planTask("candidate", "2026-06-21")).resolves.toEqual(
      expect.objectContaining({ plannedFor: "2026-06-21" }),
    );
  });

  it("serializes overlapping additions so concurrent actions cannot exceed the limit", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      ...Array.from({ length: 4 }, (_, index) => task(`today-${index}`, index, "2026-06-20")),
      task("candidate-a", 0),
      task("candidate-b", 1),
    ]);
    const service = new TaskPlanningService(repository);

    const results = await Promise.allSettled([
      service.planTask("candidate-a", "2026-06-20"),
      service.planTask("candidate-b", "2026-06-20"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await service.getIncompleteCount("2026-06-20")).toBe(5);
  });

  it("returns a planned task to the Inbox", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([task("inbox", 4), task("planned", 0, "2026-06-20")]);
    const service = new TaskPlanningService(repository, () => new Date(updatedAt));

    expect(await service.returnToInbox("planned")).toEqual(expect.objectContaining({
      status: "inbox",
      plannedFor: null,
      position: 5,
      updatedAt,
    }));
  });

  it("reorders and normalizes every persisted position", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      task("one", 4, "2026-06-20"),
      task("two", 9, "2026-06-20"),
      task("three", 20, "2026-06-20"),
    ]);
    const service = new TaskPlanningService(repository, () => new Date(updatedAt));

    const reordered = await service.moveTask("three", "2026-06-20", "up");
    expect(reordered.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: "one", position: 0 },
      { id: "three", position: 1 },
      { id: "two", position: 2 },
    ]);
    expect((await service.getPlan("2026-06-20")).map((item) => item.id)).toEqual(["one", "three", "two"]);
  });

  it("does not move a boundary task", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([task("one", 0, "2026-06-20"), task("two", 1, "2026-06-20")]);
    const service = new TaskPlanningService(repository);
    expect((await service.moveTask("one", "2026-06-20", "up")).map((item) => item.id)).toEqual(["one", "two"]);
  });

  it("completes a planned task while retaining its date and records the timestamp", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(task("planned", 0, "2026-06-20"));
    const service = new TaskPlanningService(repository, () => new Date(updatedAt));

    expect(await service.completeTask("planned")).toEqual(expect.objectContaining({
      status: "completed",
      plannedFor: "2026-06-20",
      completedAt: updatedAt,
      updatedAt,
    }));
  });

  it("reopens to Today only when the retained date is current and capacity remains", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      { ...task("completed", 2, "2026-06-20"), status: "completed", completedAt: updatedAt },
      task("open", 0, "2026-06-20"),
    ]);
    const service = new TaskPlanningService(repository, () => new Date(updatedAt));

    expect(await service.reopenTask("completed", "2026-06-20")).toEqual(expect.objectContaining({
      status: "today",
      plannedFor: "2026-06-20",
      completedAt: null,
    }));
  });

  it("reopens to Inbox when the date changed or today's plan is full", async () => {
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      ...Array.from({ length: 5 }, (_, index) => task(`open-${index}`, index, "2026-06-20")),
      { ...task("completed", 6, "2026-06-20"), status: "completed", completedAt: updatedAt },
    ]);
    const service = new TaskPlanningService(repository, () => new Date(updatedAt));

    const reopened = await service.reopenTask("completed", "2026-06-20");
    expect(reopened).toEqual(expect.objectContaining({ status: "inbox", plannedFor: null, completedAt: null }));
    expect(await service.getIncompleteCount("2026-06-20")).toBe(5);
  });
});
