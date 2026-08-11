# AGENTS.md — rules for coding agents working in this repository

This file is instructions for **any coding agent** (Claude Code, Codex, Atomic, etc.)
operating inside `agentic-engineering-harness`. It follows the `AGENTS.md` convention and
is also read by Atomic and Claude Code as context.

## What this repository is

A **reference harness** — documentation, conventions, Atomic workflow definitions,
Herdr conventions, and a runnable example. It is mostly Markdown plus a small amount of
TypeScript (Atomic workflows) and shell (scripts). There is no application to build and
no test suite to pass. Optimize for **clarity, accuracy, and groundedness**, not for
code volume.

## Ground truth over assumption

Every claim about Atomic, Herdr, or Ghostty must reflect what the installed tools
actually do. Before documenting a command or flag:

- Herdr: run `herdr --help`, then the relevant group (`herdr agent`, `herdr pane`,
  `herdr workspace`, `herdr api`). Herdr's own agent skill is authoritative — print it
  with `herdr --skill`.
- Atomic: run `atomic --help`; workflows are TypeScript extensions installed via
  `atomic install <source>`. See [atomic/README.md](atomic/README.md).
- Ghostty: `ghostty +show-config --default` and `man 5 ghostty`.

If a capability is desired but does **not** exist yet (for example, a first-class
Atomic↔Herdr adapter), label it clearly as **future / not implemented**. Do not write
docs that imply a command exists when it does not. When in doubt, verify against the
binary rather than against this repo's prose.

## Working style

- **Small, reviewable changes.** One meaningful change per commit. Descriptive messages.
- **Prefer editing existing files** over adding new ones. Match the surrounding voice:
  direct, second person, concrete commands in fenced `bash` blocks.
- **Artifacts, not memory.** If you investigate something, write the finding to a file
  under `research/`, `specs/`, or `artifacts/` rather than leaving it in the session.
- **Do not fabricate evidence.** "It should work" is not verification. If you cannot run
  something, say so and document the gap.

## Scope and guardrails

- Do **not** add runtime dependencies or package manifests without being asked; this
  repo is intentionally not an npm/cargo project.
- Do **not** commit secrets, API keys, tokens, or `~/.config/herdr` or `~/.atomic`
  contents. See `.gitignore`.
- Do **not** create a GitHub remote or push unless explicitly asked. This repo is local
  by default.
- Keep the three layers' responsibilities separate in anything you write:
  Ghostty = interaction surface, Herdr = workspace/operations, Atomic = orchestration.

## Verification for changes to this repo

Because there is no test suite, "done" means:

1. Markdown links resolve (relative paths point at files that exist).
2. Every shell/CLI snippet has been run or is copied verbatim from `--help` output.
3. TypeScript workflow files are internally consistent with `atomic/README.md`.
4. New docs are linked from `README.md` or a sibling doc (no orphans).

## Commit message convention

```text
<area>: <imperative summary>

<why, if not obvious>
```

Examples: `docs: clarify Herdr vs Atomic responsibility split`,
`atomic: add bounded repair stage to feature-development workflow`.
