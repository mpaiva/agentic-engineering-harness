// Real tests, run with the Node built-in runner: `npm test` → `node --test`.
// These are the acceptance criteria the independent verifier derives from the objective.
import { test } from "node:test";
import assert from "node:assert/strict";
import { truncate } from "../src/truncate.js";

test("returns a short string unchanged", () => {
  assert.equal(truncate("short", 10), "short");
});

test("returns an exact-length string unchanged", () => {
  assert.equal(truncate("exactly10!", 10), "exactly10!");
});

test("truncates a long string so the total length equals maxLen", () => {
  const result = truncate("The quick brown fox", 10);
  assert.equal(result, "The qui...");
  assert.equal(result.length, 10);
  assert.ok(result.endsWith("..."));
});

test("honours a custom suffix", () => {
  const result = truncate("Employee Event Details", 12, " [more]");
  assert.equal(result, "Emplo [more]");
  assert.equal(result.length, 12);
  assert.ok(result.endsWith(" [more]"));
});

test("returns empty string for empty or non-string input", () => {
  assert.equal(truncate("", 10), "");
  assert.equal(truncate(null, 10), "");
  assert.equal(truncate(undefined, 10), "");
  assert.equal(truncate(12345, 10), "");
});

// Regression: independent reviewers on goal run 7076c025 found that maxLen < suffix.length
// produced output LONGER than maxLen (negative slice index). The result must never exceed maxLen.
test("never exceeds maxLen when maxLen is smaller than the suffix", () => {
  assert.equal(truncate("abcdefgh", 2), "..");
  assert.equal(truncate("abcdefgh", 2).length, 2);
  assert.equal(truncate("abcdefgh", 0), "");
  assert.equal(truncate("abcdefgh", 1), ".");
});
