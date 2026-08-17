# Contract

## File

`build/poem.html` — single self-contained file. Inline `<style>` and
`<script>` only. No external requests, no CDN, no build step. Must open
correctly via `file://`.

## Poem

Implementer/designer pick one short (8–20 line), unambiguously
public-domain poem (author died 70+ years ago, or pre-1929 US publication).
Cite author + title + source visibly on the page (small credit line near
the signature is fine). Record the choice in `build/EVIDENCE.md` later.

## Structure

- Each poem line is its own DOM element (e.g. `<p class="line" data-i="N">`),
  hidden by default (`opacity:0` or `visibility:hidden` — not `display:none`,
  so layout doesn't jump).
- A single JS timer (`setInterval` or chained `setTimeout`) reveals lines
  in order, one every 2000ms. Line 1 reveals immediately on load (tick 0),
  not after the first 2s wait.
- After the last poem line, the author signature element reveals as the
  final step, visually distinct (smaller/italic/right-aligned) from poem
  lines.
- After signature reveals, the timer stops. No loop, no restart control.

## Timing verification hook (for verifier)

Expose reveal timestamps for scripted checking without changing visuals:
each revealed element gets a `data-revealed-at` attribute set to
`Date.now()` at reveal time (or log to `console.log`). This lets verifier
confirm ~2000ms cadence via headless browser or dev tools without guessing.

## Responsiveness

Centered content column, max-width ~600–700px, fluid font-size (`clamp()`
or `vw`-based ok). No horizontal scroll from 375px to 1400px+ viewport
width.

## Accessibility notes (for accessibility reviewer)

- Respect `prefers-reduced-motion`: if set, skip fade transitions (instant
  reveal) but keep the 2s timing cadence — motion is decorative, timing is
  the feature.
- Revealed text must reach WCAG AA contrast against background.
- No reliance on color alone; signature distinguished by style, not color
  only.

## Ownership

- **implementer**: builds `build/poem.html` end to end (markup, poem
  content, reveal timer, base styles).
- **designer**: reviews/adjusts typography, spacing, responsive layout,
  signature styling — patches the same file, coordinate over intercom to
  avoid clobbering.
- **accessibility**: reviews rendered file for contrast, reduced-motion,
  semantic markup — reports findings, implementer/designer patch.
- **verifier**: independently confirms all 9 criteria in
  `build/MISSION.md` with evidence, writes findings back to lead.
