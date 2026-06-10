import type { APIRoute } from "astro";
import { buildUnfollowFilter } from "@/lib/ownership-contracts";
import { createClient } from "@/lib/supabase";

export const DELETE: APIRoute = async (context) => {
  const { user } = context.locals;

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (!supabase) {
    return new Response(JSON.stringify({ error: "Failed to create Supabase client" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await context.request.json()) as { followingId?: string };
    const { followingId } = body;

    if (!followingId) {
      return new Response(JSON.stringify({ error: "Missing followingId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Delete follow relationship (idempotent - no error if relationship doesn't exist)
    const filter = buildUnfollowFilter(user.id, followingId);

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", filter.followerId)
      .eq("following_id", filter.followingId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // eslint-disable-next-line no-console -- unexpected server error must be surfaced for ops
    console.error("Unhandled error in DELETE /api/unfollow", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
