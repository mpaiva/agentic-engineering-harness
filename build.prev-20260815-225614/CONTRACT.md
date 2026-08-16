# Contract — getting-started-page mission

Read `build/MISSION.md` first — it is authoritative. This replaces the previous
(emoji-stage) contract; that mission is done.

## File layout

```
build/artifacts/getting-started-page/
  index.html
  style.css
  app.js
```
No other runtime files, no CDN links, no fonts, no build step. (A `DESIGN.md` from the
designer is fine alongside these, same as last mission.)

## Content source of truth

`README.md`'s **"Set up"** section (Step 1–3) and **"Build something"** section (Step 1–5).
8 steps total, in that order. For each step, pull: the step title, the exact shell command(s)
(verbatim, including flags), and the "You will see" text. Do not invent steps or commands not
in the README. Do not include other README sections (troubleshooting, glossary, "Learn more").

## Shape

- `index.html`: 8 numbered step sections in README order, each with title, command block(s),
  and "you will see" text. A copy button per command block.
- `style.css`: readable, ordered, skimmable layout; visible `:focus-visible` styles for
  copy buttons and any interactive control.
- `app.js`: copy-to-clipboard for each command block (`navigator.clipboard.writeText`), no
  external deps, no console errors.

## Order

1. designer: produce `build/artifacts/getting-started-page/DESIGN.md` — layout for an
   ordered step guide (how steps/commands/copy-buttons/"you will see" are visually
   distinguished), informed by README's actual 8 steps.
2. implementer: build the 3 files per spec, transcribing the 8 steps from README.md exactly.
3. accessibility: review in place — keyboard reachability of copy buttons, focus indicator,
   axe-core cleanliness. Patch small issues directly, report back larger ones.
4. verifier: fresh independent pass, produce `build/EVIDENCE.md` mapping each of the 7
   success criteria to command output (Playwright, axe-core, clipboard check).

Designer and implementer can start in parallel (designer writes DESIGN.md + README step
extraction notes; implementer can scaffold file structure) but final CSS must follow
DESIGN.md once posted.
