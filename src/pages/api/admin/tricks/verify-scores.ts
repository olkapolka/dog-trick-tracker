import type { APIRoute } from "astro";
import { isAdmin } from "@/lib/admin";
import { getRecalculatedScoresForTrick } from "@/lib/recalculate-user-scores";
import { createClient } from "@/lib/supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
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

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || authUser?.id !== user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = await isAdmin(user.id, supabase);
  if (!admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(context.request.url);
  const trickId = (url.searchParams.get("trickId") ?? "").trim();

  if (!trickId || !UUID_PATTERN.test(trickId)) {
    return new Response(JSON.stringify({ error: "Invalid trickId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const affectedUsers = await getRecalculatedScoresForTrick(trickId, supabase);

    return new Response(
      JSON.stringify({
        trickId,
        affectedCount: affectedUsers.length,
        affectedUsers,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
