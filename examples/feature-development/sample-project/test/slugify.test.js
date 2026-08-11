// Real tests, run with the Node built-in runner: `npm test` → `node --test`.
// These are the acceptance criteria the independent verifier derives from the objective.
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slugify.js";

test("lowercases and hyphenates words", () => {
  assert.equal(slugify("Employee Event Details"), "employee-event-details");
});

test("strips punctuation", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
});

test("collapses repeated separators and trims edges", () => {
  assert.equal(slugify("  multiple   spaces -- and dashes  "), "multiple-spaces-and-dashes");
});

test("transliterates common accented characters", () => {
  assert.equal(slugify("Café Crème"), "cafe-creme");
});

test("returns empty string for empty-ish input", () => {
  assert.equal(slugify("   "), "");
  assert.equal(slugify(""), "");
});
