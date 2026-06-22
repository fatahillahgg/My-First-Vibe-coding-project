import { expect, test } from "@playwright/test";

test("primary destinations never overflow the configured viewport", async ({ page }) => {
  for (const path of ["/", "/inbox", "/focus", "/review", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth, `${path} should fit a ${dimensions.clientWidth}px viewport`).toBeLessThanOrEqual(dimensions.clientWidth);
  }

  await page.goto("/inbox");
  const longTitle = "A deliberately long priority title that must wrap cleanly without pushing actions beyond the narrow viewport boundary";
  await page.getByLabel("Task title").fill(longTitle);
  await page.getByLabel("Notes").fill("Long-form notes should remain readable and wrap naturally even when the available screen is only three hundred and sixty pixels wide.");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("heading", { level: 3, name: longTitle })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: `Plan ${longTitle} for today` }).click();
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { level: 3, name: longTitle })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("reduced-motion preference suppresses interface transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.getByRole("link", { name: "Inbox", exact: true }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(["0.01ms", "1e-05s"]).toContain(duration);
});

test("invalid persisted data has a clear recovery path through data controls", async ({ page }) => {
  await page.goto("/inbox");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("momentum");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("tasks", "readwrite");
      transaction.objectStore("tasks").put({
        id: "corrupt-task",
        title: "",
        notes: "",
        tag: null,
        estimatedSessions: 1,
        status: "inbox",
        plannedFor: null,
        position: 0,
        createdAt: "2026-06-22T08:00:00.000Z",
        updatedAt: "2026-06-22T08:00:00.000Z",
        completedAt: null,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "Tasks couldn’t be loaded." })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Invalid task");
  await page.getByRole("link", { name: "Open data controls" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Erase all data" }).click();
  await expect(page.getByText(/All Momentum data was erased/)).toBeVisible();
  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Your inbox is clear" })).toBeVisible();
});
