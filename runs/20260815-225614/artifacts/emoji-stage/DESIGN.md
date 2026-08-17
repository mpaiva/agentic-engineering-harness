# DESIGN.md — emoji-stage

Interaction spec for implementer. Ghostty-feel: dark backdrop, one large centered
focal object, smooth entrance, subtle continuous idle motion.

## Layout

```
┌─────────────────────────────────────────┐
│                                           │  <- body: 100vh, dark bg (#0a0a0c),
│                                           │     flex column, centered content
│              [ HERO EMOJI ]              │  <- #hero: centered, ~40vh font-size
│                                           │     clamp(6rem, 20vw, 14rem)
│                                           │
│   😀  😎  🚀  🎉  🌈  🔥  🍕  🐙          │  <- picker: row, wraps on narrow
│                                           │     viewports, fixed near bottom third
└─────────────────────────────────────────┘
```

- Page: `100vh`/`100dvh`, `display:flex; flex-direction:column; justify-content:center;
  align-items:center`, background `#0a0a0c` (near-black, not pure black — matches
  Ghostty's soft-dark, avoids OLED-crush).
- Hero stage (`#hero`): fixed-height container (`min-height: 40vh`) centered in the
  flex column, single glyph, no border/box — the glyph *is* the object, like Ghostty's
  hero graphic sitting alone on the dark field.
- Empty state (before first pick): `#hero` shows a faint placeholder glyph `✨` at
  40% opacity, no idle animation running, with small caption below it:
  "Pick an emoji below to bring it to life." (dim gray `#666`, `0.9rem`). This
  disappears once any emoji is selected and never returns.
- Picker: `<div role="group" aria-label="Choose an emoji">` wrapping 8+ `<button>`
  elements, `display:flex; flex-wrap:wrap; gap:0.75rem; justify-content:center`,
  positioned in the lower third of viewport, comfortably below the hero with
  `margin-top: auto` + bottom padding `~3rem` so it never collides with hero at
  small viewport heights.
- Curated set (8, distinct visual weight/shape for variety): 😀 😎 🚀 🎉 🌈 🔥 🍕 🐙

## Picker button spec

- Each button: unstyled native `<button>`, glyph at `1.75rem`, padding `0.6rem`,
  `border-radius: 12px`, `background: transparent`, `border: 1px solid transparent`.
- Hover: `background: rgba(255,255,255,0.06)`.
- Selected (currently-shown-in-hero) button: `background: rgba(255,255,255,0.1)`,
  `border-color: rgba(255,255,255,0.2)` — persistent marker so keyboard/mouse users
  can see which emoji is live without looking at the hero.
- No pointer-only affordance — every state above must also apply on `:focus-visible`.

## Focus style

- `:focus-visible` on picker buttons: `outline: 2px solid #7dd3fc; outline-offset: 3px;
  border-radius: 12px` (light blue, high contrast against `#0a0a0c`, passes WCAG
  non-text contrast).
- Never suppress focus outline (`outline: none` is forbidden) — mission success
  criterion 4 depends on this being visible.
- Tab order: natural DOM order through the 8 buttons; no custom `tabindex`.

## Entrance animation (picker → hero)

- Trigger: click or Enter/Space on a picker button.
- Duration: **550ms**, easing **`cubic-bezier(0.16, 1, 0.3, 1)`** (expo-out — fast
  start, soft settle; this is the Ghostty-style "object arrives with weight" curve).
- Keyframes (`hero-enter`):
  - `0%`: `opacity: 0; transform: scale(0.4) translateY(24px);`
  - `60%`: `opacity: 1; transform: scale(1.06) translateY(-4px);` (slight overshoot —
    gives the "settle" feel)
  - `100%`: `opacity: 1; transform: scale(1) translateY(0);`
- Implementation note: replaying on repeated selection requires forcing reflow
  (remove class, trigger reflow via `void el.offsetWidth`, re-add class) or swapping
  between two alternating animation class names — either works, must-not-skip on
  re-select of a *different* emoji. Re-selecting the *same already-hero* emoji is a
  no-op (no re-trigger) to avoid jitter.
- Old hero glyph (if any): no separate exit animation — swap content at animation
  start (0ms), let the entrance keyframes carry the transition. Keeps JS simple and
  avoids overlap/flicker between two glyphs.

## Idle animation (continuous, post-settle)

- Type: **float** — vertical drift, matches Ghostty's slow ambient hero motion better
  than pulse/rotate (pulse reads as "loading," rotate reads as "spinning icon").
- Starts immediately after entrance animation completes (chain via `animationend` or
  simply run concurrently with `animation-delay: 550ms` on the idle keyframes so there's
  no gap).
- Duration: **4200ms**, `ease-in-out`, `infinite`, `alternate` — slow enough to read as
  ambient not distracting, matches Ghostty's slow-breathing background motion.
- Keyframes (`hero-idle`):
  - `0%`: `transform: translateY(0);`
  - `100%`: `transform: translateY(-14px);`
- Optional glow (nice-to-have, skip if time-constrained): `filter:
  drop-shadow(0 0 0 transparent)` → `drop-shadow(0 0 28px rgba(255,255,255,0.15))`
  alternating on the same timeline, cheap extra "alive" feel.
- Idle animation runs indefinitely until a *different* emoji is picked, at which point
  entrance animation restarts from scratch (idle is implicitly interrupted by class
  swap).

## Reduced motion

- `@media (prefers-reduced-motion: reduce)`:
  - Entrance: cut to instant or near-instant — `transition: none` / animation
    duration `0.01ms`, no scale/translate overshoot, just opacity 0→1 over `120ms`.
  - Idle float/glow: **disabled entirely** — hero sits static once shown.
  - This block must override both keyframe animations, not just shorten them —
    mission criterion 5 requires idle motion actually stops, not just slows.

## States (full enumeration)

| State | Hero content | Picker | Notes |
|---|---|---|---|
| Initial load | placeholder `✨` @ 40% opacity + caption | all buttons unselected | no animation running |
| Emoji selected (first time) | entrance plays, glyph settles, idle starts | selected button gets persistent highlight | caption removed permanently |
| Different emoji selected | old glyph replaced at t=0, new entrance plays | highlight moves to new button | idle from previous glyph is cut short, no conflict |
| Same emoji re-selected (already hero) | no change, no re-trigger | highlight unchanged | prevents jitter/flicker |
| Reduced motion, any selection | instant swap, static idle | same highlight behavior | see Reduced motion section |
| Keyboard focus on picker button (no selection yet) | unchanged | visible `:focus-visible` outline | independent of hover/selected state |
| JS error / no-JS fallback | static `✨` placeholder, buttons visible but inert | — | out of scope to build a no-JS mode; just don't crash-render broken markup — buttons should have real `type="button"` so they don't submit/reload if JS fails |

## Copy

- Placeholder caption: "Pick an emoji below to bring it to life."
- Picker group label (`aria-label`): "Choose an emoji"
- No other copy — mission's non-goals exclude search/categories/labels beyond this.

## Accessibility notes for accessibility-reviewer

- Each picker button needs an accessible name beyond the raw glyph — add
  `aria-label="<name>, e.g. Rocket"` per button (screen readers announce emoji
  inconsistently otherwise).
- `#hero` should be `aria-live="polite"` with a text equivalent (e.g. visually-hidden
  span "Now showing: Rocket") so the swap is announced — the glyph alone isn't
  sufficient for non-visual users.
- Color contrast: caption gray `#666` on `#0a0a0c` is borderline (~3.9:1) — verify
  with axe; bump to `#888` if it flags.
