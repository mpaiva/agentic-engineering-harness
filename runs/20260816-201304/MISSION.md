# Mission

## Raw idea

> What do you want to build today?

a single HTML landing page that reveals one line of a public-domain poem every 2 seconds until the whole poem is shown, ending with the author signature

## Goal

A single self-contained HTML file (no build step, no server, no external
runtime dependencies) that, when opened in a browser, reveals a public-domain
poem one line at a time, one new line every 2 seconds, until every line is
visible, then reveals the author's signature line last.

## Success criteria

1. Opening the file directly in a browser (`file://` URL, no server) renders
   a working page — no console errors.
2. On load, zero poem lines are visible except line 1, which appears
   immediately (or within the first reveal tick).
3. A new line appears every 2000ms ± 100ms, measurable via the browser's
   dev tools / a scripted timer check.
4. All lines appear in original poem order; no line is skipped, duplicated,
   or reordered.
5. After the last poem line, the author's name/signature appears as the
   final revealed element, visually distinguished (e.g. smaller, italic, or
   right-aligned) from the poem body.
6. Once fully revealed, the page is stable — no further changes, no loop,
   no restart.
7. The poem text is genuinely public domain (published pre-1929 or explicit
   public-domain dedication), with the source/author cited in the page or an
   accompanying note.
8. The page is legible and centered on both a desktop-width (≥1200px) and a
   mobile-width (~375px) viewport — no horizontal scroll, no clipped text.
9. All code (HTML/CSS/JS) lives in one `.html` file under `build/`.

## Constraints

- Single HTML file. Inline `<style>` and `<script>`; no external JS/CSS
  frameworks, no CDN links, no build tooling.
- Plain HTML/CSS/JS only — no frameworks (React, Vue, etc.), no npm.
- Must work opened directly from disk (`file://`), not just via a dev server.
- Poem choice: pick one well-known, unambiguously public-domain short poem
  (assumption — human did not specify one; implementer/designer choose and
  cite it in the mission confirmation step is not required, but must cite
  it on the page).

## Non-goals

- No poem picker, no multiple poems, no configuration UI.
- No backend, no persistence, no analytics.
- No replay/restart button, no animation library, no sound.
- No responsive framework or design system — hand-rolled CSS only.

## Stop rules

Stop when all 9 success criteria are demonstrated with evidence:
opening the file, a timed reveal check (e.g. scripted or logged timestamps
showing ~2s cadence), and a visual check at two viewport widths. Record
results in `build/EVIDENCE.md`. If any criterion cannot be met, write
`build/BLOCKED.md` and stop for the human instead of guessing further.
