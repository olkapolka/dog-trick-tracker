import type { Enums } from "@/lib/database.types";

interface FollowInsert {
  follower_id: string;
  following_id: string;
}

interface FollowDeleteFilter {
  followerId: string;
  followingId: string;
}

interface TrickStatusUpsert {
  user_id: string;
  trick_id: string;
  status: Enums<"trick_status">;
  updated_at: string;
}

interface ProfileUpdateFilter {
  userId: string;
}

export function buildFollowInsert(actorId: string, followingId: string): FollowInsert {
  return {
    follower_id: actorId,
    following_id: followingId,
  };
}

export function buildUnfollowFilter(actorId: string, followingId: string): FollowDeleteFilter {
  return {
    followerId: actorId,
    followingId,
  };
}

export function buildTrickStatusUpsert(
  actorId: string,
  trickId: string,
  status: Enums<"trick_status">,
  nowIso = new Date().toISOString(),
): TrickStatusUpsert {
  return {
    user_id: actorId,
    trick_id: trickId,
    status,
    updated_at: nowIso,
  };
}

export function buildProfilePhotoUpdateFilter(actorId: string): ProfileUpdateFilter {
  return {
    userId: actorId,
  };
}
