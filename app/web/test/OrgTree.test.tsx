import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrgTree } from "~/components/OrgTree";
import { renderWithRouter } from "./helpers";
import type { ChartNode } from "~/lib/contract";

/**
 * Fixture: CEO → { VP Engineering → Staff Engineer, VP Sales (open seat) }.
 * Staff Engineer has a dotted line to VP Sales in another division to exercise the
 * matrix-as-annotated-link rule. `level` is authored from the graph (schema.md).
 */
const chart: ChartNode = {
  positionId: "POS-1",
  title: "Chief Executive Officer",
  holderPersonId: "PER-1",
  holderName: "Ada Rivera",
  orgUnitId: "OU-1",
  orgUnitName: "Acme Corp",
  spanOfControl: 2,
  level: 1,
  children: [
    {
      positionId: "POS-2",
      title: "VP Engineering",
      holderPersonId: "PER-2",
      holderName: "Bruno Chen",
      orgUnitId: "OU-2",
      orgUnitName: "Engineering",
      spanOfControl: 1,
      level: 2,
      children: [
        {
          positionId: "POS-3",
          title: "Staff Engineer",
          holderPersonId: "PER-3",
          holderName: "Carmen Adams",
          orgUnitId: "OU-2",
          orgUnitName: "Platform Engineering",
          spanOfControl: 0,
          level: 3,
          children: [],
          dottedManagers: [
            {
              positionId: "POS-4",
              title: "VP Sales",
              holderPersonId: "PER-4",
              holderName: "Dana West",
              orgUnitName: "Sales",
              reason: "revenue enablement",
            },
          ],
        },
      ],
    },
    {
      positionId: "POS-4",
      title: "VP Sales",
      holderPersonId: null, // open seat
      holderName: null,
      orgUnitId: "OU-3",
      orgUnitName: "Sales",
      spanOfControl: 0,
      level: 2,
      children: [],
    },
  ],
};

function treeitem(name: RegExp) {
  return screen.getByRole("treeitem", { name });
}

describe("OrgTree — ARIA tree contract", () => {
  it("renders a role=tree (not a treegrid) with an accessible name", () => {
    renderWithRouter(<OrgTree root={chart} />);
    const tree = screen.getByRole("tree", { name: /organization chart/i });
    expect(tree).toBeInTheDocument();
    // treegrid roles must NOT be present — the contract requires the tree pattern.
    expect(screen.queryByRole("treegrid")).toBeNull();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
    expect(screen.getAllByRole("treeitem").length).toBeGreaterThan(0);
  });

  it("author-declares aria-level / setsize / posinset from the graph", () => {
    renderWithRouter(<OrgTree root={chart} />);

    const ceo = treeitem(/Ada Rivera/);
    expect(ceo).toHaveAttribute("aria-level", "1");
    expect(ceo).toHaveAttribute("aria-setsize", "1");
    expect(ceo).toHaveAttribute("aria-posinset", "1");
    expect(ceo).toHaveAttribute("aria-expanded", "true");

    const sales = treeitem(/Open seat VP Sales/);
    expect(sales).toHaveAttribute("aria-level", "2");
    expect(sales).toHaveAttribute("aria-setsize", "2");
    expect(sales).toHaveAttribute("aria-posinset", "2");
    // A leaf seat carries no aria-expanded.
    expect(sales).not.toHaveAttribute("aria-expanded");
  });

  it("carries the reporting relation + span + org unit in aria-describedby", () => {
    renderWithRouter(<OrgTree root={chart} />);
    expect(treeitem(/Ada Rivera/)).toHaveAccessibleDescription(
      /Top of the organization\. Span of control 2\. Org unit Acme Corp\./,
    );
    expect(treeitem(/Carmen Adams/)).toHaveAccessibleDescription(
      /Reports to Bruno Chen\..*Span of control 0\..*Dotted-line to Dana West\./,
    );
  });

  it("uses a roving tabindex — exactly one treeitem is tabbable", () => {
    renderWithRouter(<OrgTree root={chart} />);
    const tabbable = screen
      .getAllByRole("treeitem")
      .filter((el) => el.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(treeitem(/Ada Rivera/));
  });
});

describe("OrgTree — keyboard navigation", () => {
  it("→ drills into reports, ↑/↓ move across peers, ← returns to the manager", async () => {
    const user = userEvent.setup();
    renderWithRouter(<OrgTree root={chart} />);

    await user.tab();
    expect(treeitem(/Ada Rivera/)).toHaveFocus();

    // → into the first report.
    await user.keyboard("{ArrowRight}");
    expect(treeitem(/Bruno Chen/)).toHaveFocus();

    // ↓ across to the peer (does NOT descend into Bruno's report).
    await user.keyboard("{ArrowDown}");
    expect(treeitem(/Open seat VP Sales/)).toHaveFocus();

    // ↑ back to the previous peer.
    await user.keyboard("{ArrowUp}");
    expect(treeitem(/Bruno Chen/)).toHaveFocus();

    // ← on an EXPANDED parent collapses it (APG), focus stays put.
    await user.keyboard("{ArrowLeft}");
    expect(treeitem(/Bruno Chen/)).toHaveFocus();
    expect(treeitem(/Bruno Chen/)).toHaveAttribute("aria-expanded", "false");

    // ← again — now collapsed — walks up to the manager.
    await user.keyboard("{ArrowLeft}");
    expect(treeitem(/Ada Rivera/)).toHaveFocus();
  });

  it("Enter opens a focus-managed detail panel; Escape closes it and restores focus", async () => {
    const user = userEvent.setup();
    renderWithRouter(<OrgTree root={chart} />);

    await user.tab();
    expect(treeitem(/Ada Rivera/)).toHaveFocus();

    await user.keyboard("{Enter}");
    const panel = screen.getByRole("region", { name: /Details: Ada Rivera/ });
    expect(panel).toHaveFocus();
    expect(treeitem(/Ada Rivera/)).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: /Details:/ })).toBeNull();
    expect(treeitem(/Ada Rivera/)).toHaveFocus();
  });
});

describe("OrgTree — matrix / dotted line", () => {
  it("renders dotted managers as annotated links, never as a tree parent", async () => {
    const user = userEvent.setup();
    renderWithRouter(<OrgTree root={chart} />);

    // VP Sales appears exactly once as a treeitem (the solid-line seat), never a second
    // time under Staff Engineer as a dotted parent.
    expect(screen.getAllByRole("treeitem", { name: /VP Sales/ })).toHaveLength(1);

    // Navigate to Staff Engineer and open its details: CEO → VP Eng → Staff Eng.
    await user.tab();
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    expect(treeitem(/Carmen Adams/)).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { name: /Dotted-line reporting/ })).toBeInTheDocument();
    const dottedLink = screen.getByRole("link", { name: /Dana West/ });
    expect(dottedLink).toHaveAttribute("href", "/person/PER-4");
  });
});
