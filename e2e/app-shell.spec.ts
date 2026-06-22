import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoA11yViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("primary routes are reachable and Settings stays secondary", async ({ page }) => {
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(primaryNavigation.getByRole("link")).toHaveCount(4);
  await expect(primaryNavigation.getByRole("link", { name: "Settings" })).toHaveCount(0);

  await primaryNavigation.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();

  await primaryNavigation.getByRole("link", { name: "Focus" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Focus" })).toBeVisible();

  await primaryNavigation.getByRole("link", { name: "Review" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Daily review" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("Inbox tasks persist through create, edit, filter, delete, and undo", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByLabel("Task title").fill("Draft quarterly plan");
  await page.getByLabel("Notes").fill("Outline the three most important outcomes");
  await page.getByLabel("Focus estimate").selectOption("3");
  await page.getByLabel("Tag").fill("Deep work");
  await page.getByRole("button", { name: "Add task" }).click();

  await expect(page.getByRole("heading", { level: 3, name: "Draft quarterly plan" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 3, name: "Draft quarterly plan" })).toBeVisible();

  const task = page.getByRole("listitem").filter({ hasText: "Draft quarterly plan" });
  await task.getByRole("button", { name: "Edit Draft quarterly plan" }).click();
  const editor = page.getByRole("region", { name: "Edit Draft quarterly plan" });
  await editor.getByLabel("Task title").fill("Finalize quarterly plan");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Finalize quarterly plan" })).toBeVisible();

  await page.getByLabel("Search task titles").fill("missing");
  await expect(page.getByRole("heading", { level: 3, name: "No matching tasks" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();

  await page.getByRole("button", { name: "Delete Finalize quarterly plan" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Finalize quarterly plan" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Finalize quarterly plan" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("Today plan persists ordering and can return tasks to Inbox", async ({ page }) => {
  await page.goto("/inbox");

  for (const title of ["First priority", "Second priority"]) {
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill(title);
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("button", { name: `Plan ${title} for today` }).click();
  }

  await page.getByRole("link", { name: "Today" }).click();
  const plan = page.getByRole("list");
  await expect(plan.getByRole("heading", { level: 3 })).toHaveText(["First priority", "Second priority"]);
  await page.getByRole("button", { name: "Move Second priority up" }).click();
  await expect(plan.getByRole("heading", { level: 3 })).toHaveText(["Second priority", "First priority"]);

  await page.reload();
  await expect(page.getByRole("list").getByRole("heading", { level: 3 })).toHaveText(["Second priority", "First priority"]);
  await page.getByRole("button", { name: "Return Second priority to Inbox" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Second priority" })).toHaveCount(0);

  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Second priority" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("critical journey creates, plans, focuses, completes, and reviews from clean storage", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByLabel("Task title").fill("Finish the launch note");
  await page.getByLabel("Focus estimate").selectOption("1");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("button", { name: "Plan Finish the launch note for today" }).click();

  await page.getByRole("link", { name: "Today" }).click();
  await page.getByRole("link", { name: "Focus on Finish the launch note" }).click();
  await page.getByLabel("Session length").selectOption("15");
  await page.getByRole("button", { name: "Start focus session" }).click();
  await expect(page.getByText("Focus in progress")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Session paused")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Session paused")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Focus in progress")).toBeVisible();

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("momentum");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("activeTimer", "readwrite");
      const store = transaction.objectStore("activeTimer");
      const request = store.get("current");
      request.onsuccess = () => {
        const record = request.result as { key: string; value: { targetEndAt: string; updatedAt: string } };
        record.value.targetEndAt = new Date(Date.now() - 1_000).toISOString();
        record.value.updatedAt = new Date().toISOString();
        store.put(record);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(page.getByText("Session complete")).toBeVisible();
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText("1 of 1 focus sessions")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 of 1 focus sessions")).toBeVisible();
  await page.getByRole("button", { name: "Complete Finish the launch note" }).click();
  await expect(page.getByRole("progressbar", { name: "1 of 1 tasks completed" })).toBeVisible();

  await page.getByRole("link", { name: "Review" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Daily review" })).toBeVisible();
  await expect(page.locator(".review-completed-list").getByText("Finish the launch note")).toBeVisible();
  await expectNoA11yViolations(page);
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
  await page.getByLabel("What worked, what felt difficult, or what matters tomorrow?").fill("A focused finish.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByText(/Reflection saved/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("What worked, what felt difficult, or what matters tomorrow?")).toHaveValue("A focused finish.");
});

test("Settings persist and data controls require validated confirmation", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Default focus duration").selectOption("45");
  await page.reload();
  await expect(page.getByLabel("Theme")).toHaveValue("dark");
  await expect(page.getByLabel("Default focus duration")).toHaveValue("45");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^momentum-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const timestamp = "2026-06-22T08:00:00.000Z";
  const backup = {
    format: "momentum-backup",
    formatVersion: 1,
    exportedAt: timestamp,
    data: {
      tasks: [{ id: "imported-task", title: "Imported priority", notes: "", tag: null, estimatedSessions: 1, status: "inbox", plannedFor: null, position: 0, createdAt: timestamp, updatedAt: timestamp, completedAt: null }],
      focusSessions: [],
      dailyReviews: [],
      settings: { theme: "light", focusDurationMinutes: 60 },
    },
  };
  await page.getByLabel("Momentum JSON backup").setInputFiles({
    name: "momentum.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("region", { name: "Import preview" })).toContainText("1 tasks · 0 sessions · 0 reviews");
  await expectNoA11yViolations(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Confirm and replace data" }).click();
  await expect(page.getByText(/Backup imported/)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Imported priority" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).first().click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Erase all data" }).click();
  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Imported priority" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Erase all data" }).click();
  await expect(page.getByText(/All Momentum data was erased/)).toBeVisible();
  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Your inbox is clear" })).toBeVisible();
});
