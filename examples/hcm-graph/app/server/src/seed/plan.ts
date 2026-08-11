/**
 * Deterministic seed generator for schema.md §7.
 *
 * Pure function: buildPlan() takes no I/O and always returns the SAME graph, so a
 * reseed is byte-identical (schema.md §1.3: ids survive reseed). The org *shape* is
 * fixed by explicit patterns (not random) so counts are auditable; a seeded PRNG only
 * decorates leaves with names / locations / hire dates for realism.
 *
 * §7 targets and how they are met (exact counts asserted at the bottom):
 *   • 1 company root OrgUnit + 1 root Position (CEO), the only seat with no REPORTS_TO.
 *   • 5 divisions PART_OF company → 10 departments → 24 teams; depth 4, 40 OrgUnits.
 *   • 200 Positions: 1 CEO + 5 VP + 10 Director + 24 Lead + 160 IC.
 *     Each IN_ORG_UNIT exactly one unit, DEFINED_BY one of 15 Jobs, BASED_AT one of
 *     6 Locations (6 timezones ≥ 3), REPORTS_TO a single solid parent. Span 2–8:
 *     CEO→5, VP→2, Director→2–3, Lead→6–7.
 *   • 188 filled (active/leave holders via open HOLDS), 12 open — all open seats are
 *     ICs (leaves), so no vacant manager (schema.md §8.2 precondition for §6.5).
 *   • 4 terminated Persons carry a CLOSED HOLDS on now-refilled seats (temporal filter).
 *   • 1 matrix case: an Engineering IC with one DOTTED_REPORTS_TO into Finance — adds
 *     NO second REPORTS_TO, so §6.1/§6.5 still pass (schema.md §1.2 / §7).
 */

// ── domain shapes (mirror repository input types) ──
export interface OrgUnitPlan { id: string; name: string; type: "company" | "division" | "department" | "team"; parentId: string | null; }
export interface PositionPlan {
  id: string; title: string; level: number; fte: number; status: "filled" | "open";
  orgUnitId: string; jobId: string; locationId: string; reportsToId: string | null;
  role: "ceo" | "vp" | "director" | "lead" | "ic";
}
export interface PersonPlan { id: string; firstName: string; lastName: string; email: string; status: "active" | "leave" | "terminated"; hireDate: string; }
export interface JobPlan { id: string; title: string; family: string; level: number; description: string; }
export interface LocationPlan { id: string; name: string; city: string; country: string; timezone: string; }
export interface HoldPlan { personId: string; positionId: string; from: string; to: string | null; }
export interface DottedPlan { childId: string; parentId: string; reason: string; }

export interface SeedPlan {
  orgUnits: OrgUnitPlan[];
  positions: PositionPlan[];
  jobs: JobPlan[];
  locations: LocationPlan[];
  persons: PersonPlan[];
  holds: HoldPlan[];
  dotted: DottedPlan[];
}

// ── deterministic PRNG (mulberry32) — realism only, never structure ──
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 0x48434d31; // "HCM1"

const pad6 = (n: number) => String(n).padStart(6, "0");

// ── fixed reference data ──
const LOCATIONS: LocationPlan[] = [
  { id: "LOC-000001", name: "HQ — San Francisco", city: "San Francisco", country: "US", timezone: "America/Los_Angeles" },
  { id: "LOC-000002", name: "New York Office",    city: "New York",      country: "US", timezone: "America/New_York" },
  { id: "LOC-000003", name: "London Office",      city: "London",        country: "GB", timezone: "Europe/London" },
  { id: "LOC-000004", name: "Berlin Office",      city: "Berlin",        country: "DE", timezone: "Europe/Berlin" },
  { id: "LOC-000005", name: "Singapore Office",   city: "Singapore",     country: "SG", timezone: "Asia/Singapore" },
  { id: "LOC-000006", name: "Sydney Office",      city: "Sydney",        country: "AU", timezone: "Australia/Sydney" },
];

