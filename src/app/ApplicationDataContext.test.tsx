import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryMomentumRepository } from "../data/InMemoryMomentumRepository";
import { ApplicationDataProvider, useMomentumRepository } from "./ApplicationDataContext";

function RepositoryConsumer() {
  const repository = useMomentumRepository();
  return <p>{repository.constructor.name}</p>;
}

class FailingRepository extends InMemoryMomentumRepository {
  override async initialize() {
    throw new Error("Browser storage is blocked");
  }
}

describe("ApplicationDataProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading and then exposes the initialized repository", async () => {
    render(
      <ApplicationDataProvider createRepository={() => new InMemoryMomentumRepository()}>
        <RepositoryConsumer />
      </ApplicationDataProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Preparing your workspace");
    expect(await screen.findByText("InMemoryMomentumRepository")).toBeInTheDocument();
  });

  it("shows a recoverable error and retries with a new repository", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const repositoryFactory = vi
      .fn<() => InMemoryMomentumRepository>()
      .mockReturnValueOnce(new FailingRepository())
      .mockReturnValueOnce(new InMemoryMomentumRepository());

    render(
      <ApplicationDataProvider createRepository={repositoryFactory}>
        <RepositoryConsumer />
      </ApplicationDataProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Browser storage is blocked");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("InMemoryMomentumRepository")).toBeInTheDocument();
    expect(repositoryFactory).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith("Momentum storage initialization failed", expect.any(Error));
  });
});
