import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateProgressScore } from "./calculate-score";
import type { Database } from "./database.types";

export interface AffectedUserScore {
  userId: string;
  score: number;
}

async function listAffectedUserIds(trickId: string, supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_tricks")
    .select("user_id")
    .eq("trick_id", trickId)
    .eq("status", "finished");

  if (error) {
    throw new Error(`Failed to load affected users: ${error.message}`);
  }

  const uniqueUserIds = new Set<string>();
  for (const row of data) {
    if (typeof row.user_id === "string" && row.user_id.length > 0) {
      uniqueUserIds.add(row.user_id);
    }
  }

  return [...uniqueUserIds];
}

export async function getRecalculatedScoresForTrick(
  trickId: string,
  supabase: SupabaseClient<Database>,
): Promise<AffectedUserScore[]> {
  const userIds = await listAffectedUserIds(trickId, supabase);

  const scores = await Promise.all(
    userIds.map(async (userId) => ({
      userId,
      score: await calculateProgressScore(supabase, userId),
    })),
  );

  return scores;
}

export async function recalculateScoresForTrick(trickId: string, supabase: SupabaseClient<Database>): Promise<void> {
  await getRecalculatedScoresForTrick(trickId, supabase);
}
