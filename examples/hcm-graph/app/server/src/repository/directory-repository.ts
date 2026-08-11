/**
 * The API read-model — the view-shaped side of the repository seam.
 *
 * The four marquee traversals (schema.md §5) are owned in their canonical,
 * id-only form by `Neo4jOrgRepository` (org-repository.ts). The tRPC contract,
 * however, returns *pre-shaped trees* the UI can render directly: reporting
 * chains carry each seat's title and current holder's name, the org chart is a
 * recursive node tree, the directory is cursor-paginated. Those view shapes are
 * this module's job.
 *
 * Every query here MIRRORS a §5 traversal core VERBATIM — the same
 * `REPORTS_TO*` / `PART_OF*` walks and the same `HOLDS … WHERE h.to IS NULL`
 * "current holder" predicate the write-path guards and validation queries use —
 * and only widens the RETURN projection or reshapes the result. All Cypher
 * stays behind this seam; nothing above it issues a query. The contract test
 * cross-checks these enriched results against the canonical §5 module on the
 * same seed, so the two cannot silently diverge.
 */
import { isInt } from "neo4j-driver";
import type { Driver, Node } from "neo4j-driver";
import type {
  ChainNode,
  ChartNode,
  DirectoryPage,
  DirectoryRow,
  LocationRef,
  OrgUnitRef,
  PeopleListInput,
  PersonDetail,
  RollupUnit,
  TransitiveReport,
} from "../schemas.js";

// ---------------------------------------------------------------------------
// Cypher — §5 cores mirrored verbatim, projections widened for the view.
// ---------------------------------------------------------------------------

/**
 * §5.1 core mirrored (same `(seat)-[:REPORTS_TO*0..]->(top)` walk, same root
 * predicate), then unwound per seat with the seat's title and current holder.
 * Ordered person (idx 0) → root.
 */
const REPORTING_CHAIN = /* cypher */ `
MATCH (p:Person {id: $personId})-[h:HOLDS]->(seat:Position)
WHERE h.to IS NULL
MATCH chain = (seat)-[:REPORTS_TO*0..]->(top:Position)
WHERE NOT EXISTS { (top)-[:REPORTS_TO]->() }
WITH nodes(chain) AS seats
UNWIND range(0, size(seats) - 1) AS idx
WITH seats[idx] AS s, idx
OPTIONAL MATCH (s)<-[hh:HOLDS]-(m:Person)
WHERE hh.to IS NULL
RETURN idx AS idx,
       s.id AS positionId,
       s.title AS positionTitle,
       m.id AS personId,
       CASE WHEN m IS NULL THEN null ELSE m.firstName + ' ' + m.lastName END AS name
ORDER BY idx
`;

/** §5.2 core mirrored, projection widened with seat title and holder name. */
const TRANSITIVE_REPORTS = /* cypher */ `
MATCH (mgr:Position {id: $positionId})<-[:REPORTS_TO*1..]-(reportSeat:Position)
OPTIONAL MATCH (reportSeat)<-[h:HOLDS]-(person:Person)
WHERE h.to IS NULL
RETURN reportSeat.id AS seatId,
       reportSeat.title AS positionTitle,
       person.id AS holderPersonId,
       CASE WHEN person IS NULL THEN null ELSE person.firstName + ' ' + person.lastName END AS holderName
ORDER BY reportSeat.title, reportSeat.id
`;

/** §5.3 verbatim. */
const SPAN_OF_CONTROL = /* cypher */ `
MATCH (mgr:Position {id: $positionId})<-[:REPORTS_TO]-(direct:Position)
RETURN count(direct) AS spanOfControl
`;

/** §5.4 core mirrored, plus the unit's display name. */
const ORG_ROLLUP = /* cypher */ `
MATCH (root:OrgUnit {id: $unitId})
MATCH (u:OrgUnit)-[:PART_OF*0..]->(root)
MATCH (pos:Position)-[:IN_ORG_UNIT]->(u)
RETURN u.id AS unitId, u.name AS unitName, collect(pos.id) AS positions
ORDER BY u.name, u.id
`;

