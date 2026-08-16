# DESIGN.md — Getting Started page

Static HTML/CSS/JS layout spec for the 8-step guide. Content source: `README.md`
"Set up" (3 steps) + "Build something" (5 steps), in that order.

## 1. Page structure (top to bottom)

```
<header>            page title + one-line description + progress note ("8 steps")
<main>
  <section id="setup">
    <h2>Set up (you do this once)</h2>
    <ol> step 1, step 2, step 3 </ol>
  </section>
  <section id="build">
    <h2>Build something</h2>
    <p>intro: "You need two terminal windows..."</p>
    <ol start="4"> step 4, step 5, step 6, step 7, step 8 </ol>
  </section>
</main>
<footer>       optional: "Source: README.md" text, no links required
```

Steps are numbered 1–8 continuously across both sections (not reset at "Build
something") so the reader always knows their place in the whole sequence.
Use `<ol>`/`<li>` for real DOM semantics; visually each `<li>` is a full-width card.

## 2. Anatomy of one step (repeated 8x)

Each step is a `<li class="step">` containing, in this order:

1. **Step header** — number badge + title, e.g. `1  Get the project`. Number in a
   circular badge, bold, high contrast. Title as `<h3>`.
2. **Body text** (if the README has instructional prose before the command, e.g.
   "Open your terminal app. Type this and press Return.") — plain paragraph, muted
   color, smaller than title.
3. **Command block(s)** — one `<pre><code>` block per fenced code block in the
   README step. Monospace font, distinct background (card-within-card), left
   border accent in the theme color. Multi-line commands (Step 1 has two lines:
   `git clone ...` + `cd ...`) stay in ONE code block, copied as one multi-line
   string — matches how the README presents them together.
4. **Copy button** — top-right corner of each command block (see §3).
5. **"You will see" callout** — visually distinct box below the command, NOT
   plain paragraph text. Label "You will see:" in small caps/bold, followed by
   the exact README text. Use a left border + subtle background tint, different
   color from the command block, so a skimmer's eye can jump from "command" to
   "what happens next" without reading prose.
6. **Extra notes** (only where README has them) — rendered as a plain paragraph
   below the callout, not styled as a warning unless the README itself flags a
   problem case. Two steps have this:
   - Step 2: "If you see a red ✗, the message tells you what to fix..." — style
     as a plain note paragraph (not an alarm box; it's informational, matches
     README's calm tone).
   - Step 3: "To leave the program, hold Control and press C. Do this twice." —
     plain note paragraph.
   - Step 4: list of three example answers — render as a `<ul>` under the body
     text, before the "you will see" callout (matches README order).
   - Step 5: list of three plan-review bullets (Goal/Success criteria/Non-goals)
     — same treatment, `<ul>`, before the callout.
   - Step 6 ("Watch the agents work"): the status-word table (working/idle/
     blocked/done) — render as a real `<table>`, 2 columns, header row "Word" /
     "What it means". `blocked` row gets a subtle highlight (background tint)
     since README calls it out as the one to watch — this is presentation
     emphasis only, not new content.

## 3. Copy button — placement, states, focus

- **Placement**: absolutely positioned top-right inside each command block's
  padding, so it never wraps the code text and stays reachable at any viewport
  width down to ~360px (shrinks to icon-only below ~480px, see §5).
- **Label**: text "Copy" by default (plus an inline SVG or unicode glyph is
  optional — text alone satisfies the accessible-name requirement without
  needing aria-label gymnastics).
- **States**:
  - Default: outline button, low visual weight (it's a utility, not the hero).
  - Hover/active: background fill, no layout shift.
  - Clicked → success: label swaps to "Copied" for ~1.5s then reverts to
    "Copy". This is the only feedback mechanism — no toast, no modal (keeps
    JS minimal and keeps focus in place).
  - If `navigator.clipboard.writeText` rejects: label swaps to "Copy failed"
    for ~1.5s, no console error thrown to the user-visible console beyond a
    caught, logged warning (success criterion 6 requires *no* console errors
    on load — a caught rejection during a user-initiated copy click is a
    runtime edge case, not a load-time error, but keep it a `console.warn`,
    not `console.error`, and only on actual failure).
- **Focus-visible**: every button gets a `:focus-visible` outline — 2px solid,
  high-contrast color distinct from the page background AND from the command
  block's border accent, with ~2px offset so it doesn't get clipped by the
  button's own border-radius. No default browser outline suppression without
  this replacement. Same focus style applies to any other interactive control
  on the page (there are none besides the 9 copy buttons — one per command
  block; Step 1 has one multi-line block, so 8 steps → 8 command blocks → 8
  copy buttons, one each).
- **Keyboard path**: buttons are native `<button>` elements (not `<div
  onclick>`), so Tab order follows DOM order top-to-bottom through the 8 steps
  automatically, and Enter/Space activate by default — no custom key handling
  needed.

## 4. Visual language (color/type, non-prescriptive on exact hex)

- Three distinct visual zones per step, each a different background tone, so
  the eye parses "instruction / command / result" at a glance without reading
  every word:
  1. Step body text — page background (no card).
  2. Command block — darkest zone (code-editor-like), monospace font.
  3. "You will see" callout — lightly tinted zone, distinct hue from the
     command block (e.g. command = neutral dark, callout = a muted accent
     tint), sans-serif, same font as body text.
- Step number badges use the same accent color as the callout's left border,
  tying "this is step N" to "here's what step N produces" as one visual
  thread down the page.
- Headings (`h2` section titles, `h3` step titles) are the largest type on the
  page; body/callout text one step down; command block text monospace at a
  comparable size to body text (not smaller — commands must stay legible and
  easy to verify character-by-character before copying).

## 4a. Light/dark mode

CSS-only, zero JS, zero deps — no toggle control needed:

- Define all zone colors as CSS custom properties in `:root` (light values are
  the default): `--bg`, `--text`, `--card-bg`, `--command-bg`,
  `--command-text`, `--callout-bg`, `--callout-border`, `--badge-bg`,
  `--focus-outline`.
- Add one `@media (prefers-color-scheme: dark)` block that redefines the same
  variable names with dark values. Every rule in §4 references the variables,
  never a literal color, so this block is the only place dark values live.
- Respects OS-level setting automatically; no stored preference, no
  `localStorage`, no flash-of-wrong-theme concern since it's resolved before
  paint.
- Contrast requirement carries over to both modes: focus-visible outline
  (§3) and callout/command text must meet WCAG AA contrast against their
  zone background in *both* the light and dark variable sets — check both,
  not just one.

## 4b. Manual light/dark toggle (supersedes "no toggle" in §4a)

- **Placement**: fixed, top-right of the viewport, always visible (not inside
  `<header>` flow — `position: fixed` so it stays reachable while scrolling
  through 8 steps). Single `<button>`, not a two-button pair.
- **Control shape**: icon + short text label, e.g. sun/moon glyph (inline
  SVG or unicode — no icon font/CDN) plus visible text "Light"/"Dark" showing
  the mode you'd switch *to* (or the current mode — pick one and keep it
  consistent; recommend showing current mode so the icon reflects present
  state, matching a light switch's physical affordance).
- **ARIA**: `<button aria-pressed="true|false">` where `true` = dark mode
  active. Accessible name stays constant ("Toggle color theme"); `aria-pressed`
  communicates state — do not rely on visible icon/text swap alone. (A
  `role="switch"` + `aria-checked` pair is an equally valid alternative; pick
  `aria-pressed` on a native `<button>` for the simplest correct
  implementation — no extra role wiring needed.)
- **Focus-visible**: same outline treatment as copy buttons (§3) — 2px solid,
  offset, high-contrast against both the light and dark `--bg`. Verify the
  outline color itself is defined via a CSS variable so it stays visible in
  both themes (don't hardcode one outline color that only works in light
  mode).
- **Behavior / state machine**:
  1. First visit, no stored choice: page renders using
     `prefers-color-scheme` (§4a) exactly as before. Toggle's `aria-pressed`
     reflects that computed OS state on load (JS reads
     `matchMedia('(prefers-color-scheme: dark)').matches` once, or a CSS
     class approach; toggle must not silently disagree with what's on
     screen).
  2. User clicks/activates toggle: theme flips immediately (no reload), new
     choice written to `localStorage` (one key, e.g. `theme`, value `"light"`
     or `"dark"`), `aria-pressed` updates to match.
  3. Reload / return visit with a stored choice: stored choice wins over OS
     preference — apply it before/at first paint (inline tiny script or
     `data-theme` attribute set early) to avoid a flash of the wrong theme.
  4. Reload / return visit with no stored choice (never toggled, or storage
     cleared/blocked): falls back to `prefers-color-scheme` — behavior is
     identical to §4a's original spec.
  5. `localStorage` unavailable (private browsing edge case): toggle still
     flips the visual theme for the current page view via a JS-set attribute;
     persistence silently no-ops (no error thrown to console, no broken UI).
- **Implementation shape**: keep the CSS-variable structure from §4a. Toggle
  JS sets/removes a `data-theme="dark"` (or `"light"`) attribute on `<html>`;
  CSS adds a third rule tier — `[data-theme="dark"] { ... same vars ... }` and
  `[data-theme="light"] { ... same vars ... }` — that overrides the
  `prefers-color-scheme` media query when present, since attribute selectors
  win by explicit user choice. No `!important` needed if the attribute
  selector has equal/higher specificity than the media query block and comes
  later in source order, or is scoped to `:root[data-theme=...]`.
- **Accessibility check target**: both explicit states (`data-theme="light"`
  and `data-theme="dark"`) must independently pass axe-core with 0
  critical/serious violations — test the toggle in both directions, not just
  the OS-default path already covered by §4a.


## 4c. Scrollspy table of contents

- **Placement**: sidebar on wide viewports (≥ ~900px, room beside the
  ~720–800px content column from §5), `position: sticky; top: <header
  height>` so it stays in view while the reader scrolls the long single-page
  list. Below ~900px, collapses to a **sticky horizontal bar pinned under the
  header** (not a sidebar squeezed into no space) — a single row of 8 links,
  horizontally scrollable if it doesn't fit, same treatment as command-block
  overflow in §5 (scroll, not wrap). This keeps the TOC reachable without
  eating content width on phones.
- **Content**: 8 links, one per step, label = step number + short title (e.g.
  "1. Get the project"), `href="#step-1"` etc. matching the `id` on each
  `<li class="step">`. Real `<nav aria-label="Steps"><ol>…</ol></nav>` — list
  semantics again, not a flat row of `<a>` with no grouping.
- **Active-state visual treatment**: the entry for the step currently in
  view gets a distinct background tint + left border accent (same accent
  color family as the step badges/callouts from §4, so the TOC's "active"
  color visually matches the step it points at) plus a bold/heavier font
  weight. This must NOT be color alone — the weight + border change carries
  the state for users who can't perceive the color shift.
- **Scrollspy mechanism**: `IntersectionObserver` (vanilla JS, no deps, per
  MISSION addendum 4) watching each step `<li>`. When a step's observer entry
  crosses a mid-viewport threshold (e.g. `rootMargin: "-40% 0px -50% 0px"` so
  "current" is whichever step occupies the vertical center of the screen,
  not just whichever entered/exited at the edge), add the active class to
  its matching TOC link and remove it from all others. Exactly one active
  entry at a time; on load before any scroll, step 1 is active by default.
- **Click behavior**: clicking a TOC link scrolls smoothly to that step
  (`scroll-behavior: smooth` in CSS, or `element.scrollIntoView({behavior:
  "smooth"})`) — this is a same-page anchor jump, not a route change, so no
  page reload and no console error. Respect
  `prefers-reduced-motion: reduce` — skip the smooth animation (instant
  jump) for users who've set that OS preference; this is a standard,
  low-cost inclusion, not scope creep.
- **Focus-visible on links**: every TOC `<a>` gets the same `:focus-visible`
  outline treatment as copy buttons and the theme toggle (§3, §4b) — 2px
  solid, offset, contrast-checked in both light and dark themes. Tab order
  follows DOM order (TOC nav comes before `<main>` in source if sidebar-left,
  or wherever it's placed — pick one position and keep it consistent so Tab
  order is predictable, e.g. TOC nav immediately after `<header>`, before
  `<main>`).
- **Narrow-viewport keyboard/scroll interaction**: horizontal-bar mode still
  keeps all 8 links as real, individually focusable `<a>` elements — Tab
  moves through them left-to-right; the browser's native scroll-into-view on
  focus keeps the focused link visible even if the bar is mid-scroll.
- **Relationship to existing chrome**: TOC sits alongside the theme toggle
  (§4b, fixed top-right) and print button (from addendum 3) without
  overlapping — theme toggle and print button stay in the fixed top-right
  corner; TOC occupies the left sidebar or the sticky bar directly under the
  header, a separate zone.
- **Print**: TOC is non-essential chrome for printed output — hide it under
  `@media print` alongside the toggle/copy buttons/focus outlines (per
  addendum 3's existing rule), so the printed page shows just the 8 steps.
- **Accessibility check target**: axe-core pass on the `<nav>` (list
  semantics, link names, focus outline, contrast on both active and inactive
  states in both light and dark themes).
## 5. Responsive / skimmability rules

- Single column, max content width ~720–800px, centered — this is a guide to
  read top-to-bottom, not a dashboard.
- Section headers ("Set up", "Build something") get a sticky or at-least
  visually heavy divider so a reader who scrolls fast can still tell which
  half of the journey they're in.
- Long command output text (README prose inside "you will see") wraps
  normally; command blocks get horizontal scroll (not wrap) if a single
  command line is too long for the viewport, so copied text stays exact.
- Below ~480px width: copy button shrinks to a compact icon+short-label
  form but keeps its accessible name as "Copy" (not icon-only with no text
  alternative).

## 6. Content mapping table (all 8 steps, verbatim from README)

| # | Section | Title | Command block(s) | You will see | Extra |
|---|---------|-------|-------------------|---------------|-------|
| 1 | Set up | Get the project | `git clone https://github.com/mpaiva/atomic-cockpit` + `cd atomic-cockpit` (one block, 2 lines) | "lines of text about downloading files." | — |
| 2 | Set up | Install the tools | `./scripts/setup.sh` | "a list of green check marks (✓). This can take a few minutes." | note: red ✗ guidance |
| 3 | Set up | Log in | `atomic` | "a message that says you are logged in." | note: Ctrl+C twice to leave; mentions `/login`, "Claude Pro/Max" as body text, not a command block (not a shell command) |
| 4 | Build something | Start the build | `./build.sh` | "a message telling you to open a second window. The first window then waits. This is normal. Leave it open." | — |
| 5 | Build something | Open the second window | `herdr --session cockpit` | "a dark screen with a box in the middle. The box asks: *What do you want to build today?*" | — |
| 6 | Build something | Answer the question | none (no shell command — user types free text into the app) | "the screen change while an agent writes your plan. This takes a minute or two." | example answers list (3 bullets) |
| 7 | Build something | Read the plan and say yes | none | "the screen split into boxes after you say yes. Each box is one agent." | review bullets (Goal/Success criteria/Non-goals) |
| 8 | Build something | Watch the agents work | none | (no explicit "You will see" line in README for this step — omit the callout box for step 8, do not invent text) | status-word table; "blocked" row highlighted; note about team-chat pane is out of scope per MISSION (only the two ordered how-to sections, not "The team chat pane" subsection) |

Note for implementer: steps 6, 7, 8 have **no shell command** — do not fabricate
one. Success criterion 2 requires copy buttons on the commands that exist
(6 total command blocks across steps 1–5: step 1 has 1 combined block, steps
2–5 have 1 each = 5, plus step 1 = 6). Render steps 6–8 without a command
block/copy button section at all — just body text, list/table, and callout
where the README has one. Step 8 has no "You will see" text in the README —
leave that box out for step 8 rather than inventing one.

## 7. States (per role brief: every reachable state specified)

- **Default/loaded state**: all 8 steps visible, no accordion/collapse — this
  is a single static page, full content always visible (no JS-gated reveal).
- **Copy button — idle**: label "Copy".
- **Copy button — success**: label "Copied", reverts after 1.5s.
- **Copy button — failure**: label "Copy failed", reverts after 1.5s (clipboard
  API unavailable/denied — e.g. insecure context or permission block).
- **Keyboard focus state**: visible outline on whichever control has focus,
  defined once in §3, applies uniformly.
- **No empty state**: content is static and always present; there is no
  loading/error/empty state for the page itself (no network calls, no data
  fetch).
- **No responsive breakpoint failure state**: down to 360px width the layout
  degrades per §5 rules, never clips or hides content.
