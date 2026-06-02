import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CircleAlert, Pencil, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/auth/FormField";
import { generateSlug } from "@/lib/slugify";
import { validateTrickInput } from "@/lib/validate-trick";
import type { Enums, Tables } from "@/lib/database.types";

type Trick = Tables<"tricks">;

interface TrickFormValues {
  name: string;
  slug: string;
  difficulty: Enums<"difficulty_level">;
  description: string;
}

interface TrickFormModalProps {
  mode: "create" | "edit";
  trick?: Trick;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

interface ApiErrorResponse {
  error?: string;
  errors?: Record<string, string>;
}

const DEFAULT_VALUES: TrickFormValues = {
  name: "",
  slug: "",
  difficulty: "beginner",
  description: "",
};

function mapTrickToValues(trick?: Trick): TrickFormValues {
  if (!trick) {
    return { ...DEFAULT_VALUES };
  }

  return {
    name: trick.name,
    slug: trick.slug,
    difficulty: trick.difficulty,
    description: trick.description,
  };
}

export default function TrickFormModal({ mode, trick, open, onOpenChange, onSuccess }: TrickFormModalProps) {
  const [values, setValues] = useState<TrickFormValues>(mapTrickToValues(trick));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = mode === "create" ? "Create trick" : "Edit trick";

  const resetFormState = () => {
    setValues(mapTrickToValues(trick));
    setErrors({});
    setSlugTouched(mode === "edit");
    setCheckingSlug(false);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetFormState();
    }
    onOpenChange(nextOpen);
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const updateField = <K extends keyof TrickFormValues>(field: K, value: TrickFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const handleNameChange = (name: string) => {
    setValues((prev) => {
      const next: TrickFormValues = { ...prev, name };

      if (mode === "create" && !slugTouched) {
        next.slug = generateSlug(name);
      }

      return next;
    });

    clearError("name");
    if (mode === "create" && !slugTouched) {
      clearError("slug");
    }
  };

  const validate = () => {
    const nextErrors = validateTrickInput(values);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const checkSlugAvailability = async () => {
    const slug = values.slug.trim();

    if (!slug) {
      return;
    }

    if (mode === "edit" && slug === trick?.slug) {
      return;
    }

    if (errors.slug) {
      return;
    }

    setCheckingSlug(true);

    try {
      const response = await fetch(`/api/admin/tricks/check-slug?slug=${encodeURIComponent(slug)}`);
      if (response.status === 409) {
        setErrors((prev) => ({ ...prev, slug: "Slug already exists" }));
      }
    } catch {
      toast.error("Could not validate slug availability right now.");
    } finally {
      setCheckingSlug(false);
    }
  };

  const submit = async () => {
    if (!validate()) {
      toast.error("Please fix form errors before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = mode === "create" ? "/api/admin/tricks/create" : "/api/admin/tricks/update";
      const payload =
        mode === "create"
          ? values
          : {
              id: trick?.id,
              ...values,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const parsed = (await response.json().catch(() => ({}))) as ApiErrorResponse;

        if (parsed.errors && Object.keys(parsed.errors).length > 0) {
          setErrors(parsed.errors);
        }

        toast.error(parsed.error ?? "Request failed");
        return;
      }

      toast.success(mode === "create" ? "Trick created." : "Trick updated.");
      await onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-x-4 top-4 bottom-4 overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6 shadow-2xl focus:outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-8"
          aria-labelledby="admin-trick-form-title"
          aria-describedby="admin-trick-form-description"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title id="admin-trick-form-title" className="text-2xl font-bold text-white">
                {title}
              </Dialog.Title>
              <Dialog.Description id="admin-trick-form-description" className="mt-1 text-sm text-blue-100/70">
                {mode === "create"
                  ? "Create a new trick for the catalog."
                  : "Update trick details and difficulty for the catalog."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:ring-2 focus:ring-purple-400/50 focus:outline-none"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            noValidate
          >
            <FormField
              id="name"
              label="Name"
              value={values.name}
              onChange={handleNameChange}
              placeholder="High Five"
              error={errors.name}
              icon={mode === "create" ? <Plus className="size-4" /> : <Pencil className="size-4" />}
            />

            <FormField
              id="slug"
              label="Slug"
              value={values.slug}
              onChange={(nextValue) => {
                setSlugTouched(true);
                updateField("slug", generateSlug(nextValue));
              }}
              onBlur={() => {
                void checkSlugAvailability();
              }}
              placeholder="high-five"
              error={errors.slug}
              icon={<Sparkles className="size-4" />}
              hint={
                checkingSlug ? (
                  <p className="mt-1 text-xs text-blue-100/50">Checking slug availability...</p>
                ) : undefined
              }
            />

            <div>
              <label htmlFor="difficulty" className="mb-1 block text-sm text-blue-100/80">
                Difficulty
              </label>
              <select
                id="difficulty"
                value={values.difficulty}
                onChange={(event) => {
                  updateField("difficulty", event.target.value as Enums<"difficulty_level">);
                }}
                className={`w-full rounded-lg border bg-white/10 px-3 py-2 text-white focus:ring-2 focus:outline-none ${errors.difficulty ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400"}`}
              >
                <option value="beginner" className="bg-slate-900 text-white">
                  Beginner
                </option>
                <option value="intermediate" className="bg-slate-900 text-white">
                  Intermediate
                </option>
                <option value="advanced" className="bg-slate-900 text-white">
                  Advanced
                </option>
              </select>
              {errors.difficulty ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
                  <CircleAlert className="size-3" />
                  {errors.difficulty}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm text-blue-100/80">
                Description
              </label>
              <textarea
                id="description"
                value={values.description}
                onChange={(event) => {
                  updateField("description", event.target.value);
                }}
                rows={8}
                className={`w-full rounded-lg border bg-white/10 px-3 py-2 text-white placeholder:text-white/40 focus:ring-2 focus:outline-none ${errors.description ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400"}`}
                placeholder="Step-by-step training instructions for this trick..."
              />
              <div className="mt-1 flex items-center justify-between text-xs text-blue-100/60">
                <span>{errors.description || "Use clear, step-by-step instructions."}</span>
                <span>{values.description.trim().length} chars</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-purple-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? mode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : mode === "create"
                    ? "Create"
                    : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
