# Mission

## Raw idea

> What do you want to build today?

I need help finishing building this harness so I can make this repository available for
others to use. I need you to assess where we are, create a long term plan - autonomously
without my approval - and fire up as many agents needed to get this in a quality statge a
senior engineer will want to use this repository to build complex solutions with
multi-agents and atomic

## Goal

`agentic-engineering-harness` becomes a reference repo a senior engineer can clone, follow
`README.md` to set up Ghostty + Herdr + Atomic, and run `./build.sh` to watch a real
multi-agent build happen — with no dead links, no scripts that fail their own syntax check,
no doc that claims a capability the tools don't have, and every known-fixable defect closed.
Genuinely unverifiable claims (anything needing a live paid run) are labeled honestly rather
than silently left in a broken or ambiguous state.

## Success criteria

1. Every relative link, `<img src>`, and `href` in every `.md` file resolves to a file that
   exists in the repo.
2. Every shell script in `scripts/` and `build.sh` passes `bash -n` (syntax) and, where
   `shellcheck` is available, has no unaddressed error-level finding.
3. G1 from `research/gap-assessment-2026-08-14.md` (the 10-minute intake timeout in
   `build.sh`) is closed, or `research/review-2026-08-14-g1-intake-fix.md` is confirmed
   current and cites the fix commit.
4. The "poem-page" inconsistency noted in the gap assessment (removed case-study writeup vs.
   remaining `docs/samples/poem-page.html` + README reference) is resolved one way,
   deliberately, and documented as a decision.
5. Every TypeScript file under `atomic/workflows/` and `atomic/extensions/` is internally
   consistent with what `atomic/README.md` documents (no described-but-missing workflow, no
   workflow undocumented if it's part of the primary `build.sh` flow).
6. `team/*.md` role briefs remain domain-neutral (no web-app-, language-, or domain-specific
   assumption baked in) — spot-checked against the `AGENTS.md` rule that already states this.
7. A senior-engineer skim test: `README.md` → `docs/getting-started.md` →
   `docs/architecture.md` → `docs/operating-model.md` forms one coherent, non-contradictory
   path with no stale command examples (verified against installed `--help` output, per
   `AGENTS.md`).
8. `build/EVIDENCE.md` exists at the end, listing each criterion above, the command or check
   that verified it, and its result.

## Constraints

- No runtime dependencies or package manifests added (per `AGENTS.md`).
- No secrets, no `~/.config/herdr` or `~/.atomic` contents committed.
- No new GitHub remote, no push, unless the human explicitly asks.
- `build/` output stays git-ignored; only `docs/samples/` may hold a kept artifact, and only
  byte-identical to what agents produced, with a checksum and provenance note (per
  `AGENTS.md`).
- Ground every claim about Herdr/Atomic/Ghostty behavior in the actual installed tool
  (`--help`, `--skill`, man pages), not assumption.
- This is a docs-and-scripts reference repo, not an application. Do not invent a test suite,
  a build pipeline, or a framework it doesn't have.

## Non-goals

- No new features, workflows, or scripts beyond what's needed to close known gaps and fix
  found defects. Not building a plugin architecture, a web UI, or additional case studies.
- Not attempting G2 (`--resume` mid-run correctness) or G3 (large end-to-end job completion)
  from the gap assessment live — those need a human-driven, paid, real run. They get
  labeled "requires live run, not attempted" rather than faked.
- Not redesigning the Ghostty/Herdr/Atomic layering or `team/ROLES.md` composition model.
- Not writing new case studies or demo recordings.

## Stop rules

Stop when every success criterion above is either (a) checked off with a command/output
in `build/EVIDENCE.md`, or (b) explicitly logged as out of autonomous reach (G2/G3-style)
with the reason. If a repair cycle on the same defect exceeds 3 rounds, stop that thread,
write `build/BLOCKED.md`, and wait for the human instead of continuing to grind.
