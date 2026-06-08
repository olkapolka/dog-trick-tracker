import assert from "node:assert/strict";
import test from "node:test";
import { shouldRedirectToSignIn } from "@/lib/auth-contracts";

interface SessionState {
  active: boolean;
}

void test("signout tears down access to protected page and API", () => {
  const state: SessionState = { active: true };

  assert.equal(shouldRedirectToSignIn("/dashboard", state.active), false);
  assert.equal(shouldRedirectToSignIn("/api/tricks/status", state.active), false);

  state.active = false;

  assert.equal(shouldRedirectToSignIn("/dashboard", state.active), true);
  assert.equal(shouldRedirectToSignIn("/api/tricks/status", state.active), true);
});
