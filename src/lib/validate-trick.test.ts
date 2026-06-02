import assert from "node:assert/strict";
import test from "node:test";
import { validateTrickInput } from "./validate-trick";

void test("validateTrickInput reports missing required fields", () => {
  const errors = validateTrickInput({});

  assert.equal(errors.name, "Name is required");
  assert.equal(errors.slug, "Slug is required");
  assert.equal(errors.difficulty, "Difficulty is required");
  assert.equal(errors.description, "Description is required");
});

void test("validateTrickInput accepts valid input", () => {
  const errors = validateTrickInput({
    name: "Back Flip",
    slug: "back-flip",
    difficulty: "advanced",
    description: "Teach a controlled jump with backward rotation.",
  });

  assert.deepEqual(errors, {});
});

void test("validateTrickInput rejects invalid slug format", () => {
  const errors = validateTrickInput({
    name: "Sit Pretty",
    slug: "Sit Pretty",
    difficulty: "beginner",
    description: "Dog balances with front paws off the ground.",
  });

  assert.equal(errors.slug, "Slug must be lowercase letters, numbers, and hyphens only");
});
