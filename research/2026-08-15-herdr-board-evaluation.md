# herdr-board evaluation — can it be our kanban tab?

Date: 2026-08-15. Repo: nelsonPires5/herdr-board @ v0.14.0. Verified against the installed
Herdr 0.8.0 and atomic cockpit (Atomic-based).

## What herdr-board is

A Herdr **plugin** (Rust; ships a `board` binary = TUI + daemon + CLI). It turns kanban cards
into AI coding agents that run in visible Herdr panes. Columns are pipeline stages that can
prepend a system prompt and route success/failure to another column; automatic columns dispatch
a run, manual columns are human gates. State lives in SQLite under
`~/.local/share/herdr-board/`; Herdr state is untouched. One stable `card-<id>` tab per card.

Install: `herdr plugin install nelsonPires5/herdr-board --ref v0.14.0`
Open as tab: `herdr plugin pane open --plugin herdr-board --entrypoint board --placement tab --focus`

## Fit against THIS cockpit — the facts

| Check | Result |
|---|---|
| Herdr version (needs **exactly** 0.8.0 / proto 19) | ✓ we run 0.8.0 |
| Rust toolchain to install | ✓ cargo 1.97 present |
| Supported harnesses: Pi, Claude, Codex, OpenCode | ✗ **Atomic is NOT supported** |
| Our team model | Atomic sessions hired by a `lead`, talking over **intercom** |
| herdr-board's model | its own daemon dispatches its own agents per card |

## The decisive mismatch

Our cockpit orchestrates **Atomic** agents: `build.sh` boots a `lead`, the lead hires roles with
`scripts/team.sh`, and they coordinate over Herdr intercom (the team-chat feed). herdr-board
brings its **own** orchestrator (daemon + queue + dispatch) that launches **Pi/Claude/Codex/
OpenCode** agents — not Atomic. So its headline feature (move a card → an agent runs the stage)
cannot drive our lead/team. Adopting its auto-dispatch means running a **second, parallel
orchestration system** that does not know about our lead, our roster, or intercom.

## Three honest options

1. **Board as a passive VIEW our Atomic agents update (degraded mode).**
   Use herdr-board only for its columns/cards/history; do NOT use auto-dispatch. Our agents call
   the `board` CLI (`board comment`, `board move`, `board done`) to reflect task state. README
   confirms degraded mode "still dispatches and accepts `board done`" without a supported harness.
   - Cost: a Rust build + a background daemon + SQLite; wiring every role brief to call `board`;
     two state stores (build/ artifacts AND the board DB) to keep in sync.
   - Gain: a real, polished kanban TUI with history, comments, mobile layout — for free.

2. **Adopt herdr-board's own dispatch (Pi/Claude agents).**
   - Rejected for atomic cockpit: it replaces, not complements, the Atomic lead/intercom model the
     rest of the repo is built on. Two competing orchestrators is a maintenance and mental-model tax.

3. **Home-grown kanban tab, same ethos as `team-chat.sh`.**
   A dependency-free bash/awk TUI that reads simple card files under `build/` (e.g. one markdown
   file per card with a `status:` field, or a `build/BOARD/<column>/` dir layout). The lead/roles
   already write artifacts to `build/`; the board just renders them. Reuses the reflow/preview
   machinery we already built for team-chat.
   - Cost: we build and maintain it (but it's small, and matches the repo's "no heavy deps" rule).
   - Gain: zero new runtime deps, no second daemon, one source of truth (build/), full styling control.

## Recommendation

For a kanban that reflects **our Atomic team's** work, Option 1's value is undercut by the
Atomic mismatch (no precise signals) plus a Rust daemon and a duplicate state store; Option 2 is
a non-starter here. **Option 3 (home-grown, build/-backed) is the closest fit to atomic cockpit's
architecture and conventions** — the same choice we made for team-chat. Keep herdr-board on the
radar as a strong standalone tool; revisit Option 1 if Atomic ever becomes a supported harness or
if we want its history/comments UI badly enough to run its daemon.

## Also true

- The named tabs (`monitor` / `kanban` / `team` / `chat`) are **not** created by any cockpit
  script today — they were made by hand. `build.sh` only splits `lead` + `team-chat` panes into
  one tab. Automating tab creation (`herdr tab create` + pane layout) is a separate, straightforward
  change regardless of which kanban option we pick.
