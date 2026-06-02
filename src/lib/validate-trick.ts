interface TrickInput {
  name?: string;
  slug?: string;
  difficulty?: string;
  description?: string;
}

const TRICK_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateTrickInput(input: TrickInput): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = input.name?.trim() ?? "";
  if (!name) {
    errors.name = "Name is required";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer";
  }

  const slug = input.slug?.trim() ?? "";
  if (!slug) {
    errors.slug = "Slug is required";
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = "Slug must be lowercase letters, numbers, and hyphens only";
  }

  const difficulty = input.difficulty?.trim() ?? "";
  if (!difficulty) {
    errors.difficulty = "Difficulty is required";
  } else if (!TRICK_DIFFICULTIES.has(difficulty)) {
    errors.difficulty = "Difficulty must be beginner, intermediate, or advanced";
  }

  const description = input.description?.trim() ?? "";
  if (!description) {
    errors.description = "Description is required";
  } else if (description.length < 20) {
    errors.description = "Description must be at least 20 characters";
  }

  return errors;
}
