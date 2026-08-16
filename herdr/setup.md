# Herdr setup

[Herdr](https://herdr.dev/) (`herdrdev/herdr`) is the workspace/operations layer: it holds real terminals open, groups agent panes into workspaces, and reports each agent's live state. This is how to install it, teach it to recognize your agents, and drive it.

> Verified against Herdr `0.8.0`. Every command below is from `herdr --help` and the agent skill (`herdr --skill`). The installed binary is always the authority — run `herdr <group>` (e.g. `herdr agent`) to see the current subcommands.

## Install

```bash
curl -fsSL https://herdr.dev/install.sh | sh   # installs to ~/.local/bin/herdr
export PATH="$HOME/.local/bin:$PATH"           # persist in ~/.zshrc
herdr --version                                # herdr 0.8.0
```

> The installer runs a remote script. For a trusted setup, download it, read it, then run it. See [../docs/security.md](../docs/security.md).

Config lives at `~/.config/herdr/config.toml`. Print the defaults to start from:

```bash
herdr --default-config > ~/.config/herdr/config.toml
```

## Client / server model

Herdr runs a persistent **server** (holding your terminals) and a **client** you attach with. This is what lets agents keep working after you close the lid or drop the network.

```bash
herdr                       # launch or attach to the persistent session
herdr --session rpt-204     # a named, persistent session
herdr status                # local client + running server status
herdr --remote user@box     # attach through SSH to a remote Herdr server
herdr server stop           # stop the running server via the API socket
```

Running on a rented/remote box (`--remote`) is the recommended isolation posture for highly autonomous work — see [../docs/security.md](../docs/security.md).

## Teach Herdr your agents' lifecycle state

Herdr classifies each agent pane as `idle`, `working`, `blocked`, `done`, or `unknown`. It is most accurate when the agent's **lifecycle integration** is installed:

```bash
herdr integration install claude
# also: codex copilot cursor opencode devin droid grok kimi kilo hermes qodercli …
herdr integration status
```

Without an integration Herdr falls back to **screen-manifest** detection (matching the live terminal buffer, titles, and progress sequences against TOML rules). It works, but lifecycle hooks are authoritative.

## Driving panes and agents from the CLI

Everything the sidebar shows is scriptable over the CLI / socket API. The groups:

```bash
herdr workspace     # create/list workspaces (one per engineering outcome)
herdr tab           # tabs within a workspace
herdr pane          # raw terminals: shells, servers, tests, input/output
herdr agent         # the recognized coding agent occupying a pane
herdr worktree      # git worktree helpers
herdr api           # socket API: `herdr api snapshot`, `herdr api schema`
```

The `agent` subcommands are the ones the harness leans on:

```bash
herdr agent list                       # agents + current states
herdr agent get <pane-id>                 # details for one agent
herdr agent start <name> --kind claude --pane <pane-id>   # start an agent in an existing pane
herdr agent prompt <pane-id> "…"          # submit a prompt to an agent
herdr agent send-keys <pane-id> …         # raw keystrokes
herdr agent read <pane-id>                # read the agent's terminal output
herdr agent wait <pane-id> --until done   # BLOCK until a state (the supervision primitive)
herdr agent focus <pane-id>               # focus it (marks it "seen")
herdr agent rename <pane-id> <name>       # names match [a-z][a-z0-9_-]{0,31}
herdr agent explain --file <buf> --agent <backend>   # why it's in its current state
```

> **`<pane-id>` is literal, not a stand-in for the role name.** On Herdr 0.8.0 these
> subcommands resolve a pane id (`w1:p5`) and reject a role name with `agent_not_found` —
> `herdr agent get docs` fails even while `herdr agent list` reports an agent named `docs`.
> Read the `pane_id` field out of `herdr agent list` and pass that. `herdr agent explain` is
> the odd one out: its bare-target form does not resolve at all, so capture the buffer first
> (`herdr agent read <pane-id> --source detection --lines 40 > /tmp/buf`) and pass
> `--file /tmp/buf --agent claude`, where `--agent` names the *backend* manifest, not the role.

### The supervision primitive

`herdr agent wait` is what turns "watch every terminal" into "wait for exceptions":

```bash
# Wait up to 15 min for an agent to finish or block; act only when it does.
herdr agent wait w1:p5 --until done --until blocked --timeout 900000
```

Note the state semantics from Herdr's own skill: `idle` = ready for input and its tab was seen in the UI; `done` = the same idle state after *unseen* background work finished; `blocked` = Herdr recognized an approval/question UI; `unknown` = present but unclassifiable — **not** proof of completion. CLI reads do **not** mark a tab "seen"; focusing it does.

## Agents driving Herdr (`HERDR_ENV`)

Inside a Herdr-managed pane, `HERDR_ENV=1` is set. Agents must check it before issuing control commands:

```bash
test "${HERDR_ENV:-}" = 1   # true only inside a Herdr pane
```

Print the full agent skill Herdr ships (authoritative rules for agent-driven control):

```bash
herdr --skill
```

## Next

- [workspace-conventions.md](workspace-conventions.md) — one outcome = one workspace; agent naming.
- [atomic-integration.md](atomic-integration.md) — mapping Atomic stages onto Herdr panes.
