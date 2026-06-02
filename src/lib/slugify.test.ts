import assert from "node:assert/strict";
import test from "node:test";
import { generateSlug } from "./slugify";

void test("generateSlug converts simple words to kebab-case", () => {
  assert.equal(generateSlug("Hello World"), "hello-world");
});

void test("generateSlug strips punctuation and preserves numbers", () => {
  assert.equal(generateSlug("Test! 123"), "test-123");
});

void test("generateSlug trims separators around the slug", () => {
  assert.equal(generateSlug("  __High Five__  "), "high-five");
});
