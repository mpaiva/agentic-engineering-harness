# The accessible-org-chart pattern (Phase 0 research artifact)

*Grounded in [product/PROJECT.md](product/PROJECT.md) and [product/domain-graph.md](product/domain-graph.md). Verified against the W3C WAI-ARIA Authoring Practices Guide (APG) Tree View and Treegrid patterns and the MDN `tree`/`treegrid` role references.*

This defines the one UI pattern the slice must get right. PROJECT.md makes it a first-class, gated requirement: *"the org chart must be fully keyboard-navigable and screen-reader-sensible (org charts are notoriously inaccessible)."* The Goal is that a user can *"Open an org chart and navigate reporting lines up and down, by keyboard"* (PROJECT.md §Goal.2). The pattern below turns that sentence into a concrete ARIA contract and, in doing so, constrains which UI libraries are admissible.

---

## 1. The decision: `role="tree"`, not `role="treegrid"`, not an SVG node-link diagram

**Recommendation: model the org chart as a single-select ARIA `tree` (`role="tree"` container, `role="treeitem"` per node), where the tree hierarchy *is* the `REPORTS_TO` traversal.**

Why this is the right ARIA model, and why the two obvious alternatives are wrong for this slice:

### Why `tree` fits the domain exactly

The domain graph says reporting structure is a DAG on positions, rooted at the top (`domain-graph.md` invariant 1, relationship `(Position) -[:REPORTS_TO]-> (Position)`). An ARIA tree is a hierarchical list of expandable/collapsible parent and child nodes — a structural 1:1 match with `REPORTS_TO`. The APG tree keyboard model maps onto reporting-line traversal with no translation:

| Graph traversal (domain-graph.md §Why these are edges) | Tree interaction |
|---|---|
| Reporting chain **up** (`REPORTS_TO*` toward CEO) | `←` / collapse → move to parent (manager) |
| All reports (transitive), one level | `→` / expand → reveal direct reports |
| Move among peers (same manager) | `↑` / `↓` → move among siblings |
| Span of control (count of direct `REPORTS_TO`) | announced on the parent node + on expand |

The user's mental model — *"who does this person report to, and who reports to them"* — is precisely up/down in a tree. No second navigation axis is needed.

### Why NOT `treegrid`

A treegrid adds a second (horizontal, cell-by-cell) navigation axis and exists for rows with **multiple independently-navigable data cells** the user must traverse (the APG canonical example is an email inbox: subject, sender, date columns). The APG and MDN both flag it as materially more complex to implement correctly. An org-chart node's extra attributes (job, org unit, location, span-of-control, dotted-line manager) do not need to be *navigable cells* — they need to be *readable*. We deliver them through the node's accessible name/description and the linked person-detail panel (§5), not through a grid of focusable cells. Choosing treegrid here would pay the full complexity cost of the harder pattern to solve a problem we don't have, and would fight the up-the-chain / down-the-chain semantics that are the whole point.

> Reserved future use: a flat, sortable **org table** view (all positions with Job / Org Unit / Span / Location columns) is a legitimate later `treegrid`. It is out of scope for slice 1 and must not drive the org-chart component choice.

### Why NOT a visual SVG/canvas box-and-connector diagram as the source of truth

The "notorious inaccessibility" PROJECT.md warns about comes from org charts built as SVG/canvas node-link drawings: to assistive tech they are an opaque image or a soup of unlabeled shapes with no hierarchy, no state, no keyboard model. **The accessible source of truth must be the DOM `tree`.** Any boxes-and-lines *visual* is permitted only as a CSS/SVG projection layered over the same `treeitem` DOM (styling the real nodes), or as a purely decorative (`aria-hidden`) layer whose interactive twin is the tree. This is the single hardest constraint on library selection — see §7.

---

## 2. The concrete ARIA/DOM model

Structure (semantic HTML + ARIA; every node is a real focusable element):

```html
<div role="tree" aria-label="Org chart — reporting structure" aria-describedby="orgchart-help">
  <p id="orgchart-help" class="visually-hidden">
    Use up and down arrows to move between people, right arrow to show direct
    reports, left arrow to move to the manager, Enter to open a person.
  </p>

  <!-- Root: CEO (invariant 5: the single root) -->
  <div role="treeitem"
       id="pos-001"
       aria-level="1"
       aria-setsize="1"
       aria-posinset="1"
       aria-expanded="true"
       tabindex="0"
       aria-describedby="desc-pos-001">
    <span class="node-label">Dana Okoye — Chief Executive Officer</span>
    <span id="desc-pos-001" class="visually-hidden">
      Root of the organization. 4 direct reports. Executive org unit.
    </span>

    <div role="group" aria-label="Direct reports of Dana Okoye">
      <div role="treeitem" id="pos-014" aria-level="2" aria-setsize="4"
           aria-posinset="1" aria-expanded="false" tabindex="-1"
           aria-describedby="desc-pos-014">
        <span class="node-label">Priya Rao — VP Engineering</span>
        <span id="desc-pos-014" class="visually-hidden">
          Reports to Dana Okoye. 6 direct reports. Engineering division.
        </span>
      </div>
      <!-- …siblings pos-015…pos-017… -->
    </div>
  </div>
</div>
```

