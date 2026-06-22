import { afterEach, describe, expect, it } from "vitest";
import { bindThemePreference, resolveTheme, THEME_STORAGE_KEY } from "./theme";

describe("theme preference", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    localStorage.clear();
  });

  it("resolves explicit and system preferences", () => {
    expect(resolveTheme("light", { matches: true })).toBe("light");
    expect(resolveTheme("dark", { matches: false })).toBe("dark");
    expect(resolveTheme("system", { matches: true })).toBe("dark");
  });

  it("applies system changes and removes its listener on cleanup", () => {
    let dark = false;
    const listeners = new Set<() => void>();
    const media = {
      get matches() { return dark; },
      addEventListener(_type: "change", listener: () => void) { listeners.add(listener); },
      removeEventListener(_type: "change", listener: () => void) { listeners.delete(listener); },
    };
    const cleanup = bindThemePreference("system", document.documentElement, media);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    dark = true;
    listeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe("dark");
    cleanup();
    expect(listeners.size).toBe(0);
  });
});
