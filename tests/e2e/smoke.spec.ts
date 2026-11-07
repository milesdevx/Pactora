import { expect, test } from "@playwright/test";

test("public pages render without a wallet on desktop and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const home = await page.goto("/");
  expect(home?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Work agreed.");
  await expect(page.getByRole("link", { name: "Create an Agreement", exact: true })).toBeVisible();
  await expect(page.getByText("Illustration, not real funds", { exact: true })).toBeVisible();

  const help = await page.goto("/help");
  expect(help?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Help");
  await expect(page.getByText("31611 (Hex: 0x7b7b)", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
