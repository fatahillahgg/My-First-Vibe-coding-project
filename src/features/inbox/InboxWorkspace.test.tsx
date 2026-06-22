import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../App";
import { ApplicationDataProvider } from "../../app/ApplicationDataContext";
import { InMemoryMomentumRepository } from "../../data/InMemoryMomentumRepository";
import type { Task } from "../../domain/models";

const timestamp = "2026-06-20T14:00:00.000Z";

function makeTask(id: string, title: string, tag: string | null, position: number): Task {
  return {
    id,
    title,
    notes: `${title} notes`,
    tag,
    estimatedSessions: 2,
    status: "inbox",
    plannedFor: null,
    position,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

function renderInbox(repository = new InMemoryMomentumRepository()) {
  const view = render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <ApplicationDataProvider createRepository={() => repository}>
        <App />
      </ApplicationDataProvider>
    </MemoryRouter>,
  );
  return { ...view, repository };
}

describe("Inbox workspace", () => {
  it("announces validation and does not persist a task without a title", async () => {
    const user = userEvent.setup();
    const { repository } = renderInbox();
    await user.click(await screen.findByRole("button", { name: "Add task" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Add a title");
    expect(screen.getByLabelText("Task title")).toHaveFocus();
    expect(await repository.listTasks()).toEqual([]);
  });

  it("creates a complete task and reloads it from the repository", async () => {
    const user = userEvent.setup();
    const { repository, unmount } = renderInbox();

    await user.type(await screen.findByLabelText("Task title"), "Draft project brief");
    await user.type(screen.getByLabelText("Notes"), "Clarify the desired outcome");
    await user.selectOptions(screen.getByLabelText("Focus estimate"), "3");
    await user.type(screen.getByLabelText("Tag"), "Deep work");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByRole("heading", { level: 3, name: "Draft project brief" })).toBeInTheDocument();
    expect(await repository.listTasks()).toEqual([
      expect.objectContaining({
        title: "Draft project brief",
        notes: "Clarify the desired outcome",
        tag: "Deep work",
        estimatedSessions: 3,
        status: "inbox",
      }),
    ]);

    unmount();
    renderInbox(repository);
    expect(await screen.findByRole("heading", { level: 3, name: "Draft project brief" })).toBeInTheDocument();
  });

  it("edits every user-editable field while preserving identity and creation time", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    const original = makeTask("task-edit", "Original title", "Admin", 0);
    await repository.putTask(original);
    renderInbox(repository);

    await user.click(await screen.findByRole("button", { name: "Edit Original title" }));
    const editForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    if (!editForm) throw new Error("Expected edit form");
    const form = within(editForm);
    await user.clear(form.getByLabelText("Task title"));
    await user.type(form.getByLabelText("Task title"), "Updated title");
    await user.clear(form.getByLabelText("Notes"));
    await user.type(form.getByLabelText("Notes"), "Updated notes");
    await user.selectOptions(form.getByLabelText("Focus estimate"), "5");
    await user.clear(form.getByLabelText("Tag"));
    await user.type(form.getByLabelText("Tag"), "Creative");
    await user.click(form.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { level: 3, name: "Updated title" })).toBeInTheDocument();
    expect(await repository.getTask(original.id)).toEqual(expect.objectContaining({
      id: original.id,
      createdAt: original.createdAt,
      title: "Updated title",
      notes: "Updated notes",
      tag: "Creative",
      estimatedSessions: 5,
    }));
  });

  it("deletes only through an undoable action and can restore the task", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    const task = makeTask("task-delete", "Keep this recoverable", null, 0);
    await repository.putTask(task);
    renderInbox(repository);

    await user.click(await screen.findByRole("button", { name: "Delete Keep this recoverable" }));
    expect(screen.queryByRole("heading", { level: 3, name: task.title })).not.toBeInTheDocument();
    expect(await repository.getTask(task.id)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("heading", { level: 3, name: task.title })).toBeInTheDocument();
    expect(await repository.getTask(task.id)).toEqual(task);
  });

  it("combines title search and tag filter, then clears without changing stored tasks", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await Promise.all([
      repository.putTask(makeTask("one", "Draft proposal", "Deep work", 0)),
      repository.putTask(makeTask("two", "Review proposal", "Admin", 1)),
      repository.putTask(makeTask("three", "Plan workshop", "Deep work", 2)),
    ]);
    renderInbox(repository);

    await screen.findByRole("heading", { level: 3, name: "Draft proposal" });
    await user.type(screen.getByLabelText("Search task titles"), "proposal");
    await user.selectOptions(screen.getByLabelText("Filter by tag"), "Deep work");

    expect(screen.getByRole("heading", { level: 3, name: "Draft proposal" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Review proposal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Plan workshop" })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search task titles"));
    await user.type(screen.getByLabelText("Search task titles"), "missing");
    expect(screen.getByRole("heading", { level: 3, name: "No matching tasks" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
    expect(await repository.listTasks()).toHaveLength(3);
  });

  it("moves an Inbox task into today's persisted plan", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    const candidate = makeTask("candidate", "Plan this task", null, 0);
    await repository.putTask(candidate);
    renderInbox(repository);

    await user.click(await screen.findByRole("button", { name: "Plan Plan this task for today" }));
    expect(screen.queryByRole("heading", { level: 3, name: candidate.title })).not.toBeInTheDocument();
    expect(await repository.getTask(candidate.id)).toEqual(expect.objectContaining({
      status: "today",
      plannedFor: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }));
  });

  it("disables planning with a clear explanation when today already has five tasks", async () => {
    const repository = new InMemoryMomentumRepository();
    const candidate = makeTask("candidate", "Sixth task", null, 0);
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await repository.putTasks([
      candidate,
      ...Array.from({ length: 5 }, (_, index) => ({
        ...makeTask(`planned-${index}`, `Planned ${index}`, null, index),
        status: "today" as const,
        plannedFor: localDate,
      })),
    ]);
    renderInbox(repository);

    expect(await screen.findByRole("button", { name: "Plan Sixth task for today" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Today’s plan is full (5/5)");
  });
});