// 15-job catalog. indices are stable (JOB-000001 … JOB-000015).
const JOBS: JobPlan[] = [
  { id: "JOB-000001", title: "Chief Executive Officer", family: "Executive",  level: 6, description: "Leads the company." },
  { id: "JOB-000002", title: "VP, Engineering",         family: "Engineering", level: 5, description: "Heads the Engineering division." },
  { id: "JOB-000003", title: "VP, Sales",               family: "Sales",       level: 5, description: "Heads the Sales division." },
  { id: "JOB-000004", title: "VP, Marketing",           family: "Marketing",   level: 5, description: "Heads the Marketing division." },
  { id: "JOB-000005", title: "VP, Operations",          family: "Operations",  level: 5, description: "Heads the Operations division." },
  { id: "JOB-000006", title: "VP, Finance",             family: "Finance",     level: 5, description: "Heads the Finance division." },
  { id: "JOB-000007", title: "Director",                family: "Management",  level: 4, description: "Leads a department." },
  { id: "JOB-000008", title: "Manager",                 family: "Management",  level: 3, description: "Leads a team." },
  { id: "JOB-000009", title: "Software Engineer",       family: "Engineering", level: 2, description: "Builds and maintains software." },
  { id: "JOB-000010", title: "Senior Software Engineer", family: "Engineering", level: 3, description: "Senior individual contributor in Engineering." },
  { id: "JOB-000011", title: "Account Executive",       family: "Sales",       level: 2, description: "Owns customer accounts and revenue." },
  { id: "JOB-000012", title: "Marketing Specialist",    family: "Marketing",   level: 2, description: "Runs marketing programs." },
  { id: "JOB-000013", title: "Operations Analyst",      family: "Operations",  level: 2, description: "Analyzes and improves operations." },
  { id: "JOB-000014", title: "Financial Analyst",       family: "Finance",     level: 2, description: "Owns financial analysis and reporting." },
  { id: "JOB-000015", title: "Business Analyst",        family: "Operations",  level: 2, description: "Bridges business and delivery." },
];

// Division definitions: name, VP job, IC job(s) for its teams.
const DIVISIONS: { name: string; vpJob: string; icJobs: string[]; depts: string[] }[] = [
  { name: "Engineering", vpJob: "JOB-000002", icJobs: ["JOB-000009", "JOB-000010"], depts: ["Platform", "Product Engineering"] },
  { name: "Sales",       vpJob: "JOB-000003", icJobs: ["JOB-000011"],               depts: ["Enterprise Sales", "SMB Sales"] },
  { name: "Marketing",   vpJob: "JOB-000004", icJobs: ["JOB-000012"],               depts: ["Brand", "Demand Generation"] },
  { name: "Operations",  vpJob: "JOB-000005", icJobs: ["JOB-000013", "JOB-000015"], depts: ["People Ops", "IT Operations"] },
  { name: "Finance",     vpJob: "JOB-000006", icJobs: ["JOB-000014"],               depts: ["Accounting", "FP&A"] },
];

// teams-per-department, in department order (10 depts). Sum = 24 teams; each dept ≥ 2
// so every Director's span is 2–3.
const TEAMS_PER_DEPT = [3, 2, 3, 2, 3, 2, 3, 2, 2, 2];

// ICs-per-team, in team order (24 teams). Sum = 160; each in 6–7 so every Lead's span is 6–7.
const ICS_PER_TEAM = [
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, // 16 teams × 7 = 112
  6, 6, 6, 6, 6, 6, 6, 6,                          //  8 teams × 6 =  48
];

const FIRST_NAMES = [
  "Ava", "Liam", "Maya", "Noah", "Zara", "Ethan", "Priya", "Lucas", "Amara", "Kai",
  "Sofia", "Diego", "Nina", "Omar", "Chloe", "Ravi", "Elena", "Jonas", "Yuki", "Mateo",
  "Aisha", "Leo", "Hana", "Marcus", "Freya", "Tariq", "Lena", "Sven", "Isla", "Dev",
  "Camila", "Arjun", "Nora", "Felix", "Sana", "Pablo", "Ingrid", "Hugo", "Mei", "Rowan",
];
const LAST_NAMES = [
  "Okafor", "Chen", "Patel", "Nguyen", "Haddad", "Kim", "Rossi", "Silva", "Larsson", "Mbeki",
  "Novak", "Reyes", "Fischer", "Costa", "Ali", "Yamamoto", "Petrov", "Weber", "Diallo", "Sharma",
  "Andersson", "Khan", "Moreau", "Cohen", "Ferreira", "Tanaka", "Muller", "Santos", "Ibrahim", "Kowalski",
];

