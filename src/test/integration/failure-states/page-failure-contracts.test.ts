import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardState, resolveFriendsState, resolveProfileState } from "@/lib/page-state-contracts";

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
