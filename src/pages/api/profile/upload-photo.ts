import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Failed to initialize Supabase client" }), { status: 500 });
  }

  try {
    const formData = await context.request.formData();
    const file = formData.get("photo") as File;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- FormData.get can return null
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }

    // Verify profile exists first
    const { error: profileError } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

    if (profileError) {
      return new Response(JSON.stringify({ error: "Profile not found. Create profile first." }), { status: 404 });
    }

    // Validate file type
    const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return new Response(JSON.stringify({ error: "Invalid file extension. Allowed: jpg, jpeg, png, webp" }), {
        status: 400,
      });
    }

    if (!allowedMimeTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: "Invalid file type. Only images are allowed." }), { status: 400 });
    }

    // Validate file size (2MB limit)
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File too large. Maximum size is 2MB." }), { status: 400 });
    }

    // Upload to Storage
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage.from("dog-photos").upload(fileName, file, { contentType: file.type });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("dog-photos").getPublicUrl(fileName);

    // Update profile row with photo URL
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ photo_url: publicUrl })
      .eq("user_id", user.id);

    if (updateError) {
      // Cleanup: delete uploaded file since profile update failed
      void supabase.storage.from("dog-photos").remove([fileName]);

      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
