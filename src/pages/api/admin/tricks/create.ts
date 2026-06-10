import type { APIRoute } from "astro";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase";
import { validateTrickInput } from "@/lib/validate-trick";
import type { Enums } from "@/lib/database.types";

const DIFFICULTY_WEIGHT: Record<Enums<"difficulty_level">, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

interface CreateTrickInput {
  name?: string;
  slug?: string;
  difficulty?: string;
  description?: string;
}

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

  try {
    const body = (await context.request.json()) as CreateTrickInput;

    const payload = {
      name: body.name?.trim(),
      slug: body.slug?.trim(),
      difficulty: body.difficulty?.trim(),
      description: body.description?.trim(),
    };

    const errors = validateTrickInput(payload);
    if (Object.keys(errors).length > 0) {
      return new Response(JSON.stringify({ error: "Validation failed", errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { name, slug, description } = payload;
    if (name === undefined || slug === undefined || description === undefined) {
      return new Response(JSON.stringify({ error: "Validation failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const difficulty = payload.difficulty as Enums<"difficulty_level">;

    const { data, error } = await supabase
      .from("tricks")
      .insert({
        name,
        slug,
        difficulty,
        difficulty_weight: DIFFICULTY_WEIGHT[difficulty],
        description,
      })
      .select("id, name, slug, difficulty, difficulty_weight, description, created_at, deleted_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return new Response(JSON.stringify({ error: "Slug already exists" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, trick: data }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // eslint-disable-next-line no-console -- unexpected server error must be surfaced for ops
    console.error("Unhandled error in POST /api/admin/tricks/create", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
