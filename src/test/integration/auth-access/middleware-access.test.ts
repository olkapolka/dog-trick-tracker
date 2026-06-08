import assert from "node:assert/strict";
import test from "node:test";
import { shouldRedirectToProfileCreate, shouldRedirectToSignIn } from "@/lib/auth-contracts";

void test("unauthenticated protected requests redirect to /auth/signin", () => {
  for (const path of ["/dashboard", "/profile", "/friends", "/api/tricks/status"]) {
    assert.equal(shouldRedirectToSignIn(path, false), true);
  }
});

void test("authenticated requests without profile redirect to /profile/create", () => {
  assert.equal(shouldRedirectToProfileCreate("/dashboard", true, false), true);
});

void test("authenticated requests with profile can access protected pages", () => {
  assert.equal(shouldRedirectToSignIn("/friends", true), false);
  assert.equal(shouldRedirectToProfileCreate("/friends", true, true), false);
});
