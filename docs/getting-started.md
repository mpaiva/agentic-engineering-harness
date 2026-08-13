# Getting started

This gets you from nothing to a running, observable multi-agent workspace.

## Prerequisites

- **macOS or Linux.** (Herdr has a Windows beta; this guide assumes macOS/Linux.)
- **Node.js ≥ 22.19** for Atomic. Check with `node -v`.
- **A coding agent CLI.** This harness uses **Claude Code** (`claude`) as the default agent backend; Codex and 14+ others also work under Herdr.
- **git**.

Verified against: Atomic `0.9.12`, Herdr `0.8.0`, Ghostty `1.3.1`, Claude Code `2.1.x`.

## 1. Install the three layers

```bash
# Orchestration + verification
npm install -g @bastani/atomic

# Workspace / operations layer (installs to ~/.local/bin/herdr)
curl -fsSL https://herdr.dev/install.sh | sh

# Interaction surface (macOS)
brew install --cask ghostty
```

> Security note: `curl … | sh` executes a remote script. If you prefer, download `https://herdr.dev/install.sh`, read it, then run it. See [docs/security.md](security.md).

Make sure `~/.local/bin` is on your `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"   # add to ~/.zshrc to persist
```

Verify:

```bash
atomic --version   # 0.9.12
herdr --version    # herdr 0.8.0
claude --version   # 2.1.x
```

## 2. Teach Herdr to recognize your agent's state

Herdr classifies agent state most reliably when it has the agent's **lifecycle integration** installed. Install the one(s) you use:

```bash
herdr integration install claude
# also available: codex copilot cursor opencode devin droid grok kimi …
herdr integration status
```

Without an integration, Herdr falls back to reading the terminal buffer against screen-manifest rules — it still works, but lifecycle hooks are more accurate.

## 3. Authenticate your agent

Claude Code:

```bash
claude   # follow the login prompt once; the session persists
```

Atomic authenticates to a model provider on first run (`atomic`, then follow the auth flow). Atomic can also **print credentials for external clients** — see [atomic/README.md](../atomic/README.md).

## 4. Configure Ghostty (optional but recommended)

Copy the drop-in config:

```bash
mkdir -p ~/.config/ghostty
cp ghostty/config ~/.config/ghostty/config
```

See [ghostty/recommended-config.md](../ghostty/recommended-config.md) for the rationale.

## 5. Launch your first workspace

A workspace maps to **one meaningful engineering outcome** (one ticket / one feature). Open Ghostty, then:

```bash
./scripts/new-workspace.sh EE-1428 "Employee Event Details"
```

This creates a Herdr workspace and drops you into it. Inside a Herdr-managed pane the environment variable `HERDR_ENV=1` is set — that is how agents know they can drive Herdr.

## 6. Understand what you are looking at

Herdr shows a sidebar of workspaces and, inside each, the agent panes and their states:

```text
Employee Events (EE-1428)

● research          DONE
● planner           DONE
● frontend          WORKING
● backend           WORKING
● accessibility     BLOCKED   ← your attention goes here
● test              WORKING
```

You are meant to watch the **exceptions** (`BLOCKED`, `FAILED`), not every pane. See [docs/monitoring-agents.md](monitoring-agents.md).

## 7. Run the end-to-end example

```bash
./build.sh
```

Answer the question it asks. The lead refines your answer into `build/MISSION.md`, shows it
to you for confirmation, then hires its team and starts building.

## Where to go next

- **How to think about supervising** → [docs/operating-model.md](operating-model.md)
- **How verification and human gates work** → [docs/verification-and-gates.md](verification-and-gates.md)
- **How to define a workflow** → [atomic/README.md](../atomic/README.md)
- **Workspace and naming conventions** → [herdr/workspace-conventions.md](../herdr/workspace-conventions.md)
- **Isolation and least privilege** → [docs/security.md](security.md)
