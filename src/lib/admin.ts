import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AdminCheckResult =
  | {
      ok: true;
      isAdmin: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export async function getAdminCheckResult(
  userId: string,
  supabase: SupabaseClient<Database>,
): Promise<AdminCheckResult> {
  const { data, error } = await supabase.from("profiles").select("is_admin").eq("user_id", userId).maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    isAdmin: data?.is_admin === true,
  };
}

export async function isAdmin(userId: string, supabase: SupabaseClient<Database>): Promise<boolean> {
  const result = await getAdminCheckResult(userId, supabase);
  return result.ok && result.isAdmin;
}
