import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { IndexedDbMomentumRepository } from "../data/IndexedDbMomentumRepository";
import type { MomentumRepository } from "../data/MomentumRepository";
import type { AppSettings } from "../domain/models";
import { bindThemePreference } from "../services/theme";

const RepositoryContext = createContext<MomentumRepository | null>(null);
interface SettingsContextValue {
  settings: AppSettings;
  saveSettings(settings: AppSettings): Promise<void>;
  reloadSettings(): Promise<AppSettings>;
}
const SettingsContext = createContext<SettingsContextValue | null>(null);

function defaultRepositoryFactory() {
  return new IndexedDbMomentumRepository();
}

interface ApplicationDataProviderProps {
  children: ReactNode;
  createRepository?: () => MomentumRepository;
}

type InitializationState =
  | { status: "loading" }
  | { status: "ready"; settings: AppSettings }
  | { status: "error"; message: string };

export function ApplicationDataProvider({
  children,
  createRepository = defaultRepositoryFactory,
}: ApplicationDataProviderProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<InitializationState>({ status: "loading" });
  const repository = useMemo(createRepository, [attempt, createRepository]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    void repository.initialize().then(() => repository.getSettings()).then(
      (settings) => {
        if (!cancelled) setState({ status: "ready", settings });
      },
      (error: unknown) => {
        console.error("Momentum storage initialization failed", error);
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "An unknown storage error occurred",
          });
        }
      },
    );

    return () => {
      cancelled = true;
      repository.close();
    };
  }, [repository]);

  const settings = state.status === "ready" ? state.settings : null;
  useEffect(() => {
    if (!settings) return;
    return bindThemePreference(settings.theme);
  }, [settings]);

  if (state.status === "loading") {
    return (
      <main className="bootstrap-state" aria-busy="true">
        <span className="bootstrap-mark" aria-hidden="true" />
        <p role="status">Preparing your workspace…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="bootstrap-state">
        <p className="eyebrow">Storage unavailable</p>
        <h1>Momentum couldn’t open your local workspace.</h1>
        <p role="alert">{state.message}</p>
        <button className="button button-dark" type="button" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button>
      </main>
    );
  }

  const settingsValue: SettingsContextValue = {
    settings: state.settings,
    async saveSettings(next) {
      await repository.putSettings(next);
      setState({ status: "ready", settings: next });
    },
    async reloadSettings() {
      const next = await repository.getSettings();
      setState({ status: "ready", settings: next });
      return next;
    },
  };
  return <RepositoryContext value={repository}><SettingsContext value={settingsValue}>{children}</SettingsContext></RepositoryContext>;
}

export function useAppSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useAppSettings must be used within ApplicationDataProvider");
  return value;
}

export function useMomentumRepository(): MomentumRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error("useMomentumRepository must be used within ApplicationDataProvider");
  return repository;
}
