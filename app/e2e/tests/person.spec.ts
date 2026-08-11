import { test, expect } from "@playwright/test";

/**
 * Person view (PROJECT.md goal 3): manager, direct reports, position, job, org
 * unit, and a ROOT→person reporting-chain breadcrumb — all derived through the
 * solid-line REPORTS_TO traversal (schema.md §5.1). PER-000001 is the seed CEO.
 */

test("shows the CEO's identity, reporting chain, and direct reports", async ({ page }) => {
  await page.goto("/person/PER-000001");

  // The CEO seed record is Ava Okafor (plan.ts: first filled seat's holder).
  await expect(page.getByRole("heading", { level: 1, name: /Ava Okafor/ })).toBeVisible();

  // Reporting-chain breadcrumb is present and, for the root, resolves to just the CEO.
  await expect(page.getByRole("navigation", { name: /Reporting chain/i })).toBeVisible();

  // The CEO is the top of the line: no manager link.
  await expect(page.getByText(/None \(top of the reporting line\)/i)).toBeVisible();

  // The CEO has direct reports (the VP seats).
  await expect(page.getByRole("heading", { name: /Direct reports/i })).toBeVisible();

  // The deep link into the org chart focuses the person's seat.
  await page.getByRole("link", { name: /View .* in the org chart/i }).click();
  await expect(page).toHaveURL(/\/org-chart\?focus=POS-\d+/);
  await expect(page.getByRole("tree", { name: /Organization chart/i })).toBeVisible();
});

test("a direct-report link navigates down the reporting line", async ({ page }) => {
  await page.goto("/person/PER-000001");
  const reports = page.getByRole("heading", { name: /Direct reports/i }).locator("..");
  const firstReport = reports.getByRole("link").first();
  await expect(firstReport).toBeVisible();
  await firstReport.click();
  await expect(page).toHaveURL(/\/person\/PER-\d+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
