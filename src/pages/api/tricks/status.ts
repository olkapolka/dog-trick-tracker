import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

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
    const body = (await context.request.json()) as { trickId?: string; status?: string };
    const { trickId, status } = body;

    if (!trickId || !status) {
      return new Response(JSON.stringify({ error: "Missing trickId or status" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate status value
    const validStatuses = ["favorite", "in-progress", "finished"];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status value" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upsert user_tricks row
    const { error } = await supabase.from("user_tricks").upsert(
      {
        user_id: user.id,
        trick_id: trickId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,trick_id" },
    );

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
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
