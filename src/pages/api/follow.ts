import type { APIRoute } from "astro";
import { buildFollowInsert } from "@/lib/ownership-contracts";
import { createClient } from "@/lib/supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async (context) => {
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

    if (!UUID_PATTERN.test(followingId)) {
      return new Response(JSON.stringify({ error: "Invalid followingId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prevent self-follow at application level (also enforced by DB CHECK constraint)
    if (followingId === user.id) {
      return new Response(JSON.stringify({ error: "Cannot follow yourself" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify target user exists by checking profiles table
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", followingId)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Insert follow relationship
    const { error } = await supabase.from("follows").insert(buildFollowInsert(user.id, followingId));

    if (error) {
      // Check for duplicate follow (composite PK violation)
      if (error.code === "23505") {
        return new Response(JSON.stringify({ error: "Already following this user" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Check constraint violation (self-follow)
      if (error.code === "23514") {
        return new Response(JSON.stringify({ error: "Cannot follow yourself" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
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
    console.error("Unhandled error in POST /api/follow", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
