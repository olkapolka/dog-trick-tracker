import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { calculateProgressScore } from "@/lib/calculate-score";

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

  const score = await calculateProgressScore(supabase, user.id);

  return new Response(JSON.stringify({ score }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
