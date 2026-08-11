import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type { ChartNode } from "~/lib/contract";

export interface OrgTreeProps {
  root: ChartNode;
  /** Position id to reveal + focus on load (e.g. arriving from a person page link). */
  focusPositionId?: string;
}

// ── Graph helpers ────────────────────────────────────────────────────────────────
function nodeLabel(node: ChartNode): string {
  return node.holderName
    ? `${node.holderName} — ${node.title}`
    : `Open seat — ${node.title}`;
}

/** Per-node navigation facts, precomputed once from the solid-line REPORTS_TO tree. */
interface NodeMeta {
  node: ChartNode;
  parentId: string | null;
  /** The node's peer group (its parent's children, or [root] for the root). */
  siblings: ChartNode[];
  /** 1-based index within `siblings` — authored verbatim onto aria-posinset. */
  posinset: number;
}

/**
 * Flatten the tree into an id → NodeMeta index. `aria-level` comes from `node.level`
 * (the graph's depth), `aria-setsize` from `siblings.length`, and `aria-posinset` from
 * `posinset` — all AUTHOR-DECLARED FROM THE GRAPH, per the accessibility contract, not
 * inferred by a widget library. Peer navigation (↑/↓) walks `siblings`; manager/report
 * navigation (←/→) walks `parentId`/`node.children`.
 */
function buildIndex(root: ChartNode): Map<string, NodeMeta> {
  const index = new Map<string, NodeMeta>();
  function walk(node: ChartNode, parentId: string | null, siblings: ChartNode[], posinset: number) {
    index.set(node.positionId, { node, parentId, siblings, posinset });
    node.children.forEach((child, i) => walk(child, node.positionId, node.children, i + 1));
  }
  walk(root, null, [root], 1);
  return index;
}

/** Path of position ids from root down to (and including) targetId, or null. */
function pathTo(node: ChartNode, targetId: string): string[] | null {
  if (node.positionId === targetId) return [node.positionId];
  for (const child of node.children) {
    const sub = pathTo(child, targetId);
    if (sub) return [node.positionId, ...sub];
  }
  return null;
}

/**
 * The org chart as a hand-rolled, single-select ARIA `tree` (WAI-ARIA APG Tree View
 * pattern) — NOT a treegrid. The rendered DOM is a genuine `role="tree"` of
 * `role="treeitem"` nodes grouped by `role="group"`, and it is the conformance-bearing
 * source of truth that axe + the scripted keyboard walkthrough verify.
 *
 * The hierarchy IS the solid-line REPORTS_TO traversal the DB returned (schema.md §5);
 * DOTTED_REPORTS_TO is never a tree parent — dotted managers appear only as annotated
 * links in the detail panel and are named in the row's aria-describedby (schema.md §1.2).
 *
 * Accessibility contract (built by construction, not bolted on):
 *  - Roving tabindex: exactly one treeitem is tabbable (`tabIndex=0`); the rest are -1.
 *  - `←`/`→` walk UP to the manager / DOWN into reports; `↑`/`↓` move ACROSS peers only.
 *  - `aria-level` / `aria-setsize` / `aria-posinset` are author-declared from the graph.
 *  - Each row's name is holder + seat title (`aria-labelledby`); its description
 *    (reporting relationship + span of control + org unit + any dotted line) rides in
 *    `aria-describedby`.
 *  - `Enter`/`Space` (or click) opens a focus-managed detail panel; `Escape` closes it
 *    and restores focus to the originating row.
 *  - A polite live region announces expansion/collapse and detail open/close.
 * Span of control shown here is schema.md §5.3 (count of direct REPORTS_TO).
 */
