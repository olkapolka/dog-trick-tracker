import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const followsPolicySql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260531000001_create_follows_table.sql"),
  "utf8",
);

const userTricksPolicySql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260526132227_create_user_tricks_table.sql"),
  "utf8",
);

void test("follows table write policies enforce actor-owned writes", () => {
  assert.match(
    followsPolicySql,
    /CREATE POLICY\s+"Users can follow others"[\s\S]*WITH CHECK \(auth\.uid\(\) = follower_id\)/,
  );

  assert.match(followsPolicySql, /CREATE POLICY\s+"Users can unfollow"[\s\S]*USING \(auth\.uid\(\) = follower_id\)/);
});

void test("user_tricks table write policies enforce actor-owned writes", () => {
  assert.match(
    userTricksPolicySql,
    /CREATE POLICY\s+"Users can create own trick progress"[\s\S]*WITH CHECK \(auth\.uid\(\) = user_id\)/,
  );

  assert.match(
    userTricksPolicySql,
    /CREATE POLICY\s+"Users can update own trick progress"[\s\S]*USING \(auth\.uid\(\) = user_id\)/,
  );
});
