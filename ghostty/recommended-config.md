# Ghostty recommended config

[Ghostty](https://ghostty.org/) is the **interaction surface** — a fast, native, GPU-accelerated terminal. In this harness its only job is to be a comfortable, terminal-first home for Herdr. It does **not** orchestrate and knows nothing about agents. Keep its config about *legibility and comfort during long supervision sessions*, not about agent logic.

> Verified against Ghostty `1.3.1`. The [`config`](config) file passes `ghostty +validate-config` cleanly. Every key was checked against `ghostty +show-config --default`.

## Install

```bash
mkdir -p ~/.config/ghostty
cp ghostty/config ~/.config/ghostty/config
# In Ghostty: super+shift+, reloads config; super+, opens it.
```

Validate any edits before reloading:

```bash
/Applications/Ghostty.app/Contents/MacOS/ghostty +validate-config \
  --config-file ~/.config/ghostty/config
```

## Why each choice

| Setting | Why it matters for agent supervision |
|---------|--------------------------------------|
| `font-family` / `font-size = 14` | You read agent output for hours. A clear monospace at a comfortable size reduces fatigue. Swap the family for whatever you have installed. |
| `theme = dark:…,light:…` | Follows the OS appearance so the surface is legible day and night. |
| `scrollback-limit = 100000000` | Autonomous agents emit a lot. Deep scrollback means you can inspect evidence *after* a run instead of losing it. (Evidence should also land in `artifacts/` — this is a safety net.) |
| `copy-on-select = clipboard` | Grabbing a file path or error out of agent output should be frictionless. |
| `window-save-state = always` | Restores your layout across restarts. Herdr also restores its own sessions, so the two together survive a reboot. |
| `confirm-close-surface = false` + `quit-after-last-window-closed = false` | You supervise by exception; a confirm dialog on every pane close is friction. Herdr holds the real sessions open regardless, so an accidental surface close is cheap to recover. |
| `unfocused-split-opacity = 0.6` | Dims inactive splits so the agent you're actually attending to visually stands out. |
| `macos-titlebar-style = tabs` | Native, minimal chrome — the terminal content is the focus. |
| `shell-integration-features` | Cursor/title/working-dir reporting also helps Herdr's screen-manifest state detection stay accurate for agents without a lifecycle integration. |

## What this config deliberately does *not* do

- **No agent-specific keybindings or automation.** That belongs to Herdr (`herdr` keybindings in `~/.config/herdr/config.toml`) and to Atomic (workflow definitions). Ghostty stays a dumb, fast surface so it remains replaceable.
- **No orchestration.** If you find yourself wanting Ghostty to "know" which agent is blocked, that's Herdr's job — see [../herdr/setup.md](../herdr/setup.md).

## Alternatives

Any terminal works — Herdr runs inside iTerm, Terminal.app, Alacritty, WezTerm, etc. Ghostty is *recommended* for speed and a native feel, and to avoid pushing engineers into a proprietary agent IDE, but nothing in the harness depends on it.
