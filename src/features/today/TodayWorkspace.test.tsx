import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ApplicationDataProvider } from "../../app/ApplicationDataContext";
import { InMemoryMomentumRepository } from "../../data/InMemoryMomentumRepository";
import type { FocusSession, Task } from "../../domain/models";
import { TodayWorkspace } from "./TodayWorkspace";
import { millisecondsUntilNextLocalDay } from "./useCurrentLocalDate";

const timestamp = "2026-06-20T08:00:00.000Z";

function plannedTask(id: string, title: string, date: string, position: number, status: "today" | "completed" = "today"): Task {
  return {
    id,
    title,
    notes: `${title} notes`,
    tag: "Work",
    estimatedSessions: 2,
    status,
    plannedFor: date,
    position,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: status === "completed" ? "2026-06-20T10:00:00.000Z" : null,
  };
}

function renderToday(repository: InMemoryMomentumRepository, date = "2026-06-20") {
  const factory = () => repository;
  const view = render(
    <MemoryRouter>
      <ApplicationDataProvider createRepository={factory}>
        <TodayWorkspace date={date} />
      </ApplicationDataProvider>
    </MemoryRouter>,
  );
  return {
    ...view,
    showDate(nextDate: string) {
      view.rerender(
        <MemoryRouter>
          <ApplicationDataProvider createRepository={factory}>
            <TodayWorkspace date={nextDate} />
          </ApplicationDataProvider>
        </MemoryRouter>,
      );
    },
  };
}

describe("Today workspace", () => {
  it("shows only the selected local date with progress and session estimates", async () => {
    const repository = new InMemoryMomentumRepository();
    const current = plannedTask("current", "Current task", "2026-06-20", 0);
    const completed = plannedTask("completed", "Completed task", "2026-06-20", 1, "completed");
    const session: FocusSession = {
      id: "session-1",
      taskId: current.id,
      plannedMinutes: 25,
      startedAt: timestamp,
      endedAt: "2026-06-20T08:25:00.000Z",
      outcome: "completed",
    };
    await repository.putTasks([
      plannedTask("past", "Past task", "2026-06-19", 0),
      current,
      completed,
      plannedTask("future", "Future task", "2026-06-21", 0),
    ]);
    await repository.putFocusSession(session);
    const view = renderToday(repository);

    expect(await screen.findByRole("heading", { level: 3, name: "Current task" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Completed task" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Past task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Future task" })).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 focus sessions")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 of 2 tasks completed" })).toHaveAttribute("aria-valuenow", "1");

    view.showDate("2026-06-21");
    expect(await screen.findByRole("heading", { level: 3, name: "Future task" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Current task" })).not.toBeInTheDocument();
  });

  it("returns a task to Inbox and persists the transition", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    const task = plannedTask("return", "Return me", "2026-06-20", 0);
    await repository.putTask(task);
    renderToday(repository);

    await user.click(await screen.findByRole("button", { name: "Return Return me to Inbox" }));
    expect(screen.queryByRole("heading", { level: 3, name: task.title })).not.toBeInTheDocument();
    expect(await repository.getTask(task.id)).toEqual(expect.objectContaining({ status: "inbox", plannedFor: null }));
  });

  it("reorders with disabled boundaries and preserves order after remount", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      plannedTask("one", "First task", "2026-06-20", 8),
      plannedTask("two", "Second task", "2026-06-20", 12),
    ]);
    const view = renderToday(repository);

    expect(await screen.findByRole("button", { name: "Move First task up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Second task down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move Second task up" }));

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Second task",
      "First task",
    ]);
    view.unmount();
    renderToday(repository);
    const restoredList = await screen.findByRole("list");
    expect(within(restoredList).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Second task",
      "First task",
    ]);
  });

  it("calculates the next local-day refresh boundary", () => {
    expect(millisecondsUntilNextLocalDay(new Date(2026, 5, 20, 23, 59, 30))).toBe(30_000);
  });

  it("completes and reopens a task with persisted progress", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(plannedTask("finish", "Finish me", "2026-06-20", 0));
    renderToday(repository);

    await user.click(await screen.findByRole("button", { name: "Complete Finish me" }));
    expect(screen.getByRole("progressbar", { name: "1 of 1 tasks completed" })).toHaveAttribute("aria-valuenow", "1");
    expect(await repository.getTask("finish")).toEqual(expect.objectContaining({ status: "completed" }));

    await user.click(screen.getByRole("button", { name: "Reopen Finish me" }));
    expect(screen.getByRole("progressbar", { name: "0 of 1 tasks completed" })).toHaveAttribute("aria-valuenow", "0");
    expect(await repository.getTask("finish")).toEqual(expect.objectContaining({ status: "today", completedAt: null }));
  });
});
