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

  // Server-side validation
  const validationErrors: string[] = [];

  // Validate loginName
  if (!loginName.trim()) {
    validationErrors.push("Username is required");
  } else if (loginName.length < 3 || loginName.length > 20) {
    validationErrors.push("Username must be 3-20 characters");
  } else if (!/^[a-z][a-z0-9-]{2,19}$/.test(loginName)) {
    validationErrors.push("Invalid username format");
  } else if (RESERVED_USERNAMES.includes(loginName.toLowerCase())) {
    validationErrors.push("Username reserved by the system");
  }

  // Validate dogName
  if (!dogName.trim()) {
    validationErrors.push("Dog name is required");
  } else if (dogName.length > 50) {
    validationErrors.push("Dog name too long");
  }

  // Validate breed
  if (!breed.trim()) {
    validationErrors.push("Breed is required");
  }

  // Validate dateOfBirth
  if (!dateOfBirth) {
    validationErrors.push("Date of birth is required");
  } else {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()) || dob > new Date()) {
      validationErrors.push("Invalid date of birth");
    }
  }

  // Validate sex
  if (sex !== "Male" && sex !== "Female") {
    validationErrors.push("Sex must be Male or Female");
  }

  if (validationErrors.length > 0) {
    return context.redirect(`/profile/create?error=${encodeURIComponent(validationErrors.join("; "))}`);
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
