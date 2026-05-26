import React, { useState } from "react";
import { User, Dog, Calendar, Users } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { DOG_BREEDS } from "@/lib/breeds";

const RESERVED_USERNAMES = ["dashboard", "profile", "api", "auth", "tricks", "admin"];

interface Props {
  serverError?: string | null;
}

export default function CreateProfileForm({ serverError }: Props) {
  const [loginName, setLoginName] = useState("");
  const [dogName, setDogName] = useState("");
  const [breed, setBreed] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<"Male" | "Female" | "">("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [errors, setErrors] = useState<{
    loginName?: string;
    dogName?: string;
    breed?: string;
    dateOfBirth?: string;
    sex?: string;
  }>({});

  function validateLoginName(username: string): string | undefined {
    if (!username.trim()) {
      return "Username is required";
    }
    if (username.length < 3 || username.length > 20) {
      return "Username must be 3-20 characters";
    }
    if (!/^[a-z][a-z0-9-]{2,19}$/.test(username)) {
      return "Username must start with a letter, lowercase only, letters/numbers/hyphens allowed";
    }
    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      return "Username reserved by the system";
    }
    return undefined;
  }

  async function checkUsernameAvailable(username: string): Promise<boolean> {
    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      return false;
    }

    try {
      const res = await fetch(`/api/profile/check-username?username=${encodeURIComponent(username)}`);
      return res.ok;
    } catch {
      return true; // Assume available on network error, server will validate
    }
  }

  async function handleUsernameBlur() {
    const validationError = validateLoginName(loginName);
    if (validationError) {
      setUsernameAvailable(null);
      setErrors((prev) => ({ ...prev, loginName: validationError }));
      return;
    }

    setCheckingUsername(true);
    const available = await checkUsernameAvailable(loginName);
    setUsernameAvailable(available);
    setCheckingUsername(false);

    if (!available) {
      setErrors((prev) => ({ ...prev, loginName: "Username taken" }));
    }
  }

  function validate() {
    const next: typeof errors = {};

    const loginNameError = validateLoginName(loginName);
    if (loginNameError) {
      next.loginName = loginNameError;
    } else if (usernameAvailable === false) {
      next.loginName = "Username taken";
    }

    if (!dogName.trim()) {
      next.dogName = "Dog name is required";
    }

    if (!breed) {
      next.breed = "Please select a breed";
    }

    if (!dateOfBirth) {
      next.dateOfBirth = "Date of birth is required";
    } else {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      if (dob > today) {
        next.dateOfBirth = "Date of birth cannot be in the future";
      }
    }

    if (!sex) {
      next.sex = "Please select a sex";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const maxDate = new Date().toISOString().split("T")[0];

  return (
    <form method="POST" action="/api/profile/create" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="login_name"
        type="text"
        label="Username"
        value={loginName}
        onChange={(v) => {
          setLoginName(v.toLowerCase());
          clearError("loginName");
          setUsernameAvailable(null);
        }}
        onBlur={handleUsernameBlur}
        placeholder="my-awesome-dog"
        error={errors.loginName}
        icon={<User className="size-4" />}
        hint={
          checkingUsername ? (
            <p className="mt-1 text-xs text-blue-100/50">Checking availability...</p>
          ) : usernameAvailable === true ? (
            <p className="mt-1 text-xs text-green-400">✓ Username available</p>
          ) : undefined
        }
      />

      <FormField
        id="dog_name"
        type="text"
        label="Dog Name"
        value={dogName}
        onChange={(v) => {
          setDogName(v);
          clearError("dogName");
        }}
        placeholder="Max"
        error={errors.dogName}
        icon={<Dog className="size-4" />}
      />

      <div className="space-y-2">
        <label htmlFor="breed" className="block text-sm font-medium text-blue-100">
          Breed
        </label>
        <div className="relative">
          <Users className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-blue-100/50" />
          <select
            id="breed"
            name="breed"
            value={breed}
            onChange={(e) => {
              setBreed(e.target.value);
              clearError("breed");
            }}
            className={`w-full rounded-lg border bg-white/5 px-10 py-2.5 text-blue-100 backdrop-blur transition-all placeholder:text-blue-100/40 hover:bg-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none ${
              errors.breed ? "border-red-400" : "border-white/10"
            }`}
          >
            <option value="">Select a breed</option>
            {DOG_BREEDS.map((b) => (
              <option key={b} value={b} className="bg-slate-800 text-white">
                {b}
              </option>
            ))}
          </select>
        </div>
        {errors.breed && <p className="mt-1 text-xs text-red-400">{errors.breed}</p>}
      </div>

      <FormField
        id="date_of_birth"
        type="date"
        label="Date of Birth"
        value={dateOfBirth}
        onChange={(v) => {
          setDateOfBirth(v);
          clearError("dateOfBirth");
        }}
        error={errors.dateOfBirth}
        icon={<Calendar className="size-4" />}
        max={maxDate}
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-blue-100">Sex</label>
        <div className="flex gap-4">
          {["Male", "Female"].map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="sex"
                value={option}
                checked={sex === option}
                onChange={(e) => {
                  setSex(e.target.value as typeof sex);
                  clearError("sex");
                }}
                className="size-4 cursor-pointer border-white/10 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-400/20"
              />
              <span className="text-sm text-blue-100">{option}</span>
            </label>
          ))}
        </div>
        {errors.sex && <p className="mt-1 text-xs text-red-400">{errors.sex}</p>}
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Creating profile..." icon={<Dog className="size-4" />}>
        Create Profile
      </SubmitButton>
    </form>
  );
}
