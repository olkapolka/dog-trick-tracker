import assert from "node:assert/strict";
import test from "node:test";
import { recalculateScoresForTrick, getRecalculatedScoresForTrick } from "./recalculate-user-scores";

interface UserTrickRow {
  user_id: string;
}

interface WeightRow {
  tricks: { difficulty_weight: number } | null;
}

void test("getRecalculatedScoresForTrick returns recalculated scores for users who finished the trick", async () => {
  const finishedRows: UserTrickRow[] = [{ user_id: "user-a" }, { user_id: "user-b" }, { user_id: "user-a" }];

  const weightsByUser: Record<string, WeightRow[]> = {
    "user-a": [{ tricks: { difficulty_weight: 1 } }, { tricks: { difficulty_weight: 2 } }],
    "user-b": [{ tricks: { difficulty_weight: 3 } }],
  };

  const calls: string[] = [];

  const supabase = {
    from(table: string) {
      return {
        select(columns: string) {
          if (table === "user_tricks" && columns === "user_id") {
            return {
              eq(field: string, value: string) {
                assert.equal(field, "trick_id");
                assert.equal(value, "trick-1");
                return {
                  eq(nextField: string, nextValue: string) {
                    assert.equal(nextField, "status");
                    assert.equal(nextValue, "finished");
                    return Promise.resolve({ data: finishedRows, error: null });
                  },
                };
              },
            };
          }

          if (table === "user_tricks" && columns === "tricks(difficulty_weight)") {
            return {
              eq(field: string, value: string) {
                assert.equal(field, "user_id");
                calls.push(value);

                return {
                  eq(nextField: string, nextValue: string) {
                    assert.equal(nextField, "status");
                    assert.equal(nextValue, "finished");
                    return Promise.resolve({ data: weightsByUser[value] ?? [], error: null });
                  },
                };
              },
            };
          }

          throw new Error(`Unexpected select call: ${table}.${columns}`);
        },
      };
    },
  };

  const result = await getRecalculatedScoresForTrick("trick-1", supabase as never);

  assert.deepEqual(
    result.sort((a, b) => a.userId.localeCompare(b.userId)),
    [
      { userId: "user-a", score: 3 },
      { userId: "user-b", score: 3 },
    ],
  );

  assert.deepEqual(calls.sort(), ["user-a", "user-b"]);
});

void test("recalculateScoresForTrick resolves for users with no finished rows", async () => {
  const supabase = {
    from(table: string) {
      return {
        select(columns: string) {
          if (table === "user_tricks" && columns === "user_id") {
            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
            };
          }

          throw new Error("No score query should run when there are no affected users");
        },
      };
    },
  };

  await recalculateScoresForTrick("trick-2", supabase as never);
});
