import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

interface UserTrickWithWeight {
  tricks: {
    difficulty_weight: number;
  } | null;
}

export type ProgressScoreResult =
  | {
      ok: true;
      score: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function calculateProgressScoreResult(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProgressScoreResult> {
  const { data, error } = await supabase
    .from("user_tricks")
    .select("tricks(difficulty_weight)")
    .eq("user_id", userId)
    .eq("status", "finished");

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  const score =
    (data as UserTrickWithWeight[] | null)?.reduce((sum, row) => {
      const weight = row.tricks?.difficulty_weight;
      return sum + (typeof weight === "number" ? weight : 0);
    }, 0) ?? 0;

  return {
    ok: true,
    score,
  };
}

export async function calculateProgressScore(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const result = await calculateProgressScoreResult(supabase, userId);
  return result.ok ? result.score : 0;
}
