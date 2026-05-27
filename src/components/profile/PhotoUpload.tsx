import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PhotoUploadProps {
  value: string | null;
}

export function PhotoUpload({ value }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(value);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError("");

    // Client-side validation
    if (selectedFile.size > 2 * 1024 * 1024) {
      setError("Photo must be under 2MB");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)) {
      setError("Only JPG, PNG, and WebP allowed");
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleUpload = async () => {
    if (uploading) return; // Prevent concurrent uploads
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/profile/upload-photo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Upload failed");
      }

      await response.json();
      toast.success("Photo uploaded successfully!");

      // Reload page to show updated photo
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        {preview ? (
          <img
            src={preview}
            alt="Dog photo preview"
            className="size-32 rounded-full object-cover ring-4 ring-purple-400/20"
          />
        ) : (
          <div className="flex size-32 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-blue-400 text-4xl font-bold text-white ring-4 ring-purple-400/20">
            ?
          </div>
        )}

        <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-blue-100 transition-colors hover:bg-white/20">
          <span>Choose Photo</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
        </label>

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 font-medium text-white transition-all hover:from-purple-600 hover:to-blue-600 focus:ring-2 focus:ring-purple-400/50 focus:outline-none disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Photo"}
          </button>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