export function OrgTree({ root, focusPositionId }: OrgTreeProps) {
  const index = useMemo(() => buildIndex(root), [root]);
  const treeDescId = useId();
  const descBase = useId();
  const liveId = useId();

  // Expand the root and its immediate reports by default; if we arrived focused on a
  // seat, additionally expand every ancestor so it is revealed.
  const defaultExpanded = useMemo(() => {
    const keys = new Set<string>([root.positionId, ...root.children.map((c) => c.positionId)]);
    if (focusPositionId) {
      const path = pathTo(root, focusPositionId);
      if (path) for (const id of path) keys.add(id);
    }
    return keys;
  }, [root, focusPositionId]);

  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);
  // Roving tabindex owner + keyboard-focus target (defaults to the arrived-at seat, else root).
  const initialActive = focusPositionId && index.has(focusPositionId) ? focusPositionId : root.positionId;
  const [activeId, setActiveId] = useState<string>(initialActive);
  // Single-select: the seat whose detail panel is open (aria-selected).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLLIElement | null>(null);
  // True once the user has driven the tree (or we arrived via a deep link): gates whether
  // the roving-focus effect is allowed to move DOM focus, so we never steal focus on mount.
  const focusIntent = useRef<boolean>(Boolean(focusPositionId && index.has(focusPositionId)));

  const selectedNode = selectedId ? index.get(selectedId)?.node ?? null : null;

  // Roving tabindex: keep DOM focus on the active treeitem after user-driven navigation
  // or an expand/collapse. Runs after commit (useLayoutEffect) so a just-collapsed row
  // keeps focus, and never steals focus on mount unless we arrived via a deep link.
  useLayoutEffect(() => {
    if (!focusIntent.current) return;
    const el = itemRefs.current.get(activeId);
    if (el && document.activeElement !== el) el.focus();
  }, [activeId, expanded]);

  // Move focus into the detail panel when it opens.
  useEffect(() => {
    if (selectedNode) panelRef.current?.focus();
  }, [selectedNode]);

  function focusItem(id: string) {
    focusIntent.current = true;
    setActiveId(id);
    // Imperative focus so a combined key sequence dispatches to the right row at once.
    itemRefs.current.get(id)?.focus();
  }

  function isExpanded(id: string): boolean {
    return expanded.has(id);
  }

  function expand(node: ChartNode) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(node.positionId);
      return next;
    });
    const n = node.spanOfControl;
    setAnnouncement(`Expanded ${nodeLabel(node)}. ${n} direct report${n === 1 ? "" : "s"}.`);
    itemRefs.current.get(node.positionId)?.focus();
  }

  function collapse(node: ChartNode) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(node.positionId);
      return next;
    });
    setAnnouncement(`Collapsed ${nodeLabel(node)}.`);
    itemRefs.current.get(node.positionId)?.focus();
  }

  function openDetail(id: string) {
    returnFocusRef.current = itemRefs.current.get(id) ?? null;
    setActiveId(id);
    setSelectedId(id);
    const node = index.get(id)?.node;
    if (node) setAnnouncement(`Opened details for ${nodeLabel(node)}.`);
  }

  function closeDetail() {
    setSelectedId(null);
    setAnnouncement("Closed details.");
    // Restore focus to the row that opened the panel (WCAG 2.4.3 focus order).
    returnFocusRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLLIElement>, node: ChartNode) {
    // Treeitems nest, so a keydown bubbles up through every ancestor row. Only the row
    // that actually holds focus should act — otherwise one press fires this handler for
    // each ancestor and the ancestor's navigation clobbers the focused row's.
    if (event.target !== event.currentTarget) return;
    const meta = index.get(node.positionId);
    if (!meta) return;
    focusIntent.current = true;
    const hasChildren = node.children.length > 0;

    switch (event.key) {
      case "ArrowDown": {
        // ↓ — next peer (sibling only; never descends into another branch).
        event.preventDefault();
        const next = meta.siblings[meta.posinset]; // posinset is 1-based ⇒ this is the next sibling
        if (next) focusItem(next.positionId);
        break;
      }
      case "ArrowUp": {
        // ↑ — previous peer.
        event.preventDefault();
        const prev = meta.siblings[meta.posinset - 2];
        if (prev) focusItem(prev.positionId);
        break;
      }
      case "ArrowRight": {
        // → — down into reports: first press expands, second moves to the first report.
        event.preventDefault();
        if (!hasChildren) break;
        if (!isExpanded(node.positionId)) expand(node);
        else focusItem(node.children[0].positionId);
        break;
      }
      case "ArrowLeft": {
        // ← — up toward the manager: collapse if open, else move to the manager (parent).
        event.preventDefault();
        if (hasChildren && isExpanded(node.positionId)) collapse(node);
        else if (meta.parentId) focusItem(meta.parentId);
        break;
      }
      case "Home": {
        event.preventDefault();
        focusItem(meta.siblings[0].positionId);
        break;
      }
      case "End": {
        event.preventDefault();
        focusItem(meta.siblings[meta.siblings.length - 1].positionId);
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        openDetail(node.positionId);
        break;
      }
      default:
        break;
    }
  }

  // Recursive treeitem renderer. `parent` supplies the reporting-relationship phrasing.
  function renderNode(node: ChartNode, parent: ChartNode | null) {
    const meta = index.get(node.positionId)!;
    const hasChildren = node.children.length > 0;
    const open = isExpanded(node.positionId);
    const labelId = `${descBase}-lbl-${node.positionId}`;
    const descId = `${descBase}-desc-${node.positionId}`;

    const relation = parent
      ? `Reports to ${parent.holderName ?? parent.title}.`
      : "Top of the organization.";
    const dotted =
      node.dottedManagers && node.dottedManagers.length > 0
        ? ` Dotted-line to ${node.dottedManagers.map((d) => d.holderName ?? d.title).join(", ")}.`
        : "";
    const description = `${relation} Span of control ${node.spanOfControl}. Org unit ${node.orgUnitName}.${dotted}`;

    return (
      <li
        key={node.positionId}
        role="treeitem"
        ref={(el) => {
          if (el) itemRefs.current.set(node.positionId, el);
          else itemRefs.current.delete(node.positionId);
        }}
        className="org-tree-item"
        aria-level={node.level}
        aria-setsize={meta.siblings.length}
        aria-posinset={meta.posinset}
        aria-expanded={hasChildren ? open : undefined}
        aria-selected={selectedId === node.positionId}
        aria-labelledby={labelId}
        aria-describedby={descId}
        tabIndex={activeId === node.positionId ? 0 : -1}
        onKeyDown={(e) => handleKeyDown(e, node)}
      >
        <div
          className="org-node-row"
          style={{ paddingInlineStart: `calc(0.5rem + ${(node.level - 1) * 1.4}rem)` }}
          onClick={() => openDetail(node.positionId)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="org-chevron"
              tabIndex={-1}
              aria-hidden="true"
              data-expanded={open ? "true" : undefined}
              onClick={(e) => {
                e.stopPropagation(); // toggle only — don't open the detail panel
                focusIntent.current = true;
                setActiveId(node.positionId);
                if (open) collapse(node);
                else expand(node);
              }}
            >
              <span aria-hidden="true">▸</span>
            </button>
          ) : (
            <span className="org-chevron-spacer" aria-hidden="true" />
          )}
          <span className="org-node-label" id={labelId}>
            <span className="org-node-name">{node.holderName ?? "Open seat"}</span>
            <span className="org-node-title">{node.title}</span>
          </span>
          <span className="org-node-meta" aria-hidden="true">
            {node.orgUnitName} · span {node.spanOfControl}
          </span>
        </div>
        {/* Machine description referenced by the row via aria-describedby (announced after the name). */}
        <span id={descId} className="visually-hidden">
          {description}
        </span>
        {hasChildren && open ? (
          <ul role="group" className="org-tree-group">
            {node.children.map((child) => renderNode(child, node))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="org-chart-layout">
      {/* Concise aria-label names the tree; the arrow-key guidance rides in aria-describedby
          so it is announced on entry without bloating the tree's accessible name. */}
      <p id={treeDescId} className="visually-hidden">
        Use arrow keys to navigate: up and down move between peers, right expands into
        direct reports, left collapses toward the manager. Press Enter to open a seat's
        details.
      </p>
      <ul
        role="tree"
        aria-label="Organization chart — reporting lines"
        aria-describedby={treeDescId}
        className="org-tree"
      >
        {renderNode(root, null)}
      </ul>

      {/* Polite live region: announces expand/collapse and detail open/close. */}
      <div id={liveId} role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      {selectedNode ? (
        <aside
          ref={panelRef}
          tabIndex={-1}
          role="region"
          aria-label={`Details: ${nodeLabel(selectedNode)}`}
          className="org-detail"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeDetail();
            }
          }}
        >
          <div className="org-detail-head">
            <h2>{selectedNode.holderName ?? "Open seat"}</h2>
            <button type="button" className="org-detail-close" onClick={closeDetail}>
              Close
            </button>
          </div>
          <dl>
            <div>
              <dt>Position</dt>
              <dd>{selectedNode.title}</dd>
            </div>
            <div>
              <dt>Org unit</dt>
              <dd>{selectedNode.orgUnitName}</dd>
            </div>
            <div>
              <dt>Span of control</dt>
              <dd>{selectedNode.spanOfControl}</dd>
            </div>
          </dl>

          {selectedNode.holderPersonId ? (
            <Link to={`/person/${selectedNode.holderPersonId}`}>Open full profile →</Link>
          ) : (
            <p className="muted">This seat is currently open.</p>
          )}

          {/* Matrix / dotted-line reporting: annotated links, never a second tree parent. */}
          {selectedNode.dottedManagers && selectedNode.dottedManagers.length > 0 ? (
            <div className="org-detail-dotted">
              <h3>Dotted-line reporting</h3>
              <ul>
                {selectedNode.dottedManagers.map((d) => (
                  <li key={d.positionId}>
                    {d.holderPersonId ? (
                      <Link to={`/person/${d.holderPersonId}`}>{d.holderName ?? d.title}</Link>
                    ) : (
                      <span>{d.holderName ?? d.title}</span>
                    )}
                    <span className="muted">
                      {" — "}
                      {d.title} · {d.orgUnitName}
                      {d.reason ? ` · ${d.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

export default OrgTree;