Rules bound directly to the graph and invariants:

- **`role="treeitem"` per Position** (structure lives on positions — PROJECT.md §Context; domain-graph.md). The label surfaces the *holder* (Person) plus title; positions with no active holder (`status: open`) still render as a node labelled e.g. *"Open — Staff Engineer"* so the structure stays whole.
- **`role="group"`** wraps each set of children (the direct reports). Its `aria-label` names the manager so the group boundary is meaningful when read.
- **`aria-expanded`** on any node with children: `true`/`false`. Leaf nodes (no direct reports) **omit** `aria-expanded` entirely — presence of the attribute is itself the SR signal "this can be opened."
- **`aria-level` / `aria-setsize` / `aria-posinset`: declare them explicitly.** The graph already knows the depth in the chain and the sibling count, and we intend to virtualize ~200 nodes (§6), so the DOM will be incomplete and AT cannot compute these. Declaring them is mandatory the moment nodes are lazily rendered. Set-size = number of direct reports of the parent = the **span of control** figure, reused.
- **Single-select tree, roving tabindex** (see §4): exactly one node has `tabindex="0"`, all others `tabindex="-1"`.
- **Matrix / dotted-line reporting** (domain-graph.md open question, resolved to a distinct edge): the person appears **once** in the solid-line `REPORTS_TO` tree — duplicating a node breaks `aria-setsize`/`posinset` and confuses "where am I in the org." The dotted-line manager is surfaced in the node's `aria-describedby` text ("Dotted-line to Sam Cho, Product") and in the detail panel, never as a second tree node.

---

## 3. Screen-reader output: what a node announces

With the model above, a compliant AT announces, on landing on a node, in this order (role → name → state → position): **"VP Engineering, Priya Rao, tree item, collapsed, level 2, 1 of 4. Reports to Dana Okoye. 6 direct reports. Engineering division."**

Composition rules so the reporting relationship is legible without overloading the name:

- **Accessible name** (`node-label` text) = holder + title only. Short, so repeated arrow-key navigation isn't punishing.
- **Reporting relationship + span + org unit** go in `aria-describedby` text, which AT reads *after* name/role/state. This is where the graph's derived facts land: *reports-to* (domain-graph.md derived edge), *span of control* (direct `REPORTS_TO` count), and *member-of OrgUnit* (domain-graph.md derived edge).
- **Level and position-in-set are spoken by AT automatically** from `aria-level`/`aria-posinset`/`aria-setsize` — do not also stuff "level 2" into the label (double-speaking).
- **Do not** encode reporting relationships in color, indentation, or connector lines alone; those are invisible to AT and fail WCAG 2.2 (1.3.1 Info and Relationships, 1.4.1 Use of Color). Indentation is decorative; the *relationship* is carried by `role="group"` nesting + `aria-level`.

---

## 4. Keyboard navigation (the full contract)

Roving-tabindex model. `Tab` moves into the tree once and back out — it does **not** walk nodes (APG/MDN: tree is arrow-key navigated, which is why exactly one node is tab-focusable). Inside the tree:

| Key | Action | Reporting meaning |
|---|---|---|
| `↓` | Move focus to next visible node (depth-first) | next person down the visible chain |
| `↑` | Move focus to previous visible node | previous person |
| `→` | Collapsed parent → expand (reveal direct reports). Expanded parent → move to first child. Leaf → no-op | drill **down** into someone's reports |
| `←` | Expanded parent → collapse. Collapsed node / leaf → move focus to **parent** | move **up** to the manager |
| `Enter` / `Space` | Activate node → open the person-detail panel (§5) | inspect this person |
| `Home` | Focus first node in tree (the root / CEO) | jump to top of org |
| `End` | Focus last visible node | |
| `*` (optional) | Expand all siblings at the current level | reveal a whole management layer |
| type-ahead | Focus next node whose name starts with typed chars | find a person by name within the chart |

Notes:
- Expand/collapse changes only `aria-expanded` + child visibility; it does **not** move focus (except `→` on an already-expanded parent, which steps to the first child, per APG).
- `←` doubling as *collapse* then *go-to-parent* is the APG-standard behavior and is exactly the "walk up the reporting chain" gesture.
- RTL locales mirror `←`/`→` (future i18n; note it now so the key handling is direction-aware, not hard-coded).

---

## 5. Focus management

