import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { ApplicationDataProvider } from "./app/ApplicationDataContext";
import { InMemoryMomentumRepository } from "./data/InMemoryMomentumRepository";

function renderAt(path: string) {
  const repository = new InMemoryMomentumRepository();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApplicationDataProvider createRepository={() => repository}>
        <App />
      </ApplicationDataProvider>
    </MemoryRouter>,
  );
}

describe("application shell", () => {
  it.each([
    ["/", "A clear day starts small."],
    ["/inbox", "Inbox"],
    ["/focus", "Focus"],
    ["/review", "Daily review"],
    ["/settings", "Settings"],
  ])("renders %s with the expected heading", async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  it("keeps Settings outside the four-item primary navigation", async () => {
    renderAt("/");
    const navigation = await screen.findByRole("navigation", { name: "Primary navigation" });

    expect(within(navigation).getAllByRole("link")).toHaveLength(4);
    expect(within(navigation).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThan(0);
  });
});
