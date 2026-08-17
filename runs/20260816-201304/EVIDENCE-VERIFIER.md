# Verifier Evidence — FINAL SIGN-OFF (post designer + a11y patches)

Fresh-context, independently run (not copied from implementer's `build/EVIDENCE.md`).
Tool: Playwright headless Chromium, run from `/private/tmp/pw-check` (playwright
installed there, not committed to repo). Target: `file:///Users/mp/git-repos/atomic-cockpit/build/poem.html`.

Script loaded the file twice (desktop 1400x900, mobile 375x812), captured
console/page errors, read `data-i` + `data-revealed-at` + `.revealed` class off
every `.line`/`.signature` element after full reveal, and screenshotted both
viewports after full reveal.

## Criterion-by-criterion

**1. Opens via `file://`, no console errors**
Command: Playwright `page.goto('file:///.../build/poem.html')`, `page.on('console'|'pageerror', ...)`.
Result: `consoleErrors: []` on both desktop and mobile passes. PASS.

**2. Only line 1 visible on load**
Checked classList at load+50ms: `line1RevealedEarly: true`, `line2RevealedEarly: false`
(desktop and mobile). PASS.

**3. New line every 2000ms ± 100ms**
Read `data-revealed-at` off all 21 elements (20 lines + signature), computed deltas
between consecutive reveals. Desktop deltas (ms):
`2003, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2001, 1999, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2001, 1999`
Mobile deltas near-identical, max deviation 2ms. All well within ±100ms. PASS.

**4. Lines in order, no skip/dup/reorder**
Read `data-i` in reveal order: `["1","2","3",...,"20","21"]` — exact sequential match,
both viewports. PASS.

**5. Signature last, visually distinct**
Signature (`data-i="21"`) is the final revealed element in both runs.
Computed style: `font-style: italic`, `text-align: right` — distinct from poem
lines (which are left-aligned, non-italic). Confirmed visually in screenshot
(`build/verify-desktop-full.png`, `build/verify-mobile-full.png`). PASS.

**6. Stable after full reveal, no loop/restart**
Captured full class list of all elements, waited 3s, re-captured — identical
(`stable: true`) on both viewports. Timer uses `clearInterval` once `idx >= total`
(confirmed by reading `build/poem.html:134-136`). PASS.

**7. Poem is genuinely public domain, cited**
"The Road Not Taken" by Robert Frost, first published in *Mountain Interval*
(Henry Holt & Co.), 1916 — pre-1929 US publication, unambiguously public domain.
Citation visible on page in `.credit` element (confirmed in screenshot, bottom
of page, both viewports). PASS.

**8. Legible and centered, no horizontal scroll, at desktop (≥1200px) and mobile (~375px)**
Checked `document.documentElement.scrollWidth > clientWidth` at 1400px and
375px: `false` both. Screenshots show centered column, no clipped text, no
overflow at either width. PASS.

**9. Single `.html` file under `build/`**
`build/poem.html` — one file, inline `<style>`/`<script>` only, verified by
reading the file directly (no external `<link>`/`<script src>` tags present). PASS.

## Result: 9/9 PASS (pass 1, pre-designer/a11y-patch)

## Caveats for this pass
- designer and accessibility are patching the same file concurrently — this
  pass is a baseline confirmation, not the final sign-off. A second pass
  will re-run this exact script after their "done" ping to confirm nothing
  regressed (especially criterion 3 cadence and criterion 6 stability, since
  those are timer-logic-dependent and easy to break with unrelated CSS/markup
  edits).
- Not independently re-measured here (out of verifier's lane per contract,
  accessibility owns these): WCAG AA contrast ratio, `prefers-reduced-motion`
  behavior. Visually the reduced-motion CSS block is present in the file
  (`build/poem.html:71-76`) but not exercised by this script.

## Artifacts
- `build/verify-desktop-full.png` — full-page screenshot, 1400x900, after full reveal
- `build/verify-mobile-full.png` — full-page screenshot, 375x812, after full reveal


---

# Pass 2 — Final sign-off (post designer inline-block wrap fix, post a11y review)

Re-ran the identical Playwright script against the final `build/poem.html`
(after designer's `.line` inline-block wrap fix and accessibility's review).

## Regression check — timing/order/console/stability (criteria 1,2,3,4,6)
Deltas (desktop, ms): `2003,2000,1999,2000,2001,2000,2000,2000,2000,2000,2000,1999,1999,2001,2000,2000,2000,2001,2000,2000`
Deltas (mobile, ms): all within 1999-2001.
Order: exact `1..21` sequential, both viewports. Console errors: `[]`, both.
Stable after full reveal (3s hold, no class changes): `true`, both.
No regression from pass 1. PASS (1,2,3,4,6).

## No horizontal scroll (criterion 8), incl. bonus 320px check
`hasHScroll: false` at 1400px, 375px, and 320px (below mission's 375px floor).
Wrap fix didn't introduce overflow. PASS.

## Reduced-motion cadence independent check (accessibility's finding, verifier-confirmed)
Emulated `prefers-reduced-motion: reduce` via Playwright:
- `transitionDuration: "0s"` on `.line` at reveal → instant, no fade (matches contract).
- 3 lines revealed by t=4.1s → confirms 2000ms cadence unchanged under reduced motion.
PASS — corroborates `build/A11Y.md` §2 independently (not just reading their claim).

## Contrast spot-check (accessibility's finding, verifier-confirmed)
Read computed styles directly: line color `rgb(43,38,32)` / bg `rgb(247,244,238)`,
credit color `rgb(107,100,89)` / same bg — matches the hex values `build/A11Y.md`
computed its 13.3:1 / 5.3:1 ratios from (`#2b2620`/`#f7f4ee`, `#6b6459`/`#f7f4ee`).
Not re-computed the ratio math myself (accessibility's lane per contract), but
confirmed the colors actually rendered match what they analyzed. PASS.

## Final screenshots
`build/verify-desktop-full.png`, `build/verify-mobile-full.png` — regenerated
post-patch, full reveal, both viewports. Signature italic/right-aligned/distinct,
credit line cited, no clipping, no overflow, centered column.

## FINAL RESULT: 9/9 criteria PASS. No blocking findings. Sign-off given.