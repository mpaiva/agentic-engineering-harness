# Phase 0 — Stack Recommendation: Web Framework & Org‑Chart Rendering

Scope of this stage: the **web framework** and the **org‑chart rendering approach** (library vs. hand‑rolled tree/treegrid), plus the **directory** and **person** views. Grounded in `examples/hcm-graph/PROJECT.md` (the contract) and `examples/hcm-graph/domain-graph.md` (the model). Graph‑DB and API‑paradigm selection are their own Phase‑0 decisions; this memo touches them only where they bear on the UI.

Every recommendation is weighed against the six stated optimization targets: graph‑native traversals, fast local dev, an accessible org chart (WCAG 2.2 AA), TypeScript end to end, permissive licensing, small dependency surface.

---

## TL;DR (the decision, for the approval gate)

1. **Web framework: React + React Router 7 (framework mode) on Vite.** Runner‑up: Next.js (App Router). The decisive factor is that React unlocks **React Aria Components** — the strongest evidence‑backed accessible‑primitive library — which is what makes an *accessible* org chart tractable. React Router 7's loader model maps cleanly onto server‑side graph traversals and keeps the dependency surface and client JS small.

2. **Org chart: hand‑rolled on an accessible primitive, not a visual org‑chart library.** Build the org chart as an **accessible DOM `tree` (WAI‑ARIA APG Tree pattern) using React Aria's `Tree`**, styled with CSS to read as an org chart. Do **not** adopt `d3-org-chart` or React Flow for slice 1. Their interaction quality is high, but they render to SVG/canvas where WCAG 2.2 AA keyboard + screen‑reader semantics are a bolt‑on, not a property — the opposite of what the contract demands ("accessibility is a build stage, not cleanup").

3. **Directory:** a semantic, sortable **table** + React Aria `SearchField`/`Select`/`ComboBox` for name search and org‑unit/location filters. **Person:** plain accessible HTML (headings + description lists + links) — no library needed.

All recommended packages are **MIT or Apache‑2.0** (permissive). The added client dependency surface is essentially **one family**: `react-aria-components`.

---

## 1. Web framework

### What the contract actually needs of the framework

- **Read‑mostly slice.** Scope is Person/Position/Job/OrgUnit/Location nodes, a **read API**, and three views. Write/edit is explicitly out (`PROJECT.md` Scope). The framework's job is server‑side data loading + rendering three accessible views, not a heavy mutation/forms story.
- **Graph‑native traversals server‑side.** Reporting chain, span of control, transitive reports, org rollup (`domain-graph.md` §"Why these are edges") should run **on the server**, next to the graph driver, and return already‑shaped trees. This keeps traversals graph‑native (not reconstructed client‑side) and keeps client JS small.
- **TypeScript end to end, fast local dev, small surface.**
- **Accessibility as a first‑class, verified property** (axe + scripted keyboard walkthrough — `PROJECT.md` Verification).

The last point dominates. Org charts are, in the contract's own words, "notoriously inaccessible." The single biggest lever on that risk is the **accessible‑component ecosystem**, and that is a React strength: **React Aria / React Aria Components (Adobe, Apache‑2.0)** ships a `Tree` with roving‑tabindex keyboard navigation, expand/collapse, selection, and screen‑reader announcements, explicitly built to the WAI‑ARIA APG and tested against real screen readers. That is exactly the primitive the org chart needs.

### Candidates weighed

| Framework | Accessible‑primitive ecosystem | Graph‑traversal fit (server data loading) | Dependency surface | Local‑dev speed | License |
|---|---|---|---|---|---|
| **React + React Router 7 (framework mode)** ✅ | **Best** — React Aria Components (Apache‑2.0) | Loaders call the read API / driver; return shaped trees | **Lean** (Vite + RR7) | Fast (Vite HMR) | MIT |
| Next.js (App Router) | Best (same React Aria access) | Server Components colocate traversals; smallest client JS | **Largest** framework surface | Fast, but heavier toolchain | MIT |
| SvelteKit | Weakest for this problem — you hand‑roll most ARIA; no equal to React Aria `Tree` | Loaders fit well; smallest bundles | Smallest overall | Fast (Vite) | MIT |

Notes grounded in research: SvelteKit produces the smallest bundles and fewest framework deps, and RR7 (the former Remix, now unified with React Router v7) is Vite‑based with loader/action data flow. Next.js has the largest dependency surface of the three.

### Why React Router 7 over the runner‑up (Next.js)

