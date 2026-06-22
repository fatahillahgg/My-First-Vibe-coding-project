import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ApplicationDataProvider } from "../../app/ApplicationDataContext";
import { InMemoryMomentumRepository } from "../../data/InMemoryMomentumRepository";
import { formatLocalDate } from "../../domain/date";
import type { DailyReview, FocusSession, Task } from "../../domain/models";
import { ReviewWorkspace } from "./ReviewWorkspace";

const localNow = new Date(2026, 5, 21, 10, 0, 0);
const today = formatLocalDate(localNow);
const timestamp = localNow.toISOString();

function task(id: string, title: string, plannedFor: string, status: "today" | "completed" = "today"): Task {
  return {
    id,
    title,
    notes: "",
    tag: null,
    estimatedSessions: 1,
    status,
    plannedFor,
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: status === "completed" ? timestamp : null,
  };
}

function renderReview(repository: InMemoryMomentumRepository) {
  return render(
    <MemoryRouter>
      <ApplicationDataProvider createRepository={() => repository}>
        <ReviewWorkspace date={today} />
      </ApplicationDataProvider>
    </MemoryRouter>,
  );
}

describe("ReviewWorkspace", () => {
  it("shows persisted daily outcomes and saves one reflection across remount", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    const completed = task("done", "Ship the note", today, "completed");
    const session: FocusSession = { id: "session", taskId: completed.id, plannedMinutes: 25, startedAt: timestamp, endedAt: timestamp, outcome: "completed" };
    await repository.putTask(completed);
    await repository.putFocusSession(session);
    const first = renderReview(repository);

    expect(await screen.findByText("Ship the note")).toBeInTheDocument();
    expect(screen.getAllByText("1", { selector: ".review-stats strong" })).toHaveLength(2);
    const reflection = screen.getByLabelText("What worked, what felt difficult, or what matters tomorrow?");
    await user.type(reflection, "Protected a clear block of time.");
    await user.click(screen.getByRole("button", { name: "Save reflection" }));
    expect(await screen.findByText(/Reflection saved/)).toBeInTheDocument();
    first.unmount();

    renderReview(repository);
    expect(await screen.findByDisplayValue("Protected a clear block of time.")).toBeInTheDocument();
    expect(await repository.listDailyReviews()).toHaveLength(1);
  });

  it("keeps overdue work actionable and renders history read-only", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTasks([
      task("tomorrow", "Carry this forward", "2026-06-19"),
      task("inbox", "Reconsider this", "2026-06-20"),
    ]);
    const past: DailyReview = { date: "2026-06-20", reflection: "A useful earlier reflection.", createdAt: timestamp, updatedAt: timestamp };
    await repository.putDailyReview(past);
    renderReview(repository);

    expect(await screen.findByText("A useful earlier reflection.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move Carry this forward to tomorrow" }));
    expect(screen.queryByText("Carry this forward")).not.toBeInTheDocument();
    expect(await repository.getTask("tomorrow")).toEqual(expect.objectContaining({ plannedFor: "2026-06-22" }));

    await user.click(screen.getByRole("button", { name: "Return Reconsider this to Inbox" }));
    expect(screen.queryByText("Reconsider this")).not.toBeInTheDocument();
    expect(await repository.getTask("inbox")).toEqual(expect.objectContaining({ status: "inbox", plannedFor: null }));
  });
});
