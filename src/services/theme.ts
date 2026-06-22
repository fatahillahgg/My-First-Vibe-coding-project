import type { ThemePreference } from "../domain/models";

export const THEME_STORAGE_KEY = "momentum-theme";
interface ThemeMedia {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

function defaultMedia(): ThemeMedia {
  if (typeof window.matchMedia === "function") return window.matchMedia("(prefers-color-scheme: dark)");
  return { matches: false, addEventListener() {}, removeEventListener() {} };
}

export function resolveTheme(preference: ThemePreference, media: Pick<ThemeMedia, "matches">): "light" | "dark" {
  return preference === "system" ? (media.matches ? "dark" : "light") : preference;
}

export function bindThemePreference(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
  media: ThemeMedia = defaultMedia(),
) {
  const apply = () => {
    const resolved = resolveTheme(preference, media);
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  };
  apply();
  try { localStorage.setItem(THEME_STORAGE_KEY, preference); } catch { /* IndexedDB remains authoritative. */ }
  if (preference === "system") media.addEventListener("change", apply);
  return () => {
    if (preference === "system") media.removeEventListener("change", apply);
  };
}