Both give full React Aria access. RR7 wins on **small dependency surface** and **simplicity**: its **loader** per route is a near‑perfect seam for a read API backed by graph traversals — one loader, one query, one typed result, rendered on the server. Next.js App Router (RSC) can ship marginally less client JS and colocate data even more tightly, which is genuinely attractive for a read‑heavy graph UI; that is why it's the documented runner‑up. But it brings the largest framework surface and more build‑tool machinery, which cuts against the "small, reviewable, no‑dependencies‑without‑approval" posture of this repo. For a three‑view read slice, RR7 + Vite is the leaner, faster‑to‑iterate choice with no accessibility compromise.

**Why not SvelteKit**, despite the best bundle/dependency numbers: accessibility is a *verified build stage* here, and the org chart is the hardest accessible widget in the product. Svelte has no equivalent to React Aria's tested `Tree`, so we'd hand‑author and re‑test the full APG keyboard/SR contract ourselves — precisely the risk React Aria removes. Trading a few dozen KB of bundle for a battle‑tested accessible tree is the right trade given the contract's priorities.

---

## 2. Org‑chart rendering: library vs. hand‑rolled

This is the crux of the slice. The tension: the **best‑looking / best‑panning** org‑chart renderers draw to **SVG/canvas**, where WCAG 2.2 AA keyboard + screen‑reader semantics are hard; the **most accessible** approach is **real DOM using an ARIA hierarchy pattern**, which trades some spatial polish. The contract resolves the tension for us — accessibility is first‑class and verified — so we optimize for the accessible representation and treat spatial richness as optional later.

### Options weighed (interaction quality **and** WCAG 2.2 AA reachability)

| Option | Interaction quality | Can it be made WCAG 2.2 AA? | License / surface | Verdict |
|---|---|---|---|---|
| **Hand‑rolled `tree` on React Aria `Tree`** (recommended) | Good: arrow‑key up/down/into, expand/collapse, focus‑to‑reroot; CSS‑styled node cards | **Yes, by construction** — APG Tree pattern, roving tabindex, SR announcements built in; DOM is fully inspectable by axe | Apache‑2.0; **one dep family** | ✅ Recommended |
| **`d3-org-chart`** | Excellent: zoom/pan, smooth expand/collapse, classic boxes‑and‑connectors | **Weak** — no documented keyboard or screen‑reader support; renders SVG/canvas where the APG tree/treegrid pattern doesn't apply cleanly; last release Sep 2023 | MIT, ~110K weekly downloads | Later/visual only |
| **React Flow (xyflow)** | Excellent for node‑graph editing; pan/zoom | **Partial** — keyboard nav + ARIA built in, but it's a *graph editor* (heavier than needed) and has known focus‑order gaps (issue #5189); canvas‑based semantics | MIT | Overkill; not for slice 1 |
| **PrimeReact `OrganizationChart`** | Good compound API, connectors, selection | Plausible, but pulls in the **whole PrimeReact** styling/runtime | MIT, **large surface** | Rejected on dependency surface |

### Recommendation: DOM‑first accessible tree, no visual org‑chart library in slice 1

Build the org chart as an **accessible `tree`** (React Aria `Tree`) fed by the `REPORTS_TO` traversal, styled with CSS to look like an org chart (indented hierarchy with connector lines drawn in CSS). This representation is the **conformance‑bearing source of truth** that axe and the scripted keyboard walkthrough verify. It:

- honors **small dependency surface** (no `d3`, no canvas engine — just `react-aria-components`, which we already adopt for directory controls);
- is **keyboard‑native and screen‑reader‑sensible by construction**, directly satisfying the org‑chart requirement in `PROJECT.md` Constraints;
- keeps the DOM semantic and inspectable, so the automated **axe** pass has real elements to check;
- sidesteps WCAG 2.2 **2.5.7 Dragging Movements** and pointer‑only pan/zoom traps that a canvas org chart would introduce.

If, in a later slice, a spatial "boxes and lines on a canvas" visualization is wanted for visual richness, layer **`d3-org-chart` (MIT)** as a **purely visual enhancement that mirrors the same data**, while the accessible tree remains the AA‑conformant representation. Do not make the canvas the only representation.

**Tree vs. treegrid.** Start with the **Tree pattern** for the org chart: each node is a single focusable person/position **card** (name, title, org unit), navigated with Up/Down/Right/Left and expanded/collapsed per APG. Reserve the **Treegrid pattern** for cases where each row must expose several independently navigable data cells; that's a better fit for a *rich data table* than for the org hierarchy, and it's more complex. Recommendation: **Tree** for the org chart, revisit treegrid only if node rows grow into multi‑cell editable data.

