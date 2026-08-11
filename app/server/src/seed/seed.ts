/**
 * Seed the graph from the deterministic plan (plan.ts), then self-verify.
 *
 * The structural edges are written THROUGH the §4 write-path guards
 * (repository.reportsToGuarded / openHoldGuarded / setOrgUnitGuarded / setPartOfGuarded),
 * so a successful seed is itself evidence the guards accept only valid writes. After
 * loading, it runs the schema.md §6 validation (must be 0 rows) and prints sample §5
 * traversals. Everything printed is also written to app/server/seed-run.log.
 *
 * Idempotent: it runs the §3 migration and a full wipe first, so reseeding is safe.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDriver, waitForNeo4j, configFromEnv } from "../db/driver.js";
import { GraphRepository } from "../db/repository.js";
import { formatValidation } from "../db/validate.js";
import { buildPlan } from "./plan.js";

const LOG_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seed-run.log");

class TeeLog {
  private lines: string[] = [];
  log(line = ""): void {
    this.lines.push(line);
    console.log(line);
  }
  flush(path: string): void {
    writeFileSync(path, this.lines.join("\n") + "\n", "utf8");
  }
}

export async function runSeed(): Promise<boolean> {
  const out = new TeeLog();
  const cfg = configFromEnv();
  const started = new Date();
  out.log("═══════════════════════════════════════════════════════════════════════");
  out.log(" HCM Core-HR seed run — schema.md §7 plan");
  out.log(`   started : ${started.toISOString()}`);
  out.log(`   target  : ${cfg.uri} (user ${cfg.user})`);
  out.log("═══════════════════════════════════════════════════════════════════════");

  const driver = createDriver(cfg);
  try {
    await waitForNeo4j(driver);
    out.log("[1/6] connected to Neo4j.");
    const repo = new GraphRepository(driver);

    const mig = await repo.migrate();
    out.log(`[2/6] migration applied: ${mig.constraints} constraints, ${mig.indexes} indexes (schema.md §3).`);

    await repo.wipeAll();
    out.log("[3/6] wiped existing graph (idempotent reseed).");

    const plan = buildPlan();
    out.log(
      `[4/6] plan built: ${plan.orgUnits.length} org units, ${plan.positions.length} positions, ` +
        `${plan.jobs.length} jobs, ${plan.locations.length} locations, ${plan.persons.length} persons, ` +
        `${plan.holds.length} holds (${plan.holds.filter((h) => h.to === null).length} open / ` +
        `${plan.holds.filter((h) => h.to !== null).length} closed), ${plan.dotted.length} dotted.`,
    );

    // ── reference data ──
    for (const j of plan.jobs) await repo.upsertJob(j);
    for (const l of plan.locations) await repo.upsertLocation(l);

    // ── org units + PART_OF (guard §4.4, parent before child by construction) ──
    for (const o of plan.orgUnits) await repo.upsertOrgUnit(o);
    for (const o of plan.orgUnits) {
      if (o.parentId) await repo.setPartOfGuarded(o.id, o.parentId);
    }

    // ── positions + IN_ORG_UNIT (guard §4.3), DEFINED_BY, BASED_AT ──
    for (const p of plan.positions) {
      await repo.upsertPosition({ id: p.id, title: p.title, level: p.level, fte: p.fte, status: p.status });
    }
    for (const p of plan.positions) {
      await repo.setOrgUnitGuarded(p.id, p.orgUnitId);
      await repo.definedBy(p.id, p.jobId);
      await repo.basedAt(p.id, p.locationId);
    }

    // ── solid reporting lines (guard §4.1) ──
    for (const p of plan.positions) {
      if (p.reportsToId) await repo.reportsToGuarded(p.id, p.reportsToId);
    }

    // ── persons + HOLDS: current holders via guard §4.2, then closed predecessors ──
    for (const person of plan.persons) await repo.upsertPerson(person);
    for (const h of plan.holds.filter((x) => x.to === null)) {
      await repo.openHoldGuarded(h.personId, h.positionId);
    }
    for (const h of plan.holds.filter((x) => x.to !== null)) {
      await repo.closedHold(h.personId, h.positionId, h.from, h.to!);
    }

    // ── matrix dotted line (distinct type, §1.2) ──
    for (const d of plan.dotted) await repo.dottedReportsTo(d.childId, d.parentId, d.reason);
    out.log("[5/6] graph written through the §4 write-path guards (all guards accepted).");

    // ── node counts ──
    out.log("");
    out.log("Node counts (live graph):");
    for (const c of await repo.nodeCounts()) out.log(`   ${c.label.padEnd(9)} ${c.count}`);

    // ── §6 validation ──
    out.log("");
    const results = await repo.validateAll();
    out.log("[6/6] schema.md §6 invariant validation (each MUST return 0 rows):");
    out.log(formatValidation(results));
    const pass = results.every((r) => r.rows === 0);
    out.log(`      → ${pass ? "ALL PASS — 0 violations across all five invariants." : "VIOLATIONS FOUND."}`);

    // ── sample §5 traversals as evidence ──
    out.log("");
    out.log("Sample §5 marquee traversals:");
    await sampleTraversals(repo, plan, out);

    out.log("");
    out.log(`Finished: ${new Date().toISOString()} — ${pass ? "SEED OK" : "SEED FAILED VALIDATION"}.`);
    out.flush(LOG_PATH);
    out.log(`(log written to ${LOG_PATH})`);
    return pass;
  } finally {
    await driver.close();
  }
}

async function sampleTraversals(repo: GraphRepository, plan: ReturnType<typeof buildPlan>, out: TeeLog) {
  // Reporting chain up: pick the deepest active IC holder.
  const icHold = plan.holds.find((h) => {
    const pos = plan.positions.find((p) => p.id === h.positionId);
    const per = plan.persons.find((p) => p.id === h.personId);
    return h.to === null && pos?.role === "ic" && per?.status === "active";
  })!;
  const chain = await repo.reportingChainUp(icHold.personId);
  out.log(`   §5.1 reporting chain up for ${icHold.personId}: [${chain.join(" → ")}]  (${chain.length} levels to root)`);

  // Span of control + transitive reports for a VP.
  const vp = plan.positions.find((p) => p.role === "vp")!;
  const span = await repo.spanOfControl(vp.id);
  const all = await repo.allReports(vp.id);
  out.log(`   §5.3 span of control for ${vp.id} (${vp.title}): ${span} direct`);
  out.log(`   §5.2 transitive reports below ${vp.id}: ${all.length} seats, ${all.filter((r) => r.holder).length} filled`);

  // Span for CEO (should equal number of divisions).
  const ceo = plan.positions.find((p) => p.role === "ceo")!;
  out.log(`   §5.3 span of control for ${ceo.id} (CEO): ${await repo.spanOfControl(ceo.id)} direct`);

  // Org rollup for the company root.
  const company = plan.orgUnits.find((o) => o.type === "company")!;
  const rollup = await repo.orgRollup(company.id);
  const totalPositions = rollup.reduce((n, r) => n + r.positions.length, 0);
  out.log(`   §5.4 org rollup for ${company.id} (company): ${rollup.length} units, ${totalPositions} positions total`);

  // Matrix dotted case.
  const d = plan.dotted[0]!;
  out.log(`   §1.2 matrix: ${d.childId} -[:DOTTED_REPORTS_TO]-> ${d.parentId} ("${d.reason}") — no second REPORTS_TO`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error("[seed] failed:", err);
      process.exit(1);
    });
}
