import type { APIRoute } from "astro";
import { resolveSignInRedirect } from "@/lib/auth-contracts";
import { createClient } from "@/lib/supabase";

type CreateClientLike = typeof createClient;

export function createSignInHandler(getClient: CreateClientLike = createClient): APIRoute {
  return async (context) => {
    const form = await context.request.formData();
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const returnTo = form.get("returnTo") as string | null;

    const supabase = getClient(context.request.headers, context.cookies);
    if (!supabase) {
      return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
    }

    // Check if profile exists before redirecting
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", data.user.id).single();

    return context.redirect(resolveSignInRedirect(Boolean(profile), returnTo));
  };
}

export const POST = createSignInHandler();
