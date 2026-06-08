import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

type CreateClientLike = typeof createClient;

function createNoStoreRedirect(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: path,
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export function createSignOutHandler(getClient: CreateClientLike = createClient): APIRoute {
  return async (context) => {
    const supabase = getClient(context.request.headers, context.cookies);
    if (supabase) {
      await supabase.auth.signOut();
    }
    return createNoStoreRedirect("/");
  };
}

export const POST = createSignOutHandler();

export const GET = createSignOutHandler();
