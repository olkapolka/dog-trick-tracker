import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext, runMiddleware, type IntegrationContext } from "./utils/context";
import { runRuntimeSmoke } from "./utils/runtime-smoke";

const PROTECTED_PATHS = ["/dashboard", "/profile", "/friends", "/api/tricks"];

async function middlewareLikeGuard(
  context: IntegrationContext,
  next: () => Response | Promise<Response>,
): Promise<Response> {
  const hasSession = context.request.headers.get("Cookie")?.includes("sb-access-token=") ?? false;

  context.locals.user = hasSession ? { id: "user-test" } : null;

  if (PROTECTED_PATHS.some((path) => context.url.pathname.startsWith(path)) && !context.locals.user) {
    return context.redirect("/auth/signin");
  }

  return next();
}

void test("integration harness can execute middleware-like flow", async () => {
  const context = createIntegrationContext("/dashboard");

  const response = await runMiddleware(middlewareLikeGuard, context);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/auth/signin");
});

void test("runtime smoke helper is deterministic without runtime url", async () => {
  const result = await runRuntimeSmoke(undefined);

  assert.deepEqual(result, {
    skipped: true,
    reason: "Set TEST_RUNTIME_BASE_URL to run runtime smoke checks.",
  });
});