- **Roving tabindex**: on any focus move, set the departing node to `tabindex="-1"` and the arriving node to `tabindex="0"`, then call `.focus()`. Re-entering the tree with `Tab` returns to the last-focused node, not the root. (Roving tabindex is preferred over `aria-activedescendant` here because each node is a real element we also want as a styled visual box; DOM focus keeps the visual focus ring and the AT cursor in sync with no extra bookkeeping.)
- **Opening a person** (`Enter`): move focus to the detail panel's heading (or the panel container with `tabindex="-1"`), so the SR user lands on the newly revealed content. The panel is the "Open a person" view — manager, direct reports, position, job, org unit (PROJECT.md §Goal.3).
- **Closing the panel** (`Escape` or a close control): **restore focus to the originating treeitem**. Never drop focus to `<body>`. This round-trip is the most commonly failed a11y detail and is explicitly on the scripted keyboard-walkthrough checklist (§8).
- **Async expand**: if direct reports are lazily fetched from the API, keep focus on the parent; when children arrive, they slot in below without stealing focus (the arrival is announced via the live region, §6).

---

## 6. Live announcements, virtualization, and 200 nodes

- **Polite live region** (`aria-live="polite"`, `aria-atomic="true"`, visually hidden) for events AT won't infer from a static DOM change:
  - on expand of a lazily-loaded node: *"Loaded 6 direct reports of Priya Rao."*
  - on collapse: *"Collapsed. 6 direct reports hidden."*
  Keep messages short and mirror the span-of-control number.
- **Virtualization**: the seed is ~200 people (domain-graph.md §Seed data). A fully expanded org tree can render many nodes; if we windowing/virtualize, the DOM is intentionally incomplete, which is exactly the case where **`aria-level`/`aria-setsize`/`aria-posinset` MUST be author-declared** (§2) — AT can no longer count siblings from the DOM. The graph supplies all three numbers cheaply. If we render the full tree (200 nodes is not large), computed values are acceptable, but declaring them is the safer default and is required the moment lazy expansion is added.

---

## 7. What this constrains — the UI/library decision (be specific)

This pattern is the deciding input for the "UI + org-chart lib" recommendation in Phase 0. Concretely:

**Admissible:**
- **Hand-rolled tree** over semantic HTML with the ARIA above, or a **headless / unstyled** tree primitive that emits real `role="treeitem"` DOM and lets us own roles, keyboard handling, and focus (e.g. a headless component library or a WAI-ARIA-tree utility). TypeScript end-to-end (PROJECT.md §Constraints, Phase-0 optimization targets), permissive license, small dependency surface.
- Visual boxes-and-connectors, **if and only if** rendered as CSS/SVG styling over the same `treeitem` DOM, or as an `aria-hidden` decorative layer paired with the real tree.

**Inadmissible for the accessible org chart:**
- **SVG/canvas org-chart-drawing libraries** (D3 node-link renderers, `orgchart.js`-style canvas widgets, diagramming/flow libraries). They render shapes, not a `treeitem` hierarchy; they cannot carry `aria-level`/`aria-expanded`/roving focus, and retrofitting ARIA onto generated SVG is the exact failure mode PROJECT.md is warning against. They may appear only as a decorative, `aria-hidden` visualization backed by the tree.
- Heavy component frameworks that ship their own inaccessible tree/org widgets we'd have to fight — violates the small-dependency-surface and a11y-as-a-build-stage constraints.

**Net recommendation to Phase 0 stack doc:** prefer a headless tree primitive (or a thin hand-rolled tree) + CSS for the visual, over any drawing/diagram library. The org chart's accessibility requirement, not its visual polish, is the binding constraint.

---

## 8. Verification hooks (ties to PROJECT.md §Verification)

The pattern is only "done" with evidence, not claims (verification-and-gates.md). This pattern makes each check concrete:

- **Automated axe pass**: tree has an accessible name; every `treeitem` has a name; `aria-expanded` present on and only on parents; `aria-level`/`setsize`/`posinset` consistent; no `role="tree"` without `treeitem` children. Recorded under `product/artifacts/`.
- **Scripted keyboard walkthrough** (Playwright, per verification-and-gates.md §evidence): `Tab` into tree → `↓/↑` traverse peers → `→` expand and land correctly → `←` collapse then step to manager → `Enter` opens panel and focus moves → `Escape` restores focus to the origin node → `Home`/`End`. Each assertion checks focus location and the announced accessible name/state.
- **Screen-reader semantics** (human a11y gate — verification-and-gates.md §Human review gates): reporting relationship, span of control, and org unit are spoken; matrix/dotted-line is announced without duplicating nodes; level and position-in-set are correct. This is the gated human sign-off PROJECT.md §Approval requires for accessibility.
- These map straight onto the invariant tests: the tree's `aria-setsize` values are the span-of-control counts, and the absence of any cycle in the rendered hierarchy is the UI-side reflection of invariant 1 (no cycles in `REPORTS_TO`).

---

### One-line summary for downstream stages

**The org chart is an ARIA `role="tree"` whose nesting is the `REPORTS_TO` DAG: roving-tabindex single-select, arrow keys walk the reporting chain (`←` up to manager, `→` down to reports, `↑/↓` across peers), `aria-level`/`setsize`/`posinset` declared from the graph, reporting relationship + span-of-control + org unit delivered via `aria-describedby` and a focus-managed detail panel, a polite live region for async expand — which rules out SVG/canvas org-chart libraries and points the stack at a headless or hand-rolled TypeScript tree.**