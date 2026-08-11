/**
 * Run schema.md §6 validation queries against the live graph and report each.
 * Exit non-zero if any invariant query returns > 0 rows.
 */
import { createDriver, waitForNeo4j, configFromEnv } from "./driver.js";
import { GraphRepository, type ValidationResult } from "./repository.js";

export function formatValidation(results: ValidationResult[]): string {
  const lines: string[] = [];
  for (const v of results) {
    const ok = v.rows === 0;
    lines.push(`  §${v.id}  ${ok ? "PASS" : "FAIL"}  (${v.rows} row${v.rows === 1 ? "" : "s"})  ${v.label}`);
    if (!ok) {
      for (const row of v.offending.slice(0, 5)) lines.push(`        ↳ ${JSON.stringify(row)}`);
    }
  }
  return lines.join("\n");
}

export async function runValidation(): Promise<boolean> {
  const driver = createDriver(configFromEnv());
  try {
    await waitForNeo4j(driver);
    const repo = new GraphRepository(driver);
    const results = await repo.validateAll();
    console.log("[validate] schema.md §6 invariant checks (each MUST return 0 rows):");
    console.log(formatValidation(results));
    const allPass = results.every((r) => r.rows === 0);
    console.log(`[validate] ${allPass ? "ALL PASS — 0 violations." : "VIOLATIONS FOUND."}`);
    return allPass;
  } finally {
    await driver.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error("[validate] failed:", err);
      process.exit(1);
    });
}
