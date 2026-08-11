import { Link } from "react-router";
import type { ChainNode, PersonDetail } from "~/lib/contract";

export interface PersonViewProps {
  detail: PersonDetail;
}

/** A chain/report entry: link when the seat has a current holder, plain text when vacant. */
function ChainName({ node }: { node: ChainNode }) {
  const label = node.name ?? `Open seat — ${node.positionTitle}`;
  return node.personId ? (
    <Link to={`/person/${node.personId}`}>{label}</Link>
  ) : (
    <span>{label}</span>
  );
}

/**
 * Person detail — plain, accessible HTML (per stack-recommendation §"Directory/Person"):
 * an <h1>, a description list for the seat/job/unit/location facts, a manager link, a
 * direct-reports list, and a reporting-chain breadcrumb. The manager and each report are
 * derived through the solid-line REPORTS_TO traversal (schema.md §5.1); the breadcrumb is
 * people.get.reportingChain, ordered ROOT → this person, last node = the person.
 *
 * position/job/orgUnit/location are nullable (schema.md §1.1 — a terminated person may
 * hold only a closed HOLDS), so each degrades to an explicit "—" rather than crashing.
 */
export function PersonView({ detail }: PersonViewProps) {
  const {
    person,
    position,
    job,
    orgUnit,
    location,
    managerPersonId,
    managerName,
    directReports,
    reportingChain,
  } = detail;

  const fullName = `${person.firstName} ${person.lastName}`;

  return (
    <article className="person" aria-labelledby="person-name">
      {/* Reporting-chain breadcrumb: ROOT → … → this person. */}
      <nav aria-label="Reporting chain" className="reporting-chain">
        <ol>
          {reportingChain.map((node, i) => {
            const isCurrent = node.personId === person.id;
            const label = node.name ?? `Open seat — ${node.positionTitle}`;
            return (
              <li key={node.positionId}>
                {isCurrent ? (
                  <span aria-current="page">{label}</span>
                ) : (
                  <ChainName node={node} />
                )}
                {i < reportingChain.length - 1 ? (
                  <span aria-hidden="true" className="crumb-sep">
                    {" › "}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <header className="person-header">
        <h1 id="person-name">{fullName}</h1>
        <p className="person-subtitle">{position?.title ?? "No current position"}</p>
        <span className={`status-badge status-${person.status}`}>{person.status}</span>
      </header>

      <dl className="person-facts">
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${person.email}`}>{person.email}</a>
          </dd>
        </div>
        <div>
          <dt>Hire date</dt>
          <dd>{person.hireDate ?? "—"}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            {position
              ? `${position.title} · level ${position.level} · ${position.fte} FTE (${position.status})`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Job</dt>
          <dd>{job ? `${job.title} — ${job.family} family, level ${job.level}` : "—"}</dd>
        </div>
        <div>
          <dt>Org unit</dt>
          <dd>
            {orgUnit ? (
              <>
                {orgUnit.name} <span className="muted">({orgUnit.type})</span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {location
              ? `${location.name} — ${location.city}, ${location.country} · ${location.timezone}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Manager</dt>
          <dd>
            {managerPersonId && managerName ? (
              <Link to={`/person/${managerPersonId}`}>{managerName}</Link>
            ) : (
              <span className="muted">None (top of the reporting line)</span>
            )}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="reports-heading" className="direct-reports">
        <h2 id="reports-heading">
          Direct reports <span className="count-badge">{directReports.length}</span>
        </h2>
        {directReports.length === 0 ? (
          <p className="muted">No direct reports.</p>
        ) : (
          <ul>
            {directReports.map((r) => (
              <li key={r.positionId}>
                <ChainName node={r} />
                <span className="muted"> — {r.positionTitle}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {position ? (
        <p className="person-actions">
          <Link to={`/org-chart?focus=${position.id}`}>
            View {fullName} in the org chart
          </Link>
        </p>
      ) : null}
    </article>
  );
}

export default PersonView;
