import assert from "node:assert/strict";
import test from "node:test";
import { getAdminCheckResult } from "./admin";

void test("getAdminCheckResult returns explicit error state on profile query failure", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data: null,
                    error: { message: "query failed" },
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await getAdminCheckResult("user-1", supabase as never);

  assert.deepEqual(result, {
    ok: false,
    error: "query failed",
  });
});

void test("getAdminCheckResult keeps non-admin false distinct from query error", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data: { is_admin: false },
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await getAdminCheckResult("user-1", supabase as never);

  assert.deepEqual(result, {
    ok: true,
    isAdmin: false,
  });
});
