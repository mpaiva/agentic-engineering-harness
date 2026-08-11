import { useId } from "react";
import type { Route } from "./+types/org-chart";
import { getApi } from "~/lib/trpc.server";
import { OrgTree } from "~/components/OrgTree";
import type { ChartNode } from "~/lib/contract";

export function meta() {
  return [{ title: "Org chart — HCM Graph" }];
}

/**
 * Loader fetches the whole solid-line reporting tree pre-shaped by the API
 * (org.chart). `focus` (a position id, e.g. from a person page) reveals + focuses a
 * seat. At ~200 seats the full tree is small enough to ship without virtualization.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const focus = url.searchParams.get("focus") || undefined;
  // org.chart returns null on an empty graph (no root seat); the view degrades to
  // an empty state rather than crashing the tree renderer.
  const root: ChartNode | null = await getApi().org.chart.query({});
  return { root, focus };
}

export default function OrgChart({ loaderData }: Route.ComponentProps) {
  const { root, focus } = loaderData;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="org-chart">
      <h1 id={headingId}>Organization chart</h1>
      {root ? (
        <>
          <p className="org-chart-help">
            Use the arrow keys to navigate: <kbd>↑</kbd>/<kbd>↓</kbd> move between peers,{" "}
            <kbd>→</kbd> expands into direct reports, <kbd>←</kbd> collapses toward the
            manager. Press <kbd>Enter</kbd> to open a seat's details.
          </p>
          <OrgTree root={root} focusPositionId={focus} />
        </>
      ) : (
        <p className="org-chart-empty">
          No organization data is available yet. Seed the graph to populate the chart.
        </p>
      )}
    </section>
  );
}
