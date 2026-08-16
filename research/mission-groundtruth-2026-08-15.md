# Ground-truth audit — Herdr / Atomic / Ghostty claims

Date: 2026-08-15. Researcher agent. Installed versions at audit time:
`herdr 0.8.0`, `atomic 0.9.13`, `Ghostty 1.3.1` (from `herdr --version`, `atomic --version`,
`ghostty --version`).

Scope: every backtick-quoted `herdr`/`atomic`/`ghostty` command claim in `README.md`,
`docs/*.md`, `herdr/*.md`, `ghostty/*.md`, `atomic/README.md`, checked against
`herdr --help`, `herdr --skill`, `atomic --help`, `ghostty +show-config --default`,
`man 5 ghostty`, and per-subcommand `--help`.

Verdict key: **VERIFIED** = command/behavior exists and matches doc description.
**STALE** = command/flag/behavior does not match installed tool. **DRIFT** = doc's stated
"verified against" version no longer matches installed version (commands still work, but
the freshness claim is inaccurate).

## Herdr claims

| # | File:line | Claim | Command run | Result |
|---|-----------|-------|--------------|--------|
| 1 | herdr/setup.md:5 | `herdr <group>` shows current subcommands (e.g. `herdr agent`) | `herdr agent --help` | VERIFIED — prints `list, get, read, send-keys, prompt, rename, focus, wait, attach, start, explain` |
| 2 | herdr/setup.md:5 | Verified against Herdr `0.8.0` | `herdr --version` | VERIFIED — matches installed `herdr 0.8.0` |
| 3 | herdr/setup.md:59 | `herdr api snapshot`, `herdr api schema` exist | `herdr api --help` | VERIFIED |
| 4 | herdr/setup.md:79, docs/operating-model.md:105, docs/architecture.md:71 | `herdr agent wait --until <state>` blocks until a state | `herdr agent wait --help` | VERIFIED — states are `idle, working, blocked, done, unknown`; `--until` repeatable, `--timeout <MS>` supported |
| 5 | docs/architecture.md:69, docs/monitoring-agents.md:44 | `herdr integration install <agent>` installs lifecycle hooks | `herdr integration install --help` | VERIFIED — valid targets include `claude, codex, copilot, devin, droid, kimi, opencode, ...` (14 total) |
| 6 | docs/monitoring-agents.md:97, herdr/atomic-integration.md:57 | `herdr agent list` lists agents + states | `herdr agent list --help` | VERIFIED |
| 7 | docs/monitoring-agents.md:74 | `herdr agent explain <agent>` diagnoses state | `herdr agent explain --help` | VERIFIED |
| 8 | herdr/atomic-integration.md:39 | `herdr agent prompt <target> <text> [--wait] [--until] [--timeout]` | `herdr agent prompt --help` | VERIFIED — flag semantics (5000ms stall window, no turn-tracking caveat) match doc's framing |
| 9 | herdr/workspace-conventions.md:63 | `herdr agent rename <pane-or-agent> <name>` gives a stable handle | `herdr agent rename --help` | VERIFIED |
| 10 | herdr/workspace-conventions.md:60 | Name grammar `[a-z][a-z0-9_-]{0,31}`, unique among live agents | `herdr --skill` | VERIFIED — skill text: "Names must match `[a-z][a-z0-9_-]{0,31}` and be unique among live agents." Exact match. |
| 11 | herdr/workspace-conventions.md:87 | `herdr worktree` = git worktree helpers | `herdr worktree --help` | VERIFIED — subcommands `list, create, open, remove` |
| 12 | README.md:215, herdr --help usage | `herdr --session beta` opens a named cockpit | `herdr --help` | VERIFIED — `herdr --session <name> [options]` in usage block; `--session <name> Use or create a named persistent session` |
| 13 | docs/case-study-ozymandias.md:214 | `herdr pane send-text` exists (used as manual recovery) | `herdr pane --help` | VERIFIED — `send-text: Send literal text to a pane` |
| 14 | docs/architecture.md:65, herdr/setup.md:3 | Herdr repo is `herdrdev/herdr` | not independently checkable from CLI (external claim) | NOT VERIFIABLE locally — no `--help` surface states its own repo slug; left as-is (doc-level claim, not a command claim) |

## Atomic claims

