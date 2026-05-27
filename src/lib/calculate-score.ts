import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type UserTrickWithWeight = {
  tricks: {
    difficulty_weight: number;
  } | null;
};

export async function calculateProgressScore(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const { data } = await supabase
    .from("user_tricks")
    .select("tricks(difficulty_weight)")
    .eq("user_id", userId)
    .eq("status", "finished");

  return (
    (data as UserTrickWithWeight[] | null)?.reduce((sum, row) => {
      const weight = row.tricks?.difficulty_weight;
      return sum + (typeof weight === "number" ? weight : 0);
    }, 0) ?? 0
  );
}
