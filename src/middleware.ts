import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import {
  isProfileCreationFlow,
  isProtectedPath,
  shouldRedirectToProfileCreate,
  shouldRedirectToSignIn,
} from "@/lib/auth-contracts";

interface MinimalUser {
  id: string;
}

interface MiddlewareSupabaseLike {
  auth: {
    getUser: () => PromiseLike<{ data: { user: MinimalUser | null } }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        single: () => PromiseLike<{ data: { id: string } | null }>;
      };
    };
  };
}

interface MiddlewareContextLike {
  url: URL;
  locals: {
    user?: MinimalUser | null;
  };
  redirect: (path: string, status?: 300 | 301 | 302 | 303 | 304 | 307 | 308) => Response;
}

function withNoStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function applyAccessGuards(
  context: MiddlewareContextLike,
  supabase: MiddlewareSupabaseLike | null,
): Promise<Response | null> {
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  const pathname = context.url.pathname;

  if (!isProtectedPath(pathname)) {
    return null;
  }

  if (shouldRedirectToSignIn(pathname, Boolean(context.locals.user))) {
    return context.redirect("/auth/signin");
  }

  const user = context.locals.user;

  if (supabase && user && !isProfileCreationFlow(pathname)) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

    if (shouldRedirectToProfileCreate(pathname, true, Boolean(profile))) {
      return context.redirect("/profile/create");
    }
  }

  return null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
  const guardClient: MiddlewareSupabaseLike | null = supabase
    ? {
        auth: {
          getUser: () => supabase.auth.getUser(),
        },
        from: (table) => supabase.from(table),
      }
    : null;

  const guardResponse = await applyAccessGuards(context, guardClient);
  if (guardResponse) {
    return withNoStore(guardResponse);
  }

  const response = await next();
  if (isProtectedPath(context.url.pathname)) {
    return withNoStore(response);
  }

  return response;
});