// ── plan builder ──
export function buildPlan(): SeedPlan {
  const rng = mulberry32(SEED);
  const orgUnits: OrgUnitPlan[] = [];
  const positions: PositionPlan[] = [];
  let posCounter = 0;
  let orgCounter = 0;
  const newOrgId = () => `ORG-${pad6(++orgCounter)}`;
  const newPosId = () => `POS-${pad6(++posCounter)}`;

  // company root + CEO
  const companyId = newOrgId();
  orgUnits.push({ id: companyId, name: "Globex Corporation", type: "company", parentId: null });
  const ceoId = newPosId();
  positions.push({
    id: ceoId, title: "Chief Executive Officer", level: 6, fte: 1.0, status: "filled",
    orgUnitId: companyId, jobId: "JOB-000001", locationId: LOCATIONS[0]!.id, reportsToId: null, role: "ceo",
  });

  // walk divisions → departments → teams → ICs, consuming the fixed pattern arrays
  let deptIndex = 0;
  let teamIndex = 0;
  for (const div of DIVISIONS) {
    const divUnitId = newOrgId();
    orgUnits.push({ id: divUnitId, name: div.name, type: "division", parentId: companyId });
    const vpId = newPosId();
    positions.push({
      id: vpId, title: `VP, ${div.name}`, level: 5, fte: 1.0, status: "filled",
      orgUnitId: divUnitId, jobId: div.vpJob, locationId: LOCATIONS[0]!.id, reportsToId: ceoId, role: "vp",
    });

    for (const deptName of div.depts) {
      const deptUnitId = newOrgId();
      orgUnits.push({ id: deptUnitId, name: `${div.name} — ${deptName}`, type: "department", parentId: divUnitId });
      const dirId = newPosId();
      positions.push({
        id: dirId, title: `Director, ${deptName}`, level: 4, fte: 1.0, status: "filled",
        orgUnitId: deptUnitId, jobId: "JOB-000007", locationId: pickLocation(rng), reportsToId: vpId, role: "director",
      });

      const teamCount = TEAMS_PER_DEPT[deptIndex++]!;
      for (let t = 0; t < teamCount; t++) {
        const teamUnitId = newOrgId();
        const teamName = `${deptName} Team ${t + 1}`;
        orgUnits.push({ id: teamUnitId, name: teamName, type: "team", parentId: deptUnitId });
        const leadId = newPosId();
        positions.push({
          id: leadId, title: `${teamName} Lead`, level: 3, fte: 1.0, status: "filled",
          orgUnitId: teamUnitId, jobId: "JOB-000008", locationId: pickLocation(rng), reportsToId: dirId, role: "lead",
        });

        const icCount = ICS_PER_TEAM[teamIndex++]!;
        for (let i = 0; i < icCount; i++) {
          const icJob = div.icJobs[i % div.icJobs.length]!;
          const job = JOBS.find((j) => j.id === icJob)!;
          positions.push({
            id: newPosId(), title: job.title, level: job.level, fte: rng() < 0.06 ? 0.8 : 1.0, status: "filled",
            orgUnitId: teamUnitId, jobId: icJob, locationId: pickLocation(rng), reportsToId: leadId, role: "ic",
          });
        }
      }
    }
  }

  // ── open seats: 12 ICs (leaves), spread deterministically across the IC pool ──
  const icPositions = positions.filter((p) => p.role === "ic");
  const OPEN_COUNT = 12;
  const openStride = Math.floor(icPositions.length / OPEN_COUNT); // 160/12 = 13
  const openIds = new Set<string>();
  for (let k = 0; k < OPEN_COUNT; k++) {
    const ic = icPositions[k * openStride]!;
    ic.status = "open";
    openIds.add(ic.id);
  }

  // ── persons + HOLDS ──
  const persons: PersonPlan[] = [];
  const holds: HoldPlan[] = [];
  let personCounter = 0;
  const newPerson = (status: PersonPlan["status"], hireYear: number): PersonPlan => {
    const idx = personCounter++;
    const first = FIRST_NAMES[idx % FIRST_NAMES.length]!;
    const last = LAST_NAMES[Math.floor(idx / FIRST_NAMES.length) % LAST_NAMES.length]!;
    const month = String(1 + (idx % 12)).padStart(2, "0");
    const day = String(1 + (idx % 27)).padStart(2, "0");
    const p: PersonPlan = {
      id: `PER-${pad6(idx + 1)}`,
      firstName: first, lastName: last,
      email: `${first}.${last}.${idx + 1}`.toLowerCase() + "@globex.example",
      status, hireDate: `${hireYear}-${month}-${day}`,
    };
    persons.push(p);
    return p;
  };

  // Every FILLED seat gets one current holder (open HOLDS). ~6 holders are on 'leave'
  // (still hold their seat); the rest are 'active'. Leave holders are chosen among ICs
  // only, so no manager seat is held by a non-active person that §6.5 would skip.
  const filled = positions.filter((p) => p.status === "filled");
  const leaveStride = Math.floor(filled.length / 6); // ~6 leave holders
  let leaveAssigned = 0;
  filled.forEach((pos, i) => {
    const onLeave = pos.role === "ic" && i % leaveStride === 0 && leaveAssigned < 6;
    const status: PersonPlan["status"] = onLeave ? "leave" : "active";
    if (onLeave) leaveAssigned++;
    const hireYear = 2015 + (i % 9); // 2015–2023
    const person = newPerson(status, hireYear);
    holds.push({ personId: person.id, positionId: pos.id, from: `${hireYear}-01-01`, to: null });
  });

  // ── 4 terminated predecessors: a CLOSED HOLDS on a now-refilled seat ──
  // Chosen across roles (2 managers, 2 ICs) — all already have a current active holder,
  // so the seat stays 'filled' and §6.5 is unaffected.
  const predecessorSeats = [
    positions.find((p) => p.role === "director")!,
    positions.find((p) => p.role === "lead")!,
    filled.filter((p) => p.role === "ic")[10]!,
    filled.filter((p) => p.role === "ic")[40]!,
  ];
  for (const seat of predecessorSeats) {
    const person = newPerson("terminated", 2012);
    holds.push({ personId: person.id, positionId: seat.id, from: "2012-03-01", to: "2018-06-30" });
  }

  // ── 1 matrix case: an Engineering IC dotted into a Finance manager ──
  const engIc = positions.find((p) => p.role === "ic" && p.status === "filled" && p.title.includes("Engineer"))!;
  const financeMgr = positions.find((p) => p.role === "director" && p.title.includes("Accounting"))!
    ?? positions.find((p) => p.role === "lead" && p.orgUnitId.length > 0 && p.title.includes("Accounting"))!;
  const dotted: DottedPlan[] = [
    { childId: engIc.id, parentId: financeMgr.id, reason: "Finance systems liaison (matrix)" },
  ];

  const plan: SeedPlan = { orgUnits, positions, jobs: JOBS, locations: LOCATIONS, persons, holds, dotted };
  assertPlan(plan);
  return plan;
}

