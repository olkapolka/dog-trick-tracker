import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function isAdmin(userId: string, supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("is_admin").eq("user_id", userId).maybeSingle();

  if (error) {
    return false;
  }

  return data?.is_admin === true;
}
