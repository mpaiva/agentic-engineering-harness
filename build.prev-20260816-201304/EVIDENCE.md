# Evidence

## Poem choice

"The Road Not Taken" by Robert Frost. First published in *Mountain
Interval*, 1916 (Henry Holt and Company). US pre-1929 publication —
unambiguously public domain. Cited on-page in a static `.credit` line
below the signature.

## File

`build/poem.html` — single self-contained file, inline CSS/JS only, no
external requests.

## Verification method

Headless Chromium via Playwright (`npx`-installed in `/tmp/pw-check`,
not committed to repo). Script: loaded `file:///Users/mp/git-repos/atomic-cockpit/build/poem.html`
directly (matches criterion 1, `file://` with no server), then:
- checked line 1 is revealed within 200ms of load and line 2 is not
- waited through the full reveal (21 elements: 20 poem lines + signature)
  and read `data-revealed-at` timestamps off each element
- computed deltas between consecutive reveals
- checked no new `[data-revealed-at]` elements appear after the timer
  should have stopped
- checked viewport 1400px and 375px for horizontal scroll
- captured console/page errors

## Results

```
line1 revealed at ~200ms: true
line2 revealed at ~200ms (should be false): false
total revealed: 21
cadence within 2000ms±100ms for all steps: true
first delta (should be immediate, ~0): 0
signature revealed: true credit revealed: false
stable after full reveal (no new elements): true
console/page errors: []
horizontal scroll at 1400px (should be false): false
horizontal scroll at 375px (should be false): false
```

`credit revealed: false` is expected — the credit/citation line is
static (always visible via CSS, not timer-driven) so the author
signature (`.signature`, data-i=21) is the true final timed reveal, per
contract.

## Criteria mapped

1. Opens via `file://`, no console errors — confirmed (empty errors array).
2. Only line 1 visible on load — confirmed.
3. ~2000ms cadence — confirmed, all deltas within ±100ms (script uses
   exact `setInterval(fn, 2000)`, so in-practice jitter was near 0).
4. Lines in order, no skip/dup — confirmed by sequential `data-i` reveal
   order in the timer loop (`querySelectorAll` DOM order, incremented
   index, no shuffling).
5. Signature last, visually distinct (italic, right-aligned, smaller) —
   confirmed.
6. Stable after full reveal, timer cleared via `clearInterval` — confirmed.
7. Public domain poem, cited on page — confirmed (see Poem choice above).
8. No horizontal scroll at 375px or 1400px+ — confirmed.
9. Single `.html` file under `build/` — confirmed.

## Not yet covered here

- `prefers-reduced-motion` behavior (CSS media query present in file;
  not exercised by this headless check — accessibility reviewer should
  verify).
- WCAG AA contrast — not measured here; accessibility reviewer to check.