function pickLocation(rng: () => number): string {
  return LOCATIONS[Math.floor(rng() * LOCATIONS.length)]!.id;
}

/** Fail fast if the generated plan drifts off the §7 targets. */
function assertPlan(plan: SeedPlan): void {
  const eq = (name: string, actual: number, expected: number) => {
    if (actual !== expected) throw new Error(`seed plan invariant failed: ${name} = ${actual}, expected ${expected}`);
  };
  eq("orgUnits", plan.orgUnits.length, 40);
  eq("companyRoots", plan.orgUnits.filter((o) => o.type === "company").length, 1);
  eq("divisions", plan.orgUnits.filter((o) => o.type === "division").length, 5);
  eq("departments", plan.orgUnits.filter((o) => o.type === "department").length, 10);
  eq("teams", plan.orgUnits.filter((o) => o.type === "team").length, 24);
  eq("positions", plan.positions.length, 200);
  eq("jobs", plan.jobs.length, 15);
  eq("locations", plan.locations.length, 6);
  eq("roots (no REPORTS_TO)", plan.positions.filter((p) => p.reportsToId === null).length, 1);
  eq("open seats", plan.positions.filter((p) => p.status === "open").length, 12);
  eq("filled seats", plan.positions.filter((p) => p.status === "filled").length, 188);
  eq("open HOLDS", plan.holds.filter((h) => h.to === null).length, 188);
  eq("closed HOLDS", plan.holds.filter((h) => h.to !== null).length, 4);
  eq("dotted edges", plan.dotted.length, 1);

  // ≥ 3 timezones
  const tz = new Set(plan.locations.map((l) => l.timezone));
  if (tz.size < 3) throw new Error(`seed plan invariant failed: timezones = ${tz.size}, expected ≥ 3`);

  // every open seat is an IC leaf (no position reports to it)
  const parents = new Set(plan.positions.map((p) => p.reportsToId).filter(Boolean) as string[]);
  for (const open of plan.positions.filter((p) => p.status === "open")) {
    if (parents.has(open.id)) throw new Error(`seed plan invariant failed: open seat ${open.id} has reports (not a leaf)`);
  }

  // span of control 2–8 for every manager (position with ≥1 report)
  const span = new Map<string, number>();
  for (const p of plan.positions) if (p.reportsToId) span.set(p.reportsToId, (span.get(p.reportsToId) ?? 0) + 1);
  for (const [id, n] of span) {
    if (n < 2 || n > 8) throw new Error(`seed plan invariant failed: span of ${id} = ${n}, expected 2–8`);
  }

  // no filled/open position without an org unit, job, or location
  for (const p of plan.positions) {
    if (!p.orgUnitId || !p.jobId || !p.locationId) throw new Error(`seed plan invariant failed: ${p.id} missing edge`);
  }
}
