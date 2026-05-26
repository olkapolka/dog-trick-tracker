import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const username = url.searchParams.get("username");

  if (!username) {
    return new Response(null, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  const { data } = await supabase.from("profiles").select("login_name").eq("login_name", username).single();

  if (data) {
    return new Response(null, { status: 409 }); // Username taken
  }

  return new Response(null, { status: 200 }); // Username available
};