/** The single root seat — the CEO — used when org.chart is called rootless. */
const CHART_ROOT = /* cypher */ `
MATCH (root:Position)
WHERE NOT EXISTS { (root)-[:REPORTS_TO]->() }
RETURN root.id AS id
ORDER BY root.id
`;

/**
 * Every seat at or below the chart root (via the §5-style `REPORTS_TO*0..`
 * walk), flat, each carrying its immediate solid parent, org unit, current
 * holder, and direct span. The tree and 1-based level are assembled in memory.
 */
const CHART_SUBTREE = /* cypher */ `
MATCH (root:Position {id: $rootId})
MATCH (n:Position)-[:REPORTS_TO*0..]->(root)
MATCH (n)-[:IN_ORG_UNIT]->(u:OrgUnit)
OPTIONAL MATCH (n)<-[h:HOLDS]-(holder:Person)
WHERE h.to IS NULL
OPTIONAL MATCH (n)-[:REPORTS_TO]->(parent:Position)
RETURN n.id AS positionId,
       n.title AS title,
       holder.id AS holderPersonId,
       CASE WHEN holder IS NULL THEN null ELSE holder.firstName + ' ' + holder.lastName END AS holderName,
       u.id AS orgUnitId,
       u.name AS orgUnitName,
       parent.id AS parentPositionId,
       size([ (n)<-[:REPORTS_TO]-() | 1 ]) AS spanOfControl
`;

/**
 * Directory rows: active-graph persons on a *current* seat (HOLDS to IS NULL),
 * so terminated persons with only a closed HOLDS drop out ("as of today").
 * Keyset pagination on (lastName, firstName, id); filters are optional and
 * short-circuit when their param is null.
 */
const LIST_PEOPLE = /* cypher */ `
MATCH (p:Person)-[h:HOLDS]->(pos:Position)
WHERE h.to IS NULL
MATCH (pos)-[:IN_ORG_UNIT]->(u:OrgUnit)
MATCH (pos)-[:BASED_AT]->(loc:Location)
WHERE ($q IS NULL OR toLower(p.firstName) CONTAINS $q
                  OR toLower(p.lastName)  CONTAINS $q
                  OR toLower(p.email)     CONTAINS $q)
  AND ($orgUnitId IS NULL OR u.id = $orgUnitId)
  AND ($locationId IS NULL OR loc.id = $locationId)
  AND ($cLast IS NULL
       OR p.lastName > $cLast
       OR (p.lastName = $cLast AND p.firstName > $cFirst)
       OR (p.lastName = $cLast AND p.firstName = $cFirst AND p.id > $cId))
RETURN p.id AS personId, p.firstName AS firstName, p.lastName AS lastName,
       p.email AS email, p.status AS status,
       pos.id AS positionId, pos.title AS positionTitle,
       u.id AS orgUnitId, u.name AS orgUnitName,
       loc.id AS locationId, loc.name AS locationName
ORDER BY p.lastName, p.firstName, p.id
LIMIT toInteger($limit)
`;

/** Core person record: current seat, its job/unit/location, and the manager. */
const PERSON_CORE = /* cypher */ `
MATCH (p:Person {id: $personId})
OPTIONAL MATCH (p)-[h:HOLDS]->(pos:Position)
WHERE h.to IS NULL
OPTIONAL MATCH (pos)-[:DEFINED_BY]->(job:Job)
OPTIONAL MATCH (pos)-[:IN_ORG_UNIT]->(u:OrgUnit)
OPTIONAL MATCH (pos)-[:BASED_AT]->(loc:Location)
OPTIONAL MATCH (pos)-[:REPORTS_TO]->(mSeat:Position)
OPTIONAL MATCH (mSeat)<-[mh:HOLDS]-(mgr:Person)
WHERE mh.to IS NULL
RETURN p, pos, job, u, loc, mgr
`;

