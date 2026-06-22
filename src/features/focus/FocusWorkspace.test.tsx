import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApplicationDataProvider } from "../../app/ApplicationDataContext";
import { InMemoryMomentumRepository } from "../../data/InMemoryMomentumRepository";
import { formatLocalDate } from "../../domain/date";
import type { Task } from "../../domain/models";
import { FocusWorkspace } from "./FocusWorkspace";

const now = new Date();
const task: Task = {
  id: "today-task",
  title: "Protect the important work",
  notes: "",
  tag: "deep work",
  estimatedSessions: 2,
  status: "today",
  plannedFor: formatLocalDate(now),
  position: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  completedAt: null,
};

function renderFocus(repository: InMemoryMomentumRepository) {
  return render(
    <MemoryRouter initialEntries={[`/focus?task=${task.id}`]}>
      <ApplicationDataProvider createRepository={() => repository}>
        <FocusWorkspace />
      </ApplicationDataProvider>
    </MemoryRouter>,
  );
}

describe("FocusWorkspace", () => {
  it("starts, pauses, survives remount, resumes, and confirms cancellation", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(task);
    const first = renderFocus(repository);

    await user.click(await screen.findByRole("button", { name: "Start focus session" }));
    expect(await screen.findByText("Focus in progress")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Session paused")).toBeInTheDocument();
    first.unmount();

    renderFocus(repository);
    expect(await screen.findByText("Session paused")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(await screen.findByRole("button", { name: "Pause" })).toBeInTheDocument();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Cancel session" }));
    expect(await screen.findByText("Session cancelled")).toBeInTheDocument();
    expect(confirm).toHaveBeenCalled();
    expect(await repository.getActiveTimer()).toBeNull();
    expect(await repository.listFocusSessions()).toEqual([expect.objectContaining({ outcome: "cancelled" })]);
  });

  it("persists a supported duration and explains unsupported notifications", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(task);
    renderFocus(repository);

    await user.selectOptions(await screen.findByLabelText("Session length"), "45");
    expect(await repository.getSettings()).toMatchObject({ focusDurationMinutes: 45 });
    expect(screen.getByText("Not supported in this browser")).toBeInTheDocument();
  });
});
