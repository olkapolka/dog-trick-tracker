import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardState, resolveFriendsState, resolveProfileState } from "@/lib/page-state-contracts";

// Rule: any required-query failure resolves to "error" state.
void test("dashboard query failure resolves to explicit error state", () => {
  assert.equal(
    resolveDashboardState({
      profileError: false,
      scoreError: true,
      catalogError: false,
      catalogCount: 0,
    }),
    "error",
  );
});

void test("dashboard profile query failure resolves to explicit error state", () => {
  assert.equal(
    resolveDashboardState({
      profileError: true,
      scoreError: false,
      catalogError: false,
      catalogCount: 0,
    }),
    "error",
  );
});

// Rule: empty dataset with no query failures resolves to "empty" state.
void test("dashboard empty data resolves to empty state (not error)", () => {
  assert.equal(
    resolveDashboardState({
      profileError: false,
      scoreError: false,
      catalogError: false,
      catalogCount: 0,
    }),
    "empty",
  );
});

// Rule: any required-query failure resolves to "error" state.
void test("profile query failure resolves to explicit error state", () => {
  assert.equal(
    resolveProfileState({
      profileError: false,
      scoreError: false,
      userTricksError: true,
      trickCount: 0,
    }),
    "error",
  );
});

void test("profile profile query failure resolves to explicit error state", () => {
  assert.equal(
    resolveProfileState({
      profileError: true,
      scoreError: false,
      userTricksError: false,
      trickCount: 0,
    }),
    "error",
  );
});

// Rule: empty dataset with no query failures resolves to "empty" state.
void test("profile empty trick list resolves to empty state", () => {
  assert.equal(
    resolveProfileState({
      profileError: false,
      scoreError: false,
      userTricksError: false,
      trickCount: 0,
    }),
    "empty",
  );
});

// Rule: any required-query failure resolves to "error" state.
void test("friends query failure resolves to explicit error state", () => {
  assert.equal(
    resolveFriendsState({
      followingError: true,
      followersError: false,
      profilesError: false,
      followingCount: 0,
      followersCount: 0,
    }),
    "error",
  );
});

void test("friends profile query failure resolves to explicit error state", () => {
  assert.equal(
    resolveFriendsState({
      followingError: false,
      followersError: false,
      profilesError: true,
      followingCount: 0,
      followersCount: 0,
    }),
    "error",
  );
});

// Rule: empty dataset with no query failures resolves to "empty" state.
void test("friends zero relationships resolves to empty state", () => {
  assert.equal(
    resolveFriendsState({
      followingError: false,
      followersError: false,
      profilesError: false,
      followingCount: 0,
      followersCount: 0,
    }),
    "empty",
  );
});
