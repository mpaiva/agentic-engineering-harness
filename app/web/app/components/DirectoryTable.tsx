import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { DirectoryRow } from "~/lib/contract";

type SortKey =
  | "name"
  | "email"
  | "status"
  | "positionTitle"
  | "orgUnitName"
  | "locationName";
type SortDir = "ascending" | "descending";

interface Column {
  key: SortKey;
  label: string;
  value: (r: DirectoryRow) => string;
}

const COLUMNS: Column[] = [
  { key: "name", label: "Name", value: (r) => `${r.lastName}, ${r.firstName}` },
  { key: "email", label: "Email", value: (r) => r.email },
  { key: "status", label: "Status", value: (r) => r.status },
  { key: "positionTitle", label: "Position", value: (r) => r.positionTitle },
  { key: "orgUnitName", label: "Org unit", value: (r) => r.orgUnitName },
  { key: "locationName", label: "Location", value: (r) => r.locationName },
];

export interface DirectoryTableProps {
  rows: DirectoryRow[];
  /** Accessible caption describing the current result set (e.g. filters applied). */
  caption: string;
}

/**
 * Semantic, sortable employee directory table. Sorting is a presentation concern over
 * the already-fetched page (≤ a few hundred rows — no virtualization needed), so it is
 * local state; server-side filtering/pagination happens in the loader via people.list.
 *
 * Accessibility: a real <table> with <caption>, <th scope="col">, and aria-sort on the
 * active column; each header is a <button> so sort is keyboard- and SR-operable (WCAG
 * 2.2 AA). The person's name is the row's link to their detail view.
 */
export function DirectoryTable({ rows, caption }: DirectoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("ascending");

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[0];
    const factor = sortDir === "ascending" ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        factor *
        col.value(a).localeCompare(col.value(b), undefined, {
          sensitivity: "base",
          numeric: true,
        }),
    );
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "ascending" ? "descending" : "ascending"));
    } else {
      setSortKey(key);
      setSortDir("ascending");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="directory-empty" role="status">
        No employees match the current filters.
      </p>
    );
  }

  return (
    <table className="directory-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {COLUMNS.map((col) => {
            const active = col.key === sortKey;
            return (
              <th
                key={col.key}
                scope="col"
                aria-sort={active ? sortDir : "none"}
              >
                <button
                  type="button"
                  className="directory-sort"
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  <span aria-hidden="true" className="directory-sort-indicator">
                    {active ? (sortDir === "ascending" ? " ▲" : " ▼") : ""}
                  </span>
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.personId}>
            <th scope="row">
              <Link to={`/person/${r.personId}`}>
                {r.firstName} {r.lastName}
              </Link>
            </th>
            <td>
              <a href={`mailto:${r.email}`}>{r.email}</a>
            </td>
            <td>
              <span className={`status-badge status-${r.status}`}>
                {r.status}
              </span>
            </td>
            <td>{r.positionTitle}</td>
            <td>{r.orgUnitName}</td>
            <td>{r.locationName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