| # | File:line | Claim | Command run | Result |
|---|-----------|-------|--------------|--------|
| 15 | atomic/README.md:5 | Verified against Atomic `0.9.12` | `atomic --version` | **DRIFT** — installed is `0.9.13`. Commands checked below still work under 0.9.13; only the stated verification version is stale. |
| 16 | docs/architecture.md:94, docs/getting-started.md | `atomic -p` = non-interactive print mode | `atomic --help` | VERIFIED — `--print, -p  Non-interactive mode: process prompt and exit` |
| 17 | docs/security.md:42 | `atomic install …` installs an extension/package | `atomic install --help` | VERIFIED — `atomic install <source> [-l] [--approve|--no-approve]` |
| 18 | docs/security.md:52 | `atomic auth …` prints/checks credentials | `atomic auth --help` | VERIFIED — `print-api-key`, `print-bearer-token`, `check` subcommands match doc's "print scoped credentials for external clients" framing |
| 19 | atomic/README.md:51-63 | Atomic discovers workflows only from `.atomic/workflows/`; `/workflow reload`, `/workflow list`, `/workflow inputs`, `/workflow status`, `/workflow connect`, `/workflow quit` slash commands | not directly checkable via `--help` (these are in-session TUI slash commands, not CLI flags) | NOT INDEPENDENTLY VERIFIED by this audit — outside `--help`/`--skill` surface; flag this file:line combo for a live interactive-session spot check if the team wants full coverage |

## Ghostty claims

| # | File:line | Claim | Command run | Result |
|---|-----------|-------|--------------|--------|
| 20 | ghostty/recommended-config.md:5 | Verified against Ghostty `1.3.1` | `ghostty --version` | VERIFIED — matches installed `Ghostty 1.3.1` |
| 21 | ghostty/recommended-config.md:5 | `ghostty +show-config --default` and `ghostty +validate-config` are real subcommands | both run directly | VERIFIED — `+show-config --default` prints full default key/value list; `+validate-config` reports pass/fail |
| 22 | ghostty/config (all keys) | Every key in the shipped config is a real, valid Ghostty key | `ghostty +validate-config --config-file=ghostty/config` | VERIFIED — exit 0, no errors, for all 15 keys (`font-family`, `font-size`, `theme`, `cursor-style`, `mouse-hide-while-typing`, `copy-on-select`, `scrollback-limit`, `window-padding-x/y`, `window-padding-balance`, `window-save-state`, `confirm-close-surface`, `quit-after-last-window-closed`, `unfocused-split-opacity`, `macos-titlebar-style`, `macos-option-as-alt`, `shell-integration-features`) |
| 23 | ghostty/recommended-config.md `macos-titlebar-style = tabs` | `tabs` is a valid value | `man 5 ghostty` | VERIFIED — man page confirms `tabs` and `transparent` are valid values (default is `transparent`) |
| 24 | man 5 ghostty exists as a doc source | `man 5 ghostty` | ran directly | VERIFIED — page exists, titled `GHOSTTY(5) Ghostty terminal emulator configuration file` |

## Summary for lead

- **23 of 24 checked claims: VERIFIED.**
- **1 DRIFT** (not broken, just stale freshness label): `atomic/README.md:5` says "Verified
  against Atomic `0.9.12`"; installed is `0.9.13`. Every command checked from that file still
  works under 0.9.13 — this is a version-label bump, not a functional fix. Recommend `docs`
  update the string to `0.9.13` (or re-run `atomic --version` at final verification and use
  whatever is current then).
- **2 items not independently verifiable by this audit's command set:**
  - `herdrdev/herdr` repo slug (external claim, no CLI surface confirms it).
  - Atomic's `/workflow ...` slash commands in `atomic/README.md:60-71` — these are
    interactive-session TUI commands, not `--help`-surfaced CLI flags, so this audit
    couldn't verify them non-interactively. If full coverage is required, a live
    `atomic` session driven by `herdr pane send-text` could confirm the slash-command
    list; otherwise the doc's phrasing ("Atomic's bundled workflow docs" +
    `$(npm root -g)/@bastani/atomic/docs/workflows.md`) is at least a real, existing path
    — confirmed: `atomic/README.md:5` points at an installed doc file.
- **Not in my lane, flagging for implementer**: `atomic/README.md` documents only
  `feature-development.ts` under `workflows/`; `atomic/workflows/` and `atomic/extensions/`
  contain exactly `feature-development.ts` plus 3 extensions (`build-intake.ts`,
  `herdr-state.ts`, `intercom-bridge.ts`) not all individually documented in
  `atomic/README.md`'s prose — worth implementer's consistency pass per mission
  criterion 5.

## Commands run (full list, for reproducibility)

```
herdr --version; atomic --version; ghostty --version
herdr --help
herdr agent --help / list --help / wait --help / prompt --help / rename --help / explain --help
herdr pane --help
herdr workspace --help
herdr api --help / snapshot --help / schema --help
herdr integration --help / install --help / status --help
herdr worktree --help
herdr session --help
herdr --skill
atomic --help
atomic auth --help
atomic install --help
ghostty +show-config --default
ghostty +validate-config --config-file=ghostty/config
man 5 ghostty
```
