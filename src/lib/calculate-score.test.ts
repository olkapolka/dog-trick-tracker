import assert from "node:assert/strict";
import test from "node:test";
import { calculateProgressScoreResult } from "./calculate-score";

void test("calculateProgressScoreResult returns explicit error state on query failure", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return Promise.resolve({
                    data: null,
                    error: { message: "db down" },
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await calculateProgressScoreResult(supabase as never, "user-1");

  assert.deepEqual(result, {
    ok: false,
    error: "db down",
  });
});

void test("calculateProgressScoreResult keeps valid empty score distinct from error", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return Promise.resolve({
                    data: [],
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

  const result = await calculateProgressScoreResult(supabase as never, "user-1");

  assert.deepEqual(result, {
    ok: true,
    score: 0,
  });
});
