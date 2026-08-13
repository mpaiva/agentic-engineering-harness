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

Claude Code (optional — only if you use it directly, outside Atomic):

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

## 5. Run your first build

This is the primary path. Open Ghostty, then from the repo root:

```bash
./build.sh
```

`build.sh` starts a Herdr session and boots one Atomic agent — the **lead** — in it. The lead
asks one question, **"What do you want to build today?"**, refines your answer into
`build/MISSION.md`, shows it to you for confirmation, then hires the specialists that mission
needs (`scripts/team.sh add <role>`) and drives the build. Add `--dry-run` first if you just
want to see the plan without launching anything.

## 6. Understand what you are looking at

Herdr shows a sidebar of the panes it is holding open and their states. As the lead hires
specialists, the cockpit grows from one pane to N:

```text
harness

● lead              WORKING
● architect         DONE
● implementer       WORKING
● verifier          BLOCKED   ← your attention goes here
● docs              WORKING
```

Pane names are the role names from `team/ROLES.md` (`lead`, `implementer`, `verifier`, …) —
domain-neutral, chosen by the lead for what this particular mission needs. You are meant to
watch the **exceptions** (`BLOCKED`, `FAILED`), not every pane. See
[docs/monitoring-agents.md](monitoring-agents.md).

```bash
cat build/ROSTER.md    # who the lead hired, and why
cat build/MISSION.md   # the confirmed mission
```

## 7. Secondary path: manual workspaces and panes

`build.sh` and `scripts/team.sh` cover the normal flow above. Herdr can also be driven
directly, one workspace per engineering outcome, if you want lower-level control over panes
outside the lead/specialist model — for example scripting your own pane choreography instead
of hiring through `team.sh`:

```bash
./scripts/new-workspace.sh RPT-204 "CSV Export"
```

This creates a Herdr workspace and drops you into it. Inside a Herdr-managed pane the
environment variable `HERDR_ENV=1` is set — that is how agents know they can drive Herdr. See
[herdr/workspace-conventions.md](../herdr/workspace-conventions.md) for the conventions this
follows, and `scripts/launch-feature.sh` for a worked example of driving panes by hand.

## Where to go next

- **How to think about supervising** → [docs/operating-model.md](operating-model.md)
- **How verification and human gates work** → [docs/verification-and-gates.md](verification-and-gates.md)
- **How to define a workflow** → [atomic/README.md](../atomic/README.md)
- **Workspace and naming conventions** → [herdr/workspace-conventions.md](../herdr/workspace-conventions.md)
- **Isolation and least privilege** → [docs/security.md](security.md)
