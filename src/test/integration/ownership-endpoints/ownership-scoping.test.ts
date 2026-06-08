import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFollowInsert,
  buildProfilePhotoUpdateFilter,
  buildTrickStatusUpsert,
  buildUnfollowFilter,
} from "@/lib/ownership-contracts";

const ACTOR_A = "11111111-1111-4111-8111-111111111111";
const ACTOR_B = "22222222-2222-4222-8222-222222222222";
const TARGET = "33333333-3333-4333-8333-333333333333";
const TRICK = "44444444-4444-4444-8444-444444444444";

void test("follow payload always scopes follower_id to authenticated actor", () => {
  const actorA = buildFollowInsert(ACTOR_A, TARGET);
  const actorB = buildFollowInsert(ACTOR_B, TARGET);

  assert.equal(actorA.follower_id, ACTOR_A);
  assert.equal(actorA.following_id, TARGET);
  assert.equal(actorB.follower_id, ACTOR_B);
  assert.notEqual(actorA.follower_id, actorB.follower_id);
});

void test("unfollow filter is idempotent and actor-scoped", () => {
  const filter = buildUnfollowFilter(ACTOR_A, TARGET);

  assert.equal(filter.followerId, ACTOR_A);
  assert.equal(filter.followingId, TARGET);
});

void test("trick status upsert payload ignores target actor and pins actor ownership", () => {
  const fixedNow = "2026-06-08T00:00:00.000Z";
  const payload = buildTrickStatusUpsert(ACTOR_A, TRICK, "finished", fixedNow);

  assert.deepEqual(payload, {
    user_id: ACTOR_A,
    trick_id: TRICK,
    status: "finished",
    updated_at: fixedNow,
  });
});

void test("profile update filter scopes write to authenticated actor", () => {
  const actorA = buildProfilePhotoUpdateFilter(ACTOR_A);
  const actorB = buildProfilePhotoUpdateFilter(ACTOR_B);

  assert.equal(actorA.userId, ACTOR_A);
  assert.equal(actorB.userId, ACTOR_B);
  assert.notEqual(actorA.userId, actorB.userId);
});