/** Direct-report seats of a person's current seat, with holders (may be open). */
const PERSON_DIRECT_REPORTS = /* cypher */ `
MATCH (p:Person {id: $personId})-[h:HOLDS]->(pos:Position)
WHERE h.to IS NULL
MATCH (pos)<-[:REPORTS_TO]-(rSeat:Position)
OPTIONAL MATCH (rSeat)<-[rh:HOLDS]-(rp:Person)
WHERE rh.to IS NULL
RETURN rSeat.id AS positionId,
       rSeat.title AS positionTitle,
       rp.id AS personId,
       CASE WHEN rp IS NULL THEN null ELSE rp.firstName + ' ' + rp.lastName END AS name
ORDER BY rSeat.title, rSeat.id
`;

const LIST_ORG_UNITS = /* cypher */ `
MATCH (u:OrgUnit)
OPTIONAL MATCH (u)-[:PART_OF]->(parent:OrgUnit)
RETURN u.id AS id, u.name AS name, u.type AS type, parent.id AS parentId
ORDER BY u.name, u.id
`;

const LIST_LOCATIONS = /* cypher */ `
MATCH (l:Location)
RETURN l.id AS id, l.name AS name, l.city AS city,
       l.country AS country, l.timezone AS timezone
ORDER BY l.name, l.id
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (isInt(value)) return value.toNumber();
  return Number(value);
}

function toStr(value: unknown): string {
  return value == null ? "" : String(value);
}

function toStrOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

/** Neo4j Date/DateTime → ISO string; passes plain strings through. */
function toIsoDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return String(value); // neo4j Date.toString() is "YYYY-MM-DD"
}

function props(node: unknown): Record<string, unknown> | null {
  if (node == null) return null;
  return (node as Node).properties as Record<string, unknown>;
}

interface CursorKey {
  l: string;
  f: string;
  i: string;
}

function encodeCursor(row: DirectoryRow): string {
  const key: CursorKey = { l: row.lastName, f: row.firstName, i: row.personId };
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorKey | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<CursorKey>;
    if (
      typeof parsed.l === "string" &&
      typeof parsed.f === "string" &&
      typeof parsed.i === "string"
    ) {
      return { l: parsed.l, f: parsed.f, i: parsed.i };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Interface + implementation
// ---------------------------------------------------------------------------

/** The view-shaped read model the tRPC procedures are served from. */
export interface ViewRepository {
  listPeople(input: PeopleListInput): Promise<DirectoryPage>;
  getPerson(personId: string): Promise<PersonDetail | null>;
  /** Enriched §5.1, ordered person → root. */
  reportingChain(personId: string): Promise<ChainNode[]>;
  /** Enriched §5.2. */
  transitiveReports(positionId: string): Promise<TransitiveReport[]>;
  /** §5.3 verbatim. */
  spanOfControl(positionId: string): Promise<number>;
  /** Enriched §5.4 (adds unitName). */
  rollup(unitId: string): Promise<RollupUnit[]>;
  /** Recursive REPORTS_TO tree; null ⇒ derive the CEO root. */
  chart(rootPositionId: string | null): Promise<ChartNode | null>;
  listOrgUnits(): Promise<OrgUnitRef[]>;
  listLocations(): Promise<LocationRef[]>;
}

interface ChartRow {
  positionId: string;
  title: string;
  holderPersonId: string | null;
  holderName: string | null;
  orgUnitId: string;
  orgUnitName: string;
  parentPositionId: string | null;
  spanOfControl: number;
}

export class Neo4jViewRepository implements ViewRepository {
  constructor(
    private readonly driver: Driver,
    private readonly database?: string | undefined,
  ) {}

  private session() {
    return this.database
      ? this.driver.session({ database: this.database })
      : this.driver.session();
  }

  private async read(
    cypher: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const session = this.session();
    try {
      const result = await session.executeRead((tx) => tx.run(cypher, params));
      return result.records.map(
        (record) => record.toObject() as Record<string, unknown>,
      );
    } finally {
      await session.close();
    }
  }

  async listPeople(input: PeopleListInput): Promise<DirectoryPage> {
    const limit = input.limit;
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = (
      await this.read(LIST_PEOPLE, {
        q: input.query ? input.query.toLowerCase() : null,
        orgUnitId: input.orgUnitId ?? null,
        locationId: input.locationId ?? null,
        cLast: cursor?.l ?? null,
        cFirst: cursor?.f ?? null,
        cId: cursor?.i ?? null,
        limit: limit + 1, // fetch one extra to detect a next page
      })
    ).map(
      (r): DirectoryRow => ({
        personId: toStr(r.personId),
        firstName: toStr(r.firstName),
        lastName: toStr(r.lastName),
        email: toStr(r.email),
        status: toStr(r.status) as DirectoryRow["status"],
        positionId: toStr(r.positionId),
        positionTitle: toStr(r.positionTitle),
        orgUnitId: toStr(r.orgUnitId),
        orgUnitName: toStr(r.orgUnitName),
        locationId: toStr(r.locationId),
        locationName: toStr(r.locationName),
      }),
    );

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      rows.length = limit; // drop the probe row
      const last = rows[rows.length - 1];
      if (last) nextCursor = encodeCursor(last);
    }
    return { rows, nextCursor };
  }

  async getPerson(personId: string): Promise<PersonDetail | null> {
    const core = await this.read(PERSON_CORE, { personId });
    const row = core[0];
    if (!row) return null;

    const p = props(row.p);
    if (!p) return null; // person id not found

    const pos = props(row.pos);
    const job = props(row.job);
    const unit = props(row.u);
    const loc = props(row.loc);
    const mgr = props(row.mgr);

    const [directReports, chainUp] = await Promise.all([
      this.readDirectReports(personId),
      this.reportingChain(personId),
    ]);

    return {
      person: {
        id: toStr(p.id),
        firstName: toStr(p.firstName),
        lastName: toStr(p.lastName),
        email: toStr(p.email),
        status: toStr(p.status) as PersonDetail["person"]["status"],
        hireDate: toIsoDate(p.hireDate),
      },
      position: pos
        ? {
            id: toStr(pos.id),
            title: toStr(pos.title),
            level: toNumber(pos.level),
            fte: toNumber(pos.fte),
            status: toStr(pos.status) as NonNullable<
              PersonDetail["position"]
            >["status"],
          }
        : null,
      job: job
        ? {
            id: toStr(job.id),
            title: toStr(job.title),
            family: toStr(job.family),
            level: toNumber(job.level),
          }
        : null,
      orgUnit: unit
        ? {
            id: toStr(unit.id),
            name: toStr(unit.name),
            type: toStr(unit.type) as NonNullable<
              PersonDetail["orgUnit"]
            >["type"],
          }
        : null,
      location: loc
        ? {
            id: toStr(loc.id),
            name: toStr(loc.name),
            city: toStr(loc.city),
            country: toStr(loc.country),
            timezone: toStr(loc.timezone),
          }
        : null,
      managerPersonId: mgr ? toStr(mgr.id) : null,
      managerName: mgr ? `${toStr(mgr.firstName)} ${toStr(mgr.lastName)}` : null,
      directReports,
      // people.get breadcrumb is ROOT → person: reverse the person→root walk.
      reportingChain: chainUp.slice().reverse(),
    };
  }

  private async readDirectReports(personId: string): Promise<ChainNode[]> {
    const rows = await this.read(PERSON_DIRECT_REPORTS, { personId });
    return rows.map(
      (r): ChainNode => ({
        personId: toStrOrNull(r.personId),
        name: toStrOrNull(r.name),
        positionId: toStr(r.positionId),
        positionTitle: toStr(r.positionTitle),
      }),
    );
  }

  async reportingChain(personId: string): Promise<ChainNode[]> {
    const rows = await this.read(REPORTING_CHAIN, { personId });
    return rows.map(
      (r): ChainNode => ({
        personId: toStrOrNull(r.personId),
        name: toStrOrNull(r.name),
        positionId: toStr(r.positionId),
        positionTitle: toStr(r.positionTitle),
      }),
    );
  }

  async transitiveReports(positionId: string): Promise<TransitiveReport[]> {
    const rows = await this.read(TRANSITIVE_REPORTS, { positionId });
    return rows.map(
      (r): TransitiveReport => ({
        seatId: toStr(r.seatId),
        positionTitle: toStr(r.positionTitle),
        holderPersonId: toStrOrNull(r.holderPersonId),
        holderName: toStrOrNull(r.holderName),
      }),
    );
  }

  async spanOfControl(positionId: string): Promise<number> {
    const rows = await this.read(SPAN_OF_CONTROL, { positionId });
    const row = rows[0];
    return row ? toNumber(row.spanOfControl) : 0;
  }

  async rollup(unitId: string): Promise<RollupUnit[]> {
    const rows = await this.read(ORG_ROLLUP, { unitId });
    return rows.map(
      (r): RollupUnit => ({
        unitId: toStr(r.unitId),
        unitName: toStr(r.unitName),
        positions: ((r.positions as unknown[]) ?? []).map((v) => toStr(v)),
      }),
    );
  }

  async chart(rootPositionId: string | null): Promise<ChartNode | null> {
    let rootId = rootPositionId;
    if (!rootId) {
      const roots = await this.read(CHART_ROOT, {});
      const first = roots[0];
      if (!first) return null;
      rootId = toStr(first.id);
    }

    const rows = (await this.read(CHART_SUBTREE, { rootId })).map(
      (r): ChartRow => ({
        positionId: toStr(r.positionId),
        title: toStr(r.title),
        holderPersonId: toStrOrNull(r.holderPersonId),
        holderName: toStrOrNull(r.holderName),
        orgUnitId: toStr(r.orgUnitId),
        orgUnitName: toStr(r.orgUnitName),
        parentPositionId: toStrOrNull(r.parentPositionId),
        spanOfControl: toNumber(r.spanOfControl),
      }),
    );
    return buildChartTree(rows, rootId);
  }

  async listOrgUnits(): Promise<OrgUnitRef[]> {
    const rows = await this.read(LIST_ORG_UNITS, {});
    return rows.map(
      (r): OrgUnitRef => ({
        id: toStr(r.id),
        name: toStr(r.name),
        type: toStr(r.type) as OrgUnitRef["type"],
        parentId: toStrOrNull(r.parentId),
      }),
    );
  }

  async listLocations(): Promise<LocationRef[]> {
    const rows = await this.read(LIST_LOCATIONS, {});
    return rows.map(
      (r): LocationRef => ({
        id: toStr(r.id),
        name: toStr(r.name),
        city: toStr(r.city),
        country: toStr(r.country),
        timezone: toStr(r.timezone),
      }),
    );
  }
}

/**
 * Assemble the flat subtree rows into a single rooted tree. Every non-root seat
 * in the result set has its immediate parent in the set (the `REPORTS_TO*0..`
 * walk passes through it), so the only node whose parent is absent is the chart
 * root. Children are ordered by title then id for a stable render; `level` is a
 * 1-based BFS depth (aria-level).
 */
function buildChartTree(rows: ChartRow[], rootId: string): ChartNode | null {
  const byId = new Map<string, ChartNode>();
  for (const r of rows) {
    byId.set(r.positionId, {
      positionId: r.positionId,
      title: r.title,
      holderPersonId: r.holderPersonId,
      holderName: r.holderName,
      orgUnitId: r.orgUnitId,
      orgUnitName: r.orgUnitName,
      spanOfControl: r.spanOfControl,
      level: 1,
      children: [],
    });
  }

  const root = byId.get(rootId);
  if (!root) return null;

  for (const r of rows) {
    if (r.positionId === rootId) continue;
    const parentId = r.parentPositionId;
    const node = byId.get(r.positionId);
    if (!node) continue;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) parent.children.push(node);
  }

  // Stable child ordering + 1-based level via BFS from the root.
  const sortChildren = (n: ChartNode) => {
    n.children.sort(
      (a, b) => a.title.localeCompare(b.title) || a.positionId.localeCompare(b.positionId),
    );
    for (const c of n.children) sortChildren(c);
  };
  sortChildren(root);

  const queue: ChartNode[] = [root];
  while (queue.length > 0) {
    const n = queue.shift() as ChartNode;
    for (const c of n.children) {
      c.level = n.level + 1;
      queue.push(c);
    }
  }

  return root;
}
