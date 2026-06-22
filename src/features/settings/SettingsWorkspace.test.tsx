import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationDataProvider } from "../../app/ApplicationDataContext";
import { InMemoryMomentumRepository } from "../../data/InMemoryMomentumRepository";
import type { ActiveTimerState, Task } from "../../domain/models";
import { SettingsWorkspace } from "./SettingsWorkspace";

const timestamp = "2026-06-22T08:00:00.000Z";
const oldTask: Task = { id: "old", title: "Old data", notes: "", tag: null, estimatedSessions: 1, status: "today", plannedFor: "2026-06-22", position: 0, createdAt: timestamp, updatedAt: timestamp, completedAt: null };
const newTask: Task = { ...oldTask, id: "new", title: "Imported data" };
const timer: ActiveTimerState = { sessionId: "active", taskId: oldTask.id, status: "running", startedAt: timestamp, targetEndAt: "2026-06-22T08:25:00.000Z", remainingMsWhenPaused: null, updatedAt: timestamp };

function renderSettings(repository: InMemoryMomentumRepository) {
  return render(<MemoryRouter><ApplicationDataProvider createRepository={() => repository}><SettingsWorkspace /></ApplicationDataProvider></MemoryRouter>);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("color-scheme");
  localStorage.clear();
});

describe("SettingsWorkspace", () => {
  it("persists theme and focus duration and applies the selected theme", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    const first = renderSettings(repository);
    await user.selectOptions(await screen.findByLabelText("Theme"), "dark");
    expect(await screen.findByText("Preferences saved.")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.selectOptions(screen.getByLabelText("Default focus duration"), "60");
    expect(await repository.getSettings()).toEqual({ theme: "dark", focusDurationMinutes: 60 });
    first.unmount();

    renderSettings(repository);
    expect(await screen.findByLabelText("Theme")).toHaveValue("dark");
    expect(screen.getByLabelText("Default focus duration")).toHaveValue("60");
  });

  it("previews before confirmation, imports atomically, and clears active timer", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(oldTask);
    await repository.setActiveTimer(timer);
    renderSettings(repository);
    const backup = {
      format: "momentum-backup",
      formatVersion: 1,
      exportedAt: timestamp,
      data: { tasks: [newTask], focusSessions: [], dailyReviews: [], settings: { theme: "light", focusDurationMinutes: 45 } },
    };
    await user.upload(await screen.findByLabelText("Momentum JSON backup"), new File([JSON.stringify(backup)], "backup.json", { type: "application/json" }));
    expect(await screen.findByRole("region", { name: "Import preview" })).toHaveTextContent("1 tasks · 0 sessions · 0 reviews");

    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Confirm and replace data" }));
    expect(await repository.getTask(oldTask.id)).toEqual(oldTask);
    await user.click(screen.getByRole("button", { name: "Confirm and replace data" }));
    expect(await screen.findByText(/Backup imported/)).toBeInTheDocument();
    expect(await repository.listTasks()).toEqual([newTask]);
    expect(await repository.getActiveTimer()).toBeNull();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("requires confirmation before erasing and restores first-run defaults", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(oldTask);
    await repository.putSettings({ theme: "dark", focusDurationMinutes: 60 });
    renderSettings(repository);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);

    await user.click(await screen.findByRole("button", { name: "Erase all data" }));
    expect(await repository.listTasks()).toEqual([oldTask]);
    await user.click(screen.getByRole("button", { name: "Erase all data" }));
    expect(await screen.findByText(/All Momentum data was erased/)).toBeInTheDocument();
    expect(await repository.listTasks()).toEqual([]);
    expect(await repository.getSettings()).toEqual({ theme: "system", focusDurationMinutes: 25 });
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("downloads a JSON backup through a temporary object URL", async () => {
    const user = userEvent.setup();
    const repository = new InMemoryMomentumRepository();
    await repository.putTask(oldTask);
    const createObjectURL = vi.fn(() => "blob:momentum");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderSettings(repository);

    await user.click(await screen.findByRole("button", { name: "Export JSON backup" }));
    expect(await screen.findByText(/Backup prepared/)).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:momentum");
  });
});
