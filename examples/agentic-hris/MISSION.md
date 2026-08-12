# Mission — Agentic-first HRIS (the team's north star)

This is the shared, immutable goal every agent on the team works toward. It is written so a **fully autonomous** run has a clear definition of *done* and can converge instead of wandering.

## The product

An **agentic-first HRIS** — a Human Resources Information System where AI agents are a **first-class feature**, not a bolt-on. Managers and HR admins manage people and org structure *and* work through an in-app **HR copilot** that can answer questions and draft actions with human-in-the-loop confirmation.

## The stack (greenfield, modern, infra-light)

Pinned so nobody re-litigates it mid-run. Refine only with the lead's approval.

- **Next.js 15** (App Router, React Server Components, Server Actions) · TypeScript
- **Tailwind CSS** + **shadcn/ui** (built on **Radix** primitives) — accessible by construction
- **Drizzle ORM** + **SQLite** (`better-sqlite3`) — zero-infra local persistence, seedable
- **Vercel AI SDK** (`ai`, `useChat`, tool calling, streaming) — the agentic layer
- **Vitest** + **Playwright** + **axe** — verification

> The copilot calls a real LLM at runtime, which needs a provider key in `.env.local` (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`). The team **builds** the integration; **running** the copilot is the human's to key. Never commit a key.

## Definition of done (acceptance criteria)

A reviewer — the `verifier` agent — must be able to confirm all of these from evidence, not claims:

1. **It builds and runs.** `pnpm install && pnpm dev` serves the app; `pnpm build` succeeds; `tsc` is clean.
2. **People & org.** Seeded ~50-person company. An **employee directory** (search + filter) and a **person** view (manager, reports, position, org unit) render from the database.
3. **Org structure.** An org view showing reporting lines, keyboard-navigable.
4. **The agentic core — an HR copilot** that:
   - streams responses in a shadcn/Radix chat panel,
   - has **tools** it can call against the real data (`findPerson`, `reportsOf`, `orgUnit`, `draftAnnouncement`),
   - **never mutates data without an explicit human confirm** (agentic UX: propose → confirm → act),
   - shows its tool calls transparently (what it did, on what data).
5. **Accessible.** shadcn/Radix used correctly; axe passes WCAG 2.2 AA on directory, person, and the copilot panel; the copilot panel is keyboard- and screen-reader-usable.
6. **Verified.** Unit tests for the tools and data layer; a Playwright happy-path (open app → search → open person → ask the copilot "who reports to <X>?" → see a grounded answer); evidence written to `build/EVIDENCE.md`.

## Non-negotiable constraints

- **Work only inside `build/`.** Do not touch anything else in the repository.
- **Human-in-the-loop for data mutations** in the product — the copilot proposes, a human confirms.
- **Evidence over claims.** "It works" is not acceptance; the verifier re-runs checks.
- **Bounded effort.** If a task stalls after a few attempts, escalate to the lead with the evidence, don't grind.
- **No secrets in git.** Keys live in `.env.local` (git-ignored).

## What "agentic-first" specifically means here

The copilot is not a chatbot pasted into a corner. It is woven in: contextual actions on the directory/person views ("draft an intro", "summarize this team"), a transparent tool-call log, and a propose→confirm→act loop for anything that changes data. Judge the product by whether an HR admin would *reach for the agent first*.
