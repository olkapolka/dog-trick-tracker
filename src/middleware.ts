import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/friends",
  "/admin",
  "/api/profile",
  "/api/admin",
  "/api/tricks",
  "/api/follow",
  "/api/unfollow",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }

    // Skip profile check for profile creation flows
    const isProfileCreationFlow =
      context.url.pathname.startsWith("/profile/create") ||
      context.url.pathname.startsWith("/api/profile/create") ||
      context.url.pathname.startsWith("/api/profile/check-username");

    // Check if authenticated user has a profile (except during profile creation)
    if (supabase && !isProfileCreationFlow) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", context.locals.user.id)
        .single();

      if (!profile) {
        return context.redirect("/profile/create");
      }
    }
  }

  return next();
});
