import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const RESERVED_USERNAMES = ["dashboard", "profile", "api", "auth", "tricks", "admin"];

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const loginName = form.get("login_name") as string;
  const dogName = form.get("dog_name") as string;
  const breed = form.get("breed") as string;
  const dateOfBirth = form.get("date_of_birth") as string;
  const sex = form.get("sex") as string;

  // Server-side reserved username validation
  if (RESERVED_USERNAMES.includes(loginName.toLowerCase())) {
    return context.redirect(`/profile/create?error=${encodeURIComponent("Username reserved by the system")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/profile/create?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.from("profiles").insert({
    user_id: user.id,
    login_name: loginName,
    dog_name: dogName,
    breed,
    date_of_birth: dateOfBirth,
    sex,
    photo_url: null, // Photo added in Phase 3
  });

  if (error) {
    // Check for unique violation (duplicate username)
    if (error.code === "23505") {
      return context.redirect(`/profile/create?error=${encodeURIComponent("Username already taken")}`);
    }
    return context.redirect(`/profile/create?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
