import type { APIRoute } from "astro";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  const slug = (url.searchParams.get("slug") ?? "").trim();

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return new Response(JSON.stringify({ available: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase.from("tricks").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (data) {
    return new Response(JSON.stringify({ available: false }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ available: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
