import { useId } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/directory";
import { getApi } from "~/lib/trpc.server";
import { DirectoryTable } from "~/components/DirectoryTable";
import { DirectoryFilters } from "~/components/DirectoryFilters";
import type { DirectoryPage, LocationOption, OrgUnitOption } from "~/lib/contract";

export function meta() {
  return [{ title: "Employee directory — HCM Graph" }];
}

/**
 * Server-side loader: filtering + pagination happen in Neo4j via people.list; the
 * filter option lists come from org.listOrgUnits / org.listLocations. Only pre-shaped
 * rows cross to the client. A falsy filter param means "unset".
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || undefined;
  const orgUnitId = url.searchParams.get("orgUnitId") || undefined;
  const locationId = url.searchParams.get("locationId") || undefined;
  const cursor = url.searchParams.get("cursor") || undefined;

  const api = getApi();
  const [page, orgUnits, locations]: [DirectoryPage, OrgUnitOption[], LocationOption[]] =
    await Promise.all([
      api.people.list.query({ query, orgUnitId, locationId, cursor }),
      api.org.listOrgUnits.query(),
      api.org.listLocations.query(),
    ]);

  return {
    page,
    orgUnits,
    locations,
    filters: {
      query: query ?? "",
      orgUnitId: orgUnitId ?? "",
      locationId: locationId ?? "",
    },
  };
}

export default function Directory({ loaderData }: Route.ComponentProps) {
  const { page, orgUnits, locations, filters } = loaderData;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const headingId = useId();

  const busy = navigation.state === "loading";
  const resultSummary =
    `${page.rows.length} employee${page.rows.length === 1 ? "" : "s"}` +
    (filters.query ? ` matching “${filters.query}”` : "") +
    (page.nextCursor ? " (more available)" : "");

  // "Next page" link preserves active filters and swaps the opaque cursor.
  const nextParams = new URLSearchParams(searchParams);
  if (page.nextCursor) nextParams.set("cursor", page.nextCursor);

  return (
    <section aria-labelledby={headingId} className="directory">
      <h1 id={headingId}>Employee directory</h1>

      {/* GET form → the loader re-runs server-side with the new filter params. A new
          search/filter starts from page one because the cursor field is not re-emitted. */}
      <Form method="get" role="search" aria-label="Filter employees">
        <DirectoryFilters
          orgUnits={orgUnits}
          locations={locations}
          defaultQuery={filters.query}
          defaultOrgUnitId={filters.orgUnitId}
          defaultLocationId={filters.locationId}
        />
      </Form>

      <p aria-live="polite" className="directory-status">
        {busy ? "Updating results…" : resultSummary}
      </p>

      <DirectoryTable rows={page.rows} caption={`Employees — ${resultSummary}`} />

      {page.nextCursor ? (
        <p className="directory-pagination">
          <Link to={`?${nextParams.toString()}`} preventScrollReset>
            Next page →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
