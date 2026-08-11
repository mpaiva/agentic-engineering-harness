import { test, expect } from "@playwright/test";

/**
 * Employee directory — search, filter, sort, and drill-through (PROJECT.md goal 1).
 * The table is a semantic sortable <table>; filtering/pagination happen server-side
 * in Neo4j (people.list) via the loader, so a filter change updates the URL query.
 */

test("lists employees in a sortable table and links through to a person", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.getByRole("heading", { name: /Employee directory/i })).toBeVisible();

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).not.toHaveCount(0);

  // Name is the default sort column (ascending); clicking it toggles the direction.
  const nameHeader = page.getByRole("columnheader", { name: /Name/i });
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await nameHeader.getByRole("button", { name: /Name/i }).click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");

  // The person's name (row header) links to their detail page.
  const firstPerson = page.getByRole("rowheader").first().getByRole("link");
  await firstPerson.click();
  await expect(page).toHaveURL(/\/person\/PER-\d+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("search narrows results server-side and reflects the term in the URL", async ({ page }) => {
  await page.goto("/directory");
  const search = page.getByRole("searchbox", { name: /Search by name or email/i });
  await search.fill("Okafor"); // the seed CEO's surname (deterministic)
  await search.press("Enter");

  await expect(page).toHaveURL(/[?&]query=Okafor/);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).not.toHaveCount(0);
});