**Reporting‑lines UX to build on the tree:**
- Navigate **down** = expand a position's `REPORTS_TO` children (direct reports); **up** = a breadcrumb of the reporting chain to the root (CEO), from the `HOLDS → REPORTS_TO* → HOLDS` traversal.
- **Focus a person** to re‑root the tree at their position (span‑of‑control view = count of direct `REPORTS_TO`).
- **Matrix / dotted‑line** case (`domain-graph.md` open question): the ARIA `tree` is inherently single‑parent, so render the solid `REPORTS_TO` line as the tree structure and surface the dotted‑line relationship as an **annotated link** on the node and on the person view — not as a second tree parent. This keeps the tree semantics valid while still proving the model handles matrix reporting.

---

## 3. The other two views

### Directory view

- A **semantic, sortable `<table>`** of people (name, title, org unit, location, status), keyboard‑operable. If richer cell‑level keyboard navigation is wanted, React Aria's `Table` provides it; a plain semantic table is the smaller‑surface default.
- **Search** by name via React Aria `SearchField`; **filter** by org unit / location via `Select`/`ComboBox` (all keyboard‑ and SR‑accessible, Apache‑2.0). This satisfies `PROJECT.md` Goal #1 (search by name, filter by org unit / location).
- ~200 people needs **no virtualization**; add React Aria's virtualizer only if a later dataset demands it.
- Each row links to the **person view**, and org‑unit / location cells link into filtered directory or org rollups (the `IN_ORG_UNIT` / `PART_OF*` traversals).

### Person view

- Plain, accessible HTML: an `<h1>` name, a **description list** for position, job, org unit, location, status; a **manager** link and a **direct‑reports** list (both links that traverse the graph); a **reporting‑chain breadcrumb** to the root. No library required.
- This is the derived person↦manager view (`PROJECT.md` note: structure lives on positions, the person view is derived) and directly serves Goal #3.

---

## 4. Dependencies & licensing summary (for the "add no dependencies without approval" gate)

| Package | Role | License | Surface note |
|---|---|---|---|
| `react`, `react-dom` | UI runtime | MIT | Baseline |
| `react-router` (v7, framework mode) + `vite` | Framework, routing, loaders, dev server | MIT | Lean; fast HMR |
| `react-aria-components` | Accessible `Tree`, `Table`, `SearchField`, `Select`, `ComboBox` | **Apache‑2.0** | Tree‑shakeable; **the one new client dep family** |
| *(later, optional)* `d3-org-chart` | Visual canvas org chart, as enhancement only | MIT | **Not** for slice 1 |

Everything recommended is permissive (MIT / Apache‑2.0). **Rejected on surface/licensing grounds:** PrimeReact (whole‑library weight), React Flow (editor overkill + focus‑order gaps). **Deferred:** `d3-org-chart` (accessibility gap; visual‑only, later).

---

## 5. WCAG 2.2 AA specifics this stack must still honor

Adopting React Aria makes conformance *reachable*, not *automatic* — `PROJECT.md` still requires an **axe pass + a scripted keyboard walkthrough** as evidence. Watch these WCAG 2.2 criteria in particular:

- **2.1.1 Keyboard / 2.4.3 Focus Order / 2.4.7 Focus Visible** — the org‑chart tree walkthrough is the headline test.
- **2.4.11 Focus Not Obscured (Minimum)** — ensure expanded org‑node cards / sticky headers don't hide the focused item.
- **2.5.8 Target Size (Minimum, 24×24px)** — expand/collapse toggles on org nodes and directory filter controls.
- **2.5.7 Dragging Movements** — an argument *against* a pan/zoom canvas; the DOM tree avoids drag‑only interactions entirely.
- **1.3.1 Info & Relationships / 4.1.2 Name, Role, Value** — the tree's `role=tree`/`treeitem`, `aria-level`, `aria-expanded`, and SR announcements (React Aria supplies these; verify with a screen reader in the walkthrough).

---

## 6. Risks & open questions to confirm at the stack gate

- **Visual expectation mismatch.** Stakeholders may expect a spatial "boxes‑and‑connectors" org chart. This recommendation delivers an accessible *tree* styled as an org chart first; a canvas visualization is a later, additive layer. **Confirm this is acceptable** before build.
- **React Aria `Table` vs. plain semantic table** for the directory — decide at build time based on whether cell‑level keyboard nav is needed (default: plain table, smaller surface).
- **Framework runner‑up.** If the team later prioritizes minimum client JS via React Server Components over minimum dependency surface, Next.js App Router is the drop‑in alternative with identical React Aria accessibility.
- **Data‑shaping seam** depends on the still‑to‑be‑chosen graph DB + API paradigm (separate Phase‑0 decisions). This memo assumes traversals run server‑side in RR7 loaders and return pre‑shaped trees; that assumption should hold across the DB options and keeps traversals graph‑native.

**Recommended for approval:** React + React Router 7 (Vite) · org chart as a hand‑rolled accessible `tree` on React Aria (no visual org‑chart library in slice 1) · directory as semantic table + React Aria filters · person view as plain accessible HTML.