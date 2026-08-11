import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility pass (PROJECT.md Verification: "automated axe pass").
 *
 * Runs axe-core over each view of the slice and fails on ANY WCAG 2.2 A/AA
 * violation. PER-000001 is the deterministic CEO seed record (schema.md §7 /
 * plan.ts: the first filled seat's holder), so the person route is stable.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const views = [
  { name: "employee directory", path: "/directory" },
  { name: "org chart", path: "/org-chart" },
  { name: "person view", path: "/person/PER-000001" },
];

for (const view of views) {
  test(`${view.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(view.path);
    // Wait for the primary content to render before scanning.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    // A readable failure lists the rule ids + affected nodes.
    const summary = results.violations
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`)
      .join("\n");
    expect(results.violations, summary).toEqual([]);
  });
}
