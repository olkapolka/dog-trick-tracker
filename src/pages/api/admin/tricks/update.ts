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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface UpdateTrickInput {
  id?: string;
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
    const body = (await context.request.json()) as UpdateTrickInput;
    const trickId = body.id?.trim();

    if (!trickId || !UUID_PATTERN.test(trickId)) {
      return new Response(JSON.stringify({ error: "Invalid trick id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: currentTrick, error: currentError } = await supabase
      .from("tricks")
      .select("id, name, slug, difficulty, description")
      .eq("id", trickId)
      .single();

    if (currentError) {
      return new Response(JSON.stringify({ error: "Trick not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const mergedInput = {
      name: body.name?.trim() ?? currentTrick.name,
      slug: body.slug?.trim() ?? currentTrick.slug,
      difficulty: body.difficulty?.trim() ?? currentTrick.difficulty,
      description: body.description?.trim() ?? currentTrick.description,
    };

    const errors = validateTrickInput(mergedInput);
    if (Object.keys(errors).length > 0) {
      return new Response(JSON.stringify({ error: "Validation failed", errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const difficulty = mergedInput.difficulty as Enums<"difficulty_level">;

    const { data: updatedTrick, error: updateError } = await supabase
      .from("tricks")
      .update({
        name: mergedInput.name,
        slug: mergedInput.slug,
        difficulty,
        difficulty_weight: DIFFICULTY_WEIGHT[difficulty],
        description: mergedInput.description,
      })
      .eq("id", trickId)
      .select("id, name, slug, difficulty, difficulty_weight, description, created_at, deleted_at")
      .single();

    if (updateError) {
      if (updateError.code === "23505") {
        return new Response(JSON.stringify({ error: "Slug already exists" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        trick: updatedTrick,
        difficultyChanged: currentTrick.difficulty !== difficulty,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
