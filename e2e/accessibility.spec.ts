import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const destinations = [
  { path: "/", heading: "A clear day starts small." },
  { path: "/inbox", heading: "Inbox" },
  { path: "/focus", heading: "Focus" },
  { path: "/review", heading: "Daily review" },
  { path: "/settings", heading: "Settings" },
];

for (const destination of destinations) {
  test(`${destination.path} has no automated WCAG A/AA violations`, async ({ page }) => {
    await page.goto(destination.path);
    await expect(page.getByRole("heading", { level: 1, name: destination.heading })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("keyboard users can skip navigation and reach every primary destination", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  for (const name of ["Today", "Inbox", "Focus", "Review"]) {
    const link = navigation.getByRole("link", { name });
    await link.focus();
    await expect(link).toBeFocused();
    const outline = await link.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
  }
});
