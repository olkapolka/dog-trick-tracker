import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function calculateProgressScore(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const { data } = await supabase
    .from("user_tricks")
    .select("tricks(difficulty_weight)")
    .eq("user_id", userId)
    .eq("status", "finished");

  return (
    data?.reduce((sum, row) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const weight = row.tricks?.difficulty_weight;
      return sum + (typeof weight === "number" ? weight : 0);
    }, 0) ?? 0
  );
}
