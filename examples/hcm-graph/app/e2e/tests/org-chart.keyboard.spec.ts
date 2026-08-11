import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Scripted keyboard walkthrough of the org-chart ARIA tree (PROJECT.md
 * Verification: "a scripted keyboard walkthrough of the org chart"; stack-
 * recommendation.md: APG Tree pattern — roving tabindex, arrow-key traversal,
 * author-declared aria-level/setsize/posinset, focus-managed detail panel).
 *
 * The org chart is a genuine role="tree" of role="treeitem" nodes whose hierarchy
 * IS the solid-line REPORTS_TO traversal (schema.md §5). This test drives it with
 * the keyboard only — no mouse — and asserts the APG contract: exactly one roving
 * tabindex owner, ← up to the manager, → into reports, ↑/↓ across peers, Enter to
 * open the detail panel with focus moved into it, Escape to close and restore
 * focus to the originating row.
 */

/** The single treeitem that currently owns the roving tabindex (= the focused row). */
const owner = (page: Page): Locator => page.locator('[role="treeitem"][tabindex="0"]');

test("navigates reporting lines by keyboard with a correct ARIA contract", async ({ page }) => {
  await page.goto("/org-chart");

  const tree = page.getByRole("tree", { name: /Organization chart/i });
  await expect(tree).toBeVisible();

  // Roving tabindex: exactly ONE treeitem is tabbable at any time (APG).
  await expect(owner(page)).toHaveCount(1);

  // Focus the root (CEO) row; it is authored at aria-level 1.
  await owner(page).focus();
  await expect(owner(page)).toBeFocused();
  await expect(owner(page)).toHaveAttribute("aria-level", "1");

  // → drills DOWN into the first direct report (the root is expanded by default).
  await page.keyboard.press("ArrowRight");
  await expect(owner(page)).toHaveAttribute("aria-level", "2");
  // aria-setsize on this peer group = the CEO's direct-report count = the five VP
  // seats (five divisions) — author-declared from the graph, not a widget default.
  await expect(owner(page)).toHaveAttribute("aria-setsize", "5");
  const firstPos = await owner(page).getAttribute("aria-posinset");
  expect(firstPos).not.toBeNull();

  // ↓ moves to the NEXT peer (posinset + 1); ↑ moves back — peers only, never branches.
  await page.keyboard.press("ArrowDown");
  const nextPos = await owner(page).getAttribute("aria-posinset");
  expect(Number(nextPos)).toBe(Number(firstPos) + 1);
  await page.keyboard.press("ArrowUp");
  await expect(owner(page)).toHaveAttribute("aria-posinset", firstPos!);

  // ← collapses the expanded peer (VP rows are expanded by default), then ← again
  // climbs UP to the manager (back to the CEO at level 1).
  await expect(owner(page)).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(owner(page)).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowLeft");
  await expect(owner(page)).toHaveAttribute("aria-level", "1");

  // Enter opens the focus-managed detail panel and moves focus INTO it.
  await page.keyboard.press("Enter");
  const panel = page.getByRole("region", { name: /Details:/i });
  await expect(panel).toBeVisible();
  await expect(panel).toBeFocused();

  // Escape closes the panel and RESTORES focus to the originating row (WCAG 2.4.3).
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: /Details:/i })).toHaveCount(0);
  await expect(owner(page)).toBeFocused();
  await expect(owner(page)).toHaveAttribute("aria-level", "1");
});

test("Home/End jump to the first/last peer in a group", async ({ page }) => {
  await page.goto("/org-chart");
  await expect(page.getByRole("tree", { name: /Organization chart/i })).toBeVisible();

  await owner(page).focus();
  await page.keyboard.press("ArrowRight"); // into the VP peer group
  await expect(owner(page)).toHaveAttribute("aria-level", "2");

  await page.keyboard.press("End");
  await expect(owner(page)).toHaveAttribute("aria-posinset", "5"); // last of five VPs
  await page.keyboard.press("Home");
  await expect(owner(page)).toHaveAttribute("aria-posinset", "1"); // first VP
});
