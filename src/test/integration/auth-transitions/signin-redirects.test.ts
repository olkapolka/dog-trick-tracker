import assert from "node:assert/strict";
import test from "node:test";
import { resolveSignInRedirect } from "@/lib/auth-contracts";

void test("signin redirects to /profile/create when profile is missing", () => {
  assert.equal(resolveSignInRedirect(false, "/friends"), "/profile/create");
});

void test("signin redirects to returnTo for profile-complete user", () => {
  assert.equal(resolveSignInRedirect(true, "/friends"), "/friends");
});

void test("signin redirects to /dashboard when returnTo is missing", () => {
  assert.equal(resolveSignInRedirect(true, null), "/dashboard");
});
