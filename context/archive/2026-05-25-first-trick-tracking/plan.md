# User Can Track Their First Trick — Implementation Plan

## Overview

Implement the north star feature enabling users to create a profile with dog info (unique username, dog name, breed, date of birth, sex, optional photo uploaded to Supabase Storage), browse a public trick catalog grouped by difficulty, view trick detail pages with step-by-step teaching instructions, mark trick status (favorite/in-progress/finished) with optimistic UI updates, and see their weighted progress score (finished tricks × difficulty weight) on their profile. Users can share their profile via `/user/username` URLs, and profiles are publicly viewable.

This plan is self-contained. Phase 0 creates the database schema (profiles, tricks, user_tricks tables) with difficulty weights (beginner=1, intermediate=2, advanced=3) and seeds 12 starter tricks.

## Current State Analysis

**What exists:**
- ✅ Astro v6 + React v19 + TypeScript v5 + Tailwind CSS v4
- ✅ Supabase auth (signup/signin/signout) fully working via email/password
- ✅ Middleware-based route protection (`PROTECTED_ROUTES` array in `src/middleware.ts`)
- ✅ Server-side session management via cookies (`Astro.locals.user`)
- ✅ Reusable auth components: `FormField`, `SubmitButton`, `PasswordToggle`, `ServerError`
- ✅ API route pattern: FormData extraction → Supabase query → redirect with `?error=` param
- ✅ Cosmic glass UI theme (backdrop-blur, white/10 overlays, gradient text)
- ✅ lucide-react icon library (Star, Clock, Check available for status buttons)
- ✅ Cloudflare Workers deployment + GitHub Actions CI/CD

**What's missing:**
- ❌ No profile management (users land on empty dashboard after signup)
- ❌ No trick browsing or detail pages
- ❌ No status tracking (user_tricks table is empty)
- ❌ No progress score calculation or display
- ❌ No public profile URLs or sharing
- ❌ No client-side data fetching (only server-side form POST)
- ❌ No toast/notification system
- ❌ No Supabase Storage setup (photos live nowhere yet)
- ❌ No TypeScript types generated from database schema
- ❌ No dynamic routes ([username].astro, tricks/[slug].astro)

**Codebase patterns to follow:**
- Form validation: Real-time error clearing + on-submit check (see `SignUpForm.tsx:23-43`)
- API routes: `await context.request.formData()` → `createClient()` → query → `context.redirect()` (see `src/pages/api/auth/signin.ts`)
- Error handling: Redirect with `?error=${encodeURIComponent(message)}`, display via `<ServerError>` component
- Server-side data fetch: `createClient(Astro.request.headers, Astro.cookies)` in `.astro` frontmatter
- Protected routes: Add paths to `PROTECTED_ROUTES` array in `src/middleware.ts:4`

## Desired End State

**User journey (north star validation):**
1. New user registers → immediately redirected to profile creation wizard
2. User fills form (unique username, dog name, breed from dropdown, date of birth, sex, uploads photo)
3. After saving, user lands on dashboard showing trick catalog grouped by difficulty (Beginner/Intermediate/Advanced cards)
4. User clicks trick card → sees detail page with step-by-step teaching description + status toggle buttons
5. User clicks status icon (Star/Clock/Check) → UI updates instantly (optimistic), API call in background saves to `user_tricks`
6. If API fails, status rolls back and toast error appears
7. User navigates to Profile → sees dog info, progress score (e.g., "12 points"), tricks organized by status
8. User clicks "Copy profile link" → clipboard receives `https://.../@ {username}` URL
9. Another user visits that URL → sees public profile with dog info and progress (no edit capabilities)

**Verification checklist:**
- [ ] After signup, user cannot reach dashboard without completing profile creation
- [ ] Profile creation enforces unique username (shows "Username taken" error if conflict)
- [ ] Photo uploads to Supabase Storage bucket `dog-photos` and URL saves to `profiles.photo_url`
- [ ] Catalog displays 10-15 tricks grouped by difficulty badges (⭐/⭐⭐/⭐⭐⭐)
- [ ] Clicking trick name navigates to `/tricks/{slug}` detail page
- [ ] Status toggle on catalog and detail page updates UI within 500ms (optimistic update)
- [ ] Progress score on profile page recalculates immediately when status changes to/from finished
- [ ] Public profile at `/user/username` displays correct user data; visiting `/user/nonexistent` shows 404
- [ ] Toast appears on mutation errors (network failure, permission denied, etc.)
- [ ] All pages responsive on mobile (touch targets ≥44px, readable text, no horizontal scroll)

## What We're NOT Doing

- **Following relationships** — Deferred to S-04 (FR-014, FR-015, FR-016). No follow button, no Friends tab, no follower list in this plan.
- **Shareable trick links** — Trick detail URLs work but no "share this trick" functionality. Users share profiles, not individual tricks.
- **Profile editing** — Profile creation only; editing dog info or username deferred to post-MVP. Users see "create once" disclaimer.
- **Admin trick management** — No CRUD for tricks in this plan; deferred to S-05 (FR-018-020).
- **Email confirmations** — Using developer-mode Supabase (confirmations disabled). Production setup handled separately.
- **Advanced photo features** — No cropping, filters, or multiple photos. Single photo upload with 2MB limit, jpg/png/webp only.
- **Pagination or search** — With 10-15 tricks, full catalog fits on one page. Filtering and search deferred to 100x scale.
- **Real-time updates** — No WebSocket, no live score updates when other users change status. Optimistic updates are client-only, not collaborative.
- **Accessibility audit** — Semantic HTML and keyboard navigation where possible, but no ARIA labels, screen reader testing, or WCAG certification in MVP.
- **Leaderboards or competition** — Per PRD Non-Goals, progress score is personal only. No public ranking or comparison.

## Implementation Approach

**Progressive enhancement strategy:**
- Auth flows remain server-side (form POST → redirect) matching existing pattern
- Trick status tracking adds client-side mutations via SWR for optimistic UX without breaking server-side fallback
- Catalog and detail pages are public (SEO-friendly, content marketing) but status toggles require auth

**Data flow:**
1. Profile creation: Client form → POST `/api/profile/create` → Supabase `profiles` insert → redirect
2. Photo upload: Client file picker → POST `/api/profile/upload-photo` → Supabase Storage → return public URL → save to `profiles.photo_url`
3. Catalog display: Server-side fetch all tricks in `.astro` frontmatter → render grouped cards
4. Status mutation: Client click → SWR mutate (optimistic) → POST `/api/tricks/status` → Supabase `user_tricks` upsert → revalidate
5. Progress score: Calculated on-demand via query `SELECT SUM(tricks.difficulty_weight) FROM user_tricks JOIN tricks WHERE status='finished'`

**Dependency injection:**
- Assumes `profiles` table has: `id`, `user_id` (FK to auth.users), `login_name` (unique), `dog_name`, `breed`, `date_of_birth`, `sex`, `photo_url`
- Assumes `tricks` table has: `id`, `name`, `slug`, `difficulty` (beginner/intermediate/advanced), `difficulty_weight` (1/2/3), `description` (step-by-step text)
- Assumes `user_tricks` table has: `user_id`, `trick_id`, `status` (favorite/in-progress/finished), composite PK or unique constraint

## Phase 0: Database Schema Creation

### Overview

Create the database schema (profiles, tricks, user_tricks tables) and seed the starter trick catalog. This fulfills F-01 (database-schema) and F-02 (seed-trick-catalog) from the roadmap, making the plan fully self-contained.

### Changes Required:

#### 1. Create profiles table migration

**File**: `supabase/migrations/<timestamp>_create_profiles_table.sql` (new file)

**Intent**: Store dog profile data with unique login_name for public URLs.

**Contract**: SQL migration creating `profiles` table with RLS policies:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  login_name TEXT NOT NULL UNIQUE,
  dog_name TEXT NOT NULL,
  breed TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_login_name ON profiles(login_name);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);
```

#### 2. Create tricks table migration

**File**: `supabase/migrations/<timestamp>_create_tricks_table.sql` (new file)

**Intent**: Store trick catalog with difficulty levels (beginner/intermediate/advanced) and weighted scoring (1/2/3 points).

**Contract**: SQL migration creating `tricks` table with difficulty enum:
```sql
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TABLE tricks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  difficulty difficulty_level NOT NULL,
  difficulty_weight INTEGER NOT NULL CHECK (difficulty_weight IN (1, 2, 3)),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tricks_difficulty ON tricks(difficulty);
CREATE INDEX idx_tricks_slug ON tricks(slug);

ALTER TABLE tricks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tricks are publicly readable"
  ON tricks FOR SELECT
  USING (true);
```

#### 3. Create user_tricks table migration

**File**: `supabase/migrations/<timestamp>_create_user_tricks_table.sql` (new file)

**Intent**: Track which tricks each user has marked as favorite/in-progress/finished.

**Contract**: SQL migration creating junction table with status enum and RLS:
```sql
CREATE TYPE trick_status AS ENUM ('favorite', 'in-progress', 'finished');

CREATE TABLE user_tricks (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE NOT NULL,
  status trick_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, trick_id)
);

CREATE INDEX idx_user_tricks_user_id ON user_tricks(user_id);
CREATE INDEX idx_user_tricks_status ON user_tricks(status);

ALTER TABLE user_tricks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trick progress"
  ON user_tricks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trick progress"
  ON user_tricks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trick progress"
  ON user_tricks FOR UPDATE
  USING (auth.uid() = user_id);
```

#### 4. Seed starter tricks

**File**: `supabase/seed.sql` (new file)

**Intent**: Populate 12 starter tricks across three difficulty levels (4 beginner @ 1pt, 4 intermediate @ 2pt, 4 advanced @ 3pt).

**Contract**: SQL seed data with step-by-step teaching descriptions:
```sql
INSERT INTO tricks (name, slug, difficulty, difficulty_weight, description) VALUES
(
  'Sit',
  'sit',
  'beginner',
  1,
  'Step 1: Hold a treat close to your dog''s nose.\nStep 2: Move your hand up, allowing their head to follow and causing their bottom to lower.\nStep 3: Once in sitting position, say "Sit" and give the treat.\nStep 4: Practice daily, gradually reducing treat frequency.'
),
(
  'Stay',
  'stay',
  'beginner',
  1,
  'Step 1: Ask your dog to sit.\nStep 2: Open your palm in front of you and say "Stay".\nStep 3: Take a few steps back. If they stay, reward with treat.\nStep 4: Gradually increase distance and duration before rewarding.'
),
(
  'Shake',
  'shake',
  'beginner',
  1,
  'Step 1: Hold a treat in your closed fist at chest level.\nStep 2: Wait for your dog to paw at your hand.\nStep 3: When they lift their paw, say "Shake" and open your hand.\nStep 4: Reward and repeat until they offer paw on command.'
),
(
  'Lie Down',
  'lie-down',
  'beginner',
  1,
  'Step 1: Start with your dog in a sit position.\nStep 2: Hold a treat in your fist and move it to the ground.\nStep 3: Slide your hand along the ground to encourage lying down.\nStep 4: Once lying down, say "Down" and give the treat.'
),
(
  'Come',
  'come',
  'intermediate',
  2,
  'Step 1: Start in a distraction-free area with your dog on a leash.\nStep 2: Squat down and say "Come" in an excited, happy voice.\nStep 3: Gently pull the leash if needed, reward when they reach you.\nStep 4: Practice in increasingly distracting environments.'
),
(
  'Heel',
  'heel',
  'intermediate',
  2,
  'Step 1: Start with your dog on your left side.\nStep 2: Hold treats at your hip and start walking.\nStep 3: Reward your dog for staying close to your side.\nStep 4: Say "Heel" and practice in short sessions, gradually increasing duration.'
),
(
  'Roll Over',
  'roll-over',
  'intermediate',
  2,
  'Step 1: Start with your dog lying down.\nStep 2: Hold a treat near their nose and move it toward their shoulder.\nStep 3: As they roll onto their side, continue moving treat in a circle.\nStep 4: Once they complete the roll, say "Roll Over" and reward.'
),
(
  'Play Dead',
  'play-dead',
  'intermediate',
  2,
  'Step 1: Ask your dog to lie down.\nStep 2: Hold a treat and move it from their nose to their shoulder.\nStep 3: As they roll onto their side, say "Bang" or "Play Dead".\nStep 4: Reward and gradually increase how long they stay still.'
),
(
  'Spin',
  'spin',
  'advanced',
  3,
  'Step 1: Hold a treat near your dog''s nose.\nStep 2: Move your hand in a circle, luring them to follow.\nStep 3: Once they complete a full spin, say "Spin" and reward.\nStep 4: Practice both directions and add hand signal.'
),
(
  'Fetch',
  'fetch',
  'advanced',
  3,
  'Step 1: Choose a toy your dog loves.\nStep 2: Throw it a short distance and say "Fetch".\nStep 3: When they pick it up, call them back with "Come".\nStep 4: Trade the toy for a treat, then repeat. Gradually increase distance.'
),
(
  'Speak',
  'speak',
  'advanced',
  3,
  'Step 1: Wait for your dog to bark naturally.\nStep 2: Immediately say "Speak" and reward them.\nStep 3: After several repetitions, say "Speak" before they bark.\nStep 4: Practice in various situations, pairing command with barking trigger.'
),
(
  'High Five',
  'high-five',
  'advanced',
  3,
  'Step 1: Start with your dog knowing "Shake".\nStep 2: Hold your hand higher than usual.\nStep 3: When they raise their paw to your raised hand, say "High Five".\nStep 4: Reward contact with your palm. Practice raising hand gradually higher.'
);
```

#### 5. Generate TypeScript types from schema

**File**: `src/lib/database.types.ts` (new file)

**Intent**: Auto-generate TypeScript interfaces from the newly created database schema to ensure type safety in subsequent phases.

**Contract**: Run Supabase CLI command after migrations are applied:
```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

This generates interfaces for `profiles`, `tricks`, and `user_tricks` tables that match the schema created in steps 1-3.

### Success Criteria:

#### Automated Verification:

- Migrations run without errors (`npx supabase migration up`)
- TypeScript type generation succeeds (`npx supabase gen types typescript --local`)
- All tables exist in schema (`psql -c "\dt"` shows profiles, tricks, user_tricks)
- Seed data inserted successfully (query returns 12 tricks: 4 beginner, 4 intermediate, 4 advanced)

#### Manual Verification:

- Inspect `profiles` table structure — `login_name` is unique, `user_id` has FK constraint to auth.users
- Query `SELECT * FROM tricks ORDER BY difficulty, name` — verify difficulty_weight values (1/2/3)
- Query `SELECT difficulty, COUNT(*) FROM tricks GROUP BY difficulty` — returns 4 rows per level
- Attempt to insert `user_tricks` row as anonymous user → blocked by RLS (403 error)
- Attempt to query another user's tricks → blocked by RLS (empty result set)

---

## Phase 1: Foundation Setup & Dependencies

### Overview

Install client-side data fetching and toast notification libraries (SWR and sonner) and create the breed dropdown data source as a TypeScript constant. Database types were already generated in Phase 0 after schema creation.

### Changes Required:

#### 1. Install SWR and sonner

**File**: `package.json`

**Intent**: Add SWR (4KB, React hooks for data fetching) and sonner (toast notifications) to enable optimistic UI updates and error feedback.

**Contract**: Add to `dependencies`:
```json
"swr": "^2.2.5",
"sonner": "^1.5.0"
```

Run `npm install` after editing.

#### 2. Create breed dropdown constant

**File**: `src/lib/breeds.ts` (new file)

**Intent**: Provide a fixed list of ~50 common dog breeds for the profile creation dropdown. Hardcoded to avoid database overhead.

**Contract**: Export constant array of breed strings, alphabetically sorted:
```typescript
export const DOG_BREEDS = [
  "Australian Shepherd",
  "Beagle",
  "Border Collie",
  "Bulldog",
  "Chihuahua",
  "Dachshund",
  "German Shepherd",
  "Golden Retriever",
  "Labrador Retriever",
  "Poodle",
  "Rottweiler",
  "Siberian Husky",
  "Yorkshire Terrier",
  // ... expand to ~50 breeds
] as const;

export type DogBreed = typeof DOG_BREEDS[number];
```

### Success Criteria:

#### Automated Verification:

- `npm install` completes without errors
- `npm run typecheck` passes (no type errors)
- `src/lib/database.types.ts` exists and exports interfaces for `profiles`, `tricks`, `user_tricks`
- `src/lib/breeds.ts` exists and exports `DOG_BREEDS` array with ≥30 breeds

#### Manual Verification:

- Inspect `database.types.ts` — verify `profiles` table has `login_name`, `dog_name`, `breed`, `date_of_birth`, `sex`, `photo_url` columns
- Confirm `tricks` table has `slug`, `difficulty`, `difficulty_weight`, `description`
- Confirm `user_tricks` table has `user_id`, `trick_id`, `status`

---

## Phase 2: Profile Creation Flow

### Overview

Build the profile creation form (username, dog name, breed, DOB, sex), API route to insert into `profiles` table with username uniqueness validation, and redirect signup flow through the profile wizard before landing on dashboard.

**Photo upload is deferred to Phase 3** — profiles are created with `photo_url = null` initially, then photo upload (optional) updates the existing profile row. This prevents orphaned Storage files if profile creation fails.

**Note**: After Phase 2 completion, users will land on the current empty dashboard ("Welcome, email@example.com" placeholder) after creating profiles. Catalog implementation happens in Phase 4 — this intermediate state is expected when testing phases sequentially.

### Changes Required:

#### 1. Profile creation form component

**File**: `src/components/profile/CreateProfileForm.tsx` (new file)

**Intent**: React form capturing dog info and unique username. Follows existing `SignUpForm` pattern with real-time validation and error clearing.

**Contract**: Form fields:
- `login_name` (text input, 3-20 chars, kebab-case validation, uniqueness check on blur)
- `dog_name` (text input, required)
- `breed` (select dropdown from `DOG_BREEDS` constant)
- `date_of_birth` (date input, max=today)
- `sex` (radio buttons: Male / Female)

Form action: `POST /api/profile/create`. Use `FormField` component for inputs, `SubmitButton` for submission. Validation regex for `login_name`: `/^[a-z][a-z0-9-]{2,19}$/` (starts with letter, lowercase + numbers + hyphens, 3-20 chars).

Reserved username blocklist (prevents route conflicts):
```typescript
const RESERVED_USERNAMES = ["dashboard", "profile", "api", "auth", "tricks", "admin"];
```

Client-side validation:
```typescript
async function checkUsernameAvailable(username: string): Promise<boolean> {
  // Check reserved list first
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
    return false;
  }
  
  const res = await fetch(`/api/profile/check-username?username=${encodeURIComponent(username)}`);
  return res.ok;
}
```

Show error "Username reserved by the system" if in blocklist, "Username taken" if uniqueness check returns false.

#### 2. API route: Check username uniqueness

**File**: `src/pages/api/profile/check-username.ts` (new file)

**Intent**: Return 200 if username available, 409 if taken.

**Contract**: GET endpoint, query param `username`. Query Supabase `profiles` table:
```typescript
const { data } = await supabase
  .from("profiles")
  .select("login_name")
  .eq("login_name", username)
  .single();

if (data) return new Response(null, { status: 409 });
return new Response(null, { status: 200 });
```

#### 3. API route: Create profile

**File**: `src/pages/api/profile/create.ts` (new file)

**Intent**: Insert new profile row linked to authenticated user, enforce uniqueness constraint, handle conflicts.

**Contract**: POST endpoint. Extract FormData fields. Get `user` from `Astro.locals` (set by middleware). 

Server-side reserved username validation (prevent route conflicts):
```typescript
const RESERVED_USERNAMES = ["dashboard", "profile", "api", "auth", "tricks", "admin"];
const loginName = formData.get("login_name") as string;

if (RESERVED_USERNAMES.includes(loginName.toLowerCase())) {
  return context.redirect(`/profile/create?error=${encodeURIComponent("Username reserved by the system")}`);
}
```

Insert into `profiles` table:
```typescript
const { error } = await supabase.from("profiles").insert({
  user_id: user.id,
  login_name: loginName,
  dog_name: formData.get("dog_name"),
  breed: formData.get("breed"),
  date_of_birth: formData.get("date_of_birth"),
  sex: formData.get("sex"),
  photo_url: null // Photo added in Phase 3
});
```

If `error.code === "23505"` (unique violation), redirect to `/profile/create?error=Username already taken`. On success, redirect to `/dashboard`.

#### 4. Profile creation page

**File**: `src/pages/profile/create.astro` (new file)

**Intent**: Render profile creation wizard as first step after signup.

**Contract**: Protected route (add `/profile/create` to `PROTECTED_ROUTES`). Check if user already has profile — if yes, redirect to `/dashboard`. Extract `?error=` param, pass to `<CreateProfileForm>` as `serverError` prop. Use `Layout` with title "Create Your Profile".

#### 5. Redirect signup flow

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Change signup success redirect to profile creation wizard instead of dashboard.

**Contract**: Replace `return context.redirect("/dashboard");` (line 18) with `return context.redirect("/profile/create");`.

#### 6. Add profile check to signin route

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Prevent users without profiles from bypassing profile creation when signing in (e.g., users who signed up before this feature, cleared cookies, or use multiple devices).

**Contract**: After successful signin, check if profile exists before redirecting. First, update the signInWithPassword() destructuring to capture `data`:
```typescript
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
```

Then add profile query before redirect:
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("id")
  .eq("user_id", data.user.id)
  .single();

if (!profile) {
  return context.redirect("/profile/create");
}

return context.redirect("/dashboard");
```

Note: This requires the authenticated session to be established (which signin does) so `supabase.from()` queries work with the user's credentials.

#### 7. Profile display page

**File**: `src/pages/profile.astro` (new file)

**Intent**: Show authenticated user's own profile (read-only for now, editing deferred).

**Contract**: Protected route. Fetch profile from Supabase by `user_id`:
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("*")
  .eq("user_id", user.id)
  .single();
```

If no profile, redirect to `/profile/create`. Display dog name, breed, DOB, sex. Photo placeholder if `photo_url` is null. Show copy link button (functionality in Phase 8). Placeholder for progress score (added in Phase 7).

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes for new components
- ESLint passes (`npm run lint`)
- `/profile/create` returns 401 for unauthenticated requests (middleware check working)

#### Manual Verification:

- Sign up new account → redirected to `/profile/create`
- Fill form with valid data → profile created, redirected to `/dashboard`
- Try duplicate username → see "Username taken" error
- Navigate to `/profile` → see profile data displayed
- Sign out, try visiting `/profile` → redirected to `/auth/signin`
- Sign out, then sign in → redirected to `/dashboard` (profile already exists)
- Manually delete profile from Supabase, sign in → redirected to `/profile/create` (bypass prevented)

---

## Phase 3: Photo Upload (Supabase Storage)

### Overview

Set up Supabase Storage bucket for dog photos with RLS policies, build photo upload component with client-side file validation and preview, and create API route that uploads to Storage AND updates the user's existing profile row. Photo upload is **optional** and happens **after** profile creation to prevent orphaned files if profile creation fails.

### Changes Required:

#### 1. Supabase Storage bucket setup

**File**: `supabase/migrations/<timestamp>_create_dog_photos_bucket.sql` (new file)

**Intent**: Create public Storage bucket for dog photos with RLS policies. Use migration (version-controlled, repeatable, works in CI/CD) rather than manual dashboard setup.

**Contract**: Bucket name: `dog-photos`. Public read access (no auth required to view). RLS policies enforce authenticated users can upload to `{user_id}/*` path only; public read; owner-only UPDATE/DELETE.

SQL migration:
```sql
-- Create public bucket for dog photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dog-photos',
  'dog-photos',
  true,
  2097152,  -- 2MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS policies for storage.objects
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dog-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dog-photos');

CREATE POLICY "Users can update own photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'dog-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dog-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

#### 2. Photo upload component

**File**: `src/components/profile/PhotoUpload.tsx` (new file)

**Intent**: File input with preview, client-side validation (2MB max, jpg/png/webp only), and upload button.

**Contract**: Controlled component with `value: string | null` (photo URL) and `onChange: (url: string) => void`. File input triggers validation, shows preview via `URL.createObjectURL()`. On upload button click, POST file to `/api/profile/upload-photo` as `multipart/form-data`, receive public URL, call `onChange(url)`.

Client validation:
```typescript
if (file.size > 2 * 1024 * 1024) {
  setError("Photo must be under 2MB");
  return;
}
if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
  setError("Only JPG, PNG, and WebP allowed");
  return;
}
```

#### 3. API route: Upload photo and update profile

**File**: `src/pages/api/profile/upload-photo.ts` (new file)

**Intent**: Receive file upload, save to Supabase Storage, update user's existing profile row with photo URL. Ensures profile exists before uploading (prevents orphaned files).

**⚠️ Pre-implementation requirement**: Before coding this step, verify Supabase Storage API structure. Create a scratch file and test:
```typescript
const result = supabase.storage.from("dog-photos").getPublicUrl("test.jpg");
console.log(result); // Confirm structure matches { data: { publicUrl: string } }
```
The installed @supabase/supabase-js v2.99.1 has never been used for Storage in this codebase. If the actual structure differs (e.g., `{ publicUrl }` flat or `{ data: { url } }`), update the destructuring below accordingly.

**Contract**: POST endpoint. Extract file from `FormData`. Get `user` from `Astro.locals`. Verify profile exists, upload to Storage, update profile:
```typescript
const file = formData.get("photo") as File;

// Verify profile exists first
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id")
  .eq("user_id", user.id)
  .single();

if (profileError || !profile) {
  return new Response(JSON.stringify({ error: "Profile not found. Create profile first." }), { status: 404 });
}

// Upload to Storage
const fileExt = file.name.split(".").pop();
const fileName = `${user.id}/${Date.now()}.${fileExt}`;

const { data, error } = await supabase.storage
  .from("dog-photos")
  .upload(fileName, file, { contentType: file.type });

if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

// Get public URL
const { data: { publicUrl } } = supabase.storage.from("dog-photos").getPublicUrl(fileName);

// Update profile row with photo URL
const { error: updateError } = await supabase
  .from("profiles")
  .update({ photo_url: publicUrl })
  .eq("user_id", user.id);

if (updateError) {
  // Cleanup: delete uploaded file since profile update failed
  const { error: deleteError } = await supabase.storage
    .from("dog-photos")
    .remove([fileName]);
  
  if (deleteError) {
    console.error("Failed to cleanup orphaned file:", deleteError);
  }
  
  return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
}

return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
```

#### 4. Add photo upload to profile page

**File**: `src/pages/profile.astro`

**Intent**: Allow users to upload/update their dog photo after profile creation. Photo upload is optional.

**Contract**: On profile page, after displaying current profile data, render `<PhotoUpload value={profile.photo_url} onChange={handlePhotoChange} client:load />` where `handlePhotoChange` POSTs to `/api/profile/upload-photo` and refreshes page on success. Show placeholder avatar if `photo_url` is null with "Add Photo" CTA button.

Alternative implementation: Photo upload during profile creation wizard, but as a separate optional step **after** the required fields are saved (e.g., redirect from `/profile/create` success to `/profile/add-photo` which shows PhotoUpload component, then redirect to `/dashboard`).

#### 5. Display photo on profile page

**File**: `src/pages/profile.astro`

**Intent**: Show uploaded photo or placeholder avatar if missing.

**Contract**: Render `<img src={profile.photo_url || "/placeholder-dog.png"} alt="{profile.dog_name}" class="size-32 rounded-full object-cover" />`. Add placeholder image to `public/` directory.

### Success Criteria:

#### Automated Verification:

- Supabase Storage bucket `dog-photos` exists (check via `npx supabase storage ls`)
- TypeScript compilation passes
- ESLint passes

#### Manual Verification:

- Create profile with photo upload → photo appears on `/profile` page
- Create profile without photo → placeholder avatar shown
- Try uploading 3MB file → see "Photo must be under 2MB" error
- Try uploading .gif → see "Only JPG, PNG, and WebP allowed" error
- Visit photo URL directly in browser → image loads (public access working)
- Check Supabase Storage dashboard → see uploaded file under `dog-photos/{user_id}/`

---

## Phase 4: Catalog on Dashboard

### Overview

Replace the current empty dashboard with the trick catalog, fetching all tricks server-side, grouping by difficulty (beginner/intermediate/advanced), and rendering as cards with difficulty badges.

### Changes Required:

#### 1. Trick card component

**File**: `src/components/catalog/TrickCard.astro` (new file)

**Intent**: Display a single trick as a card with title, difficulty badge, description preview, and link to detail page.

**Contract**: Props: `trick: { id, name, slug, difficulty, description }`. Render card with cosmic glass theme. Difficulty badge: ⭐ (beginner), ⭐⭐ (intermediate), ⭐⭐⭐ (advanced). Truncate description to ~100 chars. Link wraps entire card: `<a href="/tricks/{slug}">`.

#### 2. Update dashboard to show catalog

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch all tricks from Supabase, group by difficulty, render as three sections (Beginner, Intermediate, Advanced) with cards. Ensure users have profiles before showing catalog.

**Contract**: Server-side fetch in frontmatter. First, check if user has a profile (redirect to creation if missing):
```typescript
// Check if user has profile
const { data: profile } = await supabase
  .from("profiles")
  .select("id")
  .eq("user_id", user.id)
  .single();

if (!profile) {
  return Astro.redirect("/profile/create");
}

// Fetch tricks for catalog
const { data: tricks } = await supabase
  .from("tricks")
  .select("*")
  .order("name");

const beginner = tricks?.filter(t => t.difficulty === "beginner") || [];
const intermediate = tricks?.filter(t => t.difficulty === "intermediate") || [];
const advanced = tricks?.filter(t => t.difficulty === "advanced") || [];
```

Render:
```astro
<section>
  <h2>⭐ Beginner</h2>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {beginner.map(trick => <TrickCard trick={trick} />)}
  </div>
</section>
<!-- Repeat for intermediate and advanced -->
```

If `tricks` is empty, show empty state: "No tricks in catalog yet. Check back soon!"

#### 3. Add dashboard to protected routes

**File**: `src/middleware.ts`

**Intent**: Ensure catalog requires authentication (dashboard already protected, but verify).

**Contract**: Confirm `/dashboard` is in `PROTECTED_ROUTES` array (line 4). No change needed if already present.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes
- ESLint passes
- Build succeeds (`npm run build`)

#### Manual Verification:

- Sign in, navigate to `/dashboard` → see tricks grouped into Beginner/Intermediate/Advanced sections
- Each trick displays as a card with difficulty badge
- Click trick card → navigates to `/tricks/{slug}` (detail page not yet implemented, will 404 for now)
- Verify ~10-15 tricks total across all sections (F-02 seed data)
- Mobile: cards stack vertically, touch targets ≥44px
- Empty state test: manually delete all tricks from Supabase → see "No tricks in catalog yet" message

---

## Phase 5: Trick Detail Pages

### Overview

Create dynamic route for trick detail pages (`/tricks/[slug].astro`), fetch trick by slug, display step-by-step teaching description, and handle 404 for missing tricks.

### Changes Required:

#### 1. Trick detail page route

**File**: `src/pages/tricks/[slug].astro` (new file)

**Intent**: Dynamic route to show individual trick details including full step-by-step teaching description.

**Contract**: Extract slug from `Astro.params.slug`. Fetch trick from Supabase:
```typescript
const { data: trick, error } = await supabase
  .from("tricks")
  .select("*")
  .eq("slug", Astro.params.slug)
  .single();

if (error || !trick) {
  return Astro.redirect("/404", 404);
}
```

Render:
- Trick name as `<h1>`
- Difficulty badge
- Full `description` (step-by-step teaching instructions) rendered as prose
- Breadcrumb: "← Back to Catalog" link to `/dashboard`
- Placeholder for status toggle (added in Phase 6)

#### 2. Handle 404 for missing tricks

**File**: `src/pages/404.astro` (new file if not exists)

**Intent**: Custom 404 page for missing trick slugs or usernames.

**Contract**: Generic 404 page with message "Page not found" and link back to `/dashboard`. Use cosmic glass theme to match site design.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes
- Build succeeds (`npm run build`)

#### Manual Verification:

- From catalog, click a trick card → see detail page with full description
- Manually visit `/tricks/sit` (assuming "sit" trick exists from F-02) → page loads
- Visit `/tricks/nonexistent-trick` → see 404 page
- Click "Back to Catalog" breadcrumb → returns to `/dashboard`
- Mobile: text readable, no horizontal scroll

---

## Phase 6: Status Tracking (Optimistic Updates)

### Overview

Build the status toggle component with icon buttons (Star for favorite, Clock for in-progress, Check for finished), integrate SWR for optimistic UI updates, create API route to upsert `user_tricks`, implement toast error handling and rollback on failure, and add status display to catalog and detail pages.

### Changes Required:

#### 1. Status toggle component

**File**: `src/components/catalog/StatusToggle.tsx` (new file)

**Intent**: Three icon buttons to change trick status. Optimistically updates UI, calls API mutation via SWR, shows toast on error and rolls back.

**Contract**: Props: `trickId: string`, `initialStatus: 'favorite' | 'in-progress' | 'finished' | null`. Uses lucide-react icons: `Star` (favorite), `Clock` (in-progress), `Check` (finished). Active status button is highlighted (filled icon + primary color). Clicking a button triggers SWR mutation:
```typescript
import useSWRMutation from "swr/mutation";
import { toast } from "sonner";

const { trigger } = useSWRMutation(
  `/api/tricks/status`,
  async (url, { arg }: { arg: { trickId: string; status: string } }) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arg)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  {
    onError: (err) => {
      toast.error(`Failed to update status: ${err.message}`);
      // Rollback handled by reverting optimistic state
    }
  }
);
```

Optimistic update: set local state immediately on click, revert if mutation fails.

#### 2. API route: Update trick status

**File**: `src/pages/api/tricks/status.ts` (new file)

**Intent**: Upsert `user_tricks` row with new status.

**Contract**: POST endpoint, JSON body `{ trickId, status }`. Get `user` from `Astro.locals`. Upsert into `user_tricks`:
```typescript
const { trickId, status } = await request.json();

const { error } = await supabase
  .from("user_tricks")
  .upsert({
    user_id: user.id,
    trick_id: trickId,
    status
  }, { onConflict: "user_id,trick_id" });

if (error) return new Response(error.message, { status: 500 });
return new Response(JSON.stringify({ success: true }), { status: 200 });
```

#### 3. Add toast provider to layout

**File**: `src/layouts/Layout.astro`

**Intent**: Wrap app with sonner `<Toaster>` component for global toast notifications.

**Contract**: Import `<Toaster>` from sonner, render at root level:
```astro
---
import { Toaster } from "sonner";
---
<html>
  <head>...</head>
  <body>
    <Toaster position="bottom-right" />
    <slot />
  </body>
</html>
```

#### 4. Add status toggle to catalog cards

**File**: `src/components/catalog/TrickCard.astro`

**Intent**: Display current status and allow toggling directly from catalog.

**Contract**: Accept additional prop `userStatus: string | null` (passed from dashboard). Render `<StatusToggle trickId={trick.id} initialStatus={userStatus} client:load />` at bottom of card.

#### 5. Update dashboard to fetch user statuses

**File**: `src/pages/dashboard.astro`

**Intent**: Join `user_tricks` to show which tricks user has marked.

**Contract**: Fetch tricks with left join:
```typescript
const { data: tricks } = await supabase
  .from("tricks")
  .select(`
    *,
    user_tricks!left(status)
  `)
  .eq("user_tricks.user_id", user.id)
  .order("name");
```

Pass `userStatus` to TrickCard: `<TrickCard trick={trick} userStatus={trick.user_tricks?.[0]?.status || null} />`.

#### 6. Add status toggle to detail page

**File**: `src/pages/tricks/[slug].astro`

**Intent**: Allow status changes from detail page.

**Contract**: Fetch trick with user status (same join as dashboard). Render `<StatusToggle>` component below description.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes
- ESLint passes
- `npm run build` succeeds

#### Manual Verification:

- From catalog, click Star icon on a trick → icon fills immediately (optimistic update)
- Wait 500ms → verify status persisted (reload page, status still marked)
- Open browser dev tools Network tab, throttle to Slow 3G, click status icon → UI updates instantly, API call completes later
- Disconnect network, click status icon → see toast error "Failed to update status", icon reverts to previous state (rollback working)
- From detail page, click Clock icon → status updates, navigate back to catalog → same trick shows Clock icon (status consistent across pages)
- Mobile: icon buttons ≥44px touch target, easily tappable

---

## Phase 7: Progress Score Calculation

### Overview

Build score calculation utility that sums finished tricks × difficulty weight, display score on profile page, and ensure score updates immediately when status changes to/from finished.

### Changes Required:

#### 1. Score calculation utility

**File**: `src/lib/calculate-score.ts` (new file)

**Intent**: Query `user_tricks` joined with `tricks` to sum difficulty weights for finished tricks.

**Contract**: Export async function:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export async function calculateProgressScore(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("user_tricks")
    .select("tricks(difficulty_weight)")
    .eq("user_id", userId)
    .eq("status", "finished");

  return data?.reduce((sum, row) => sum + (row.tricks?.difficulty_weight || 0), 0) || 0;
}
```

#### 2. Display score on profile page

**File**: `src/pages/profile.astro`

**Intent**: Show weighted progress score prominently on user's profile.

**Contract**: Call `calculateProgressScore()` in frontmatter:
```typescript
const score = await calculateProgressScore(supabase, user.id);
```

Render score display:
```astro
<div class="text-center">
  <div class="text-5xl font-bold text-purple-300">{score}</div>
  <div class="text-sm text-blue-100/80">training points</div>
</div>
```

#### 3. Revalidate score on status change

**File**: `src/components/catalog/StatusToggle.tsx`

**Intent**: When status changes to or from "finished", trigger profile data revalidation so score updates.

**Contract**: After successful mutation, call `mutate("/api/profile")` (or use global `mutate` to invalidate all profile queries if SWR configured globally). For simplicity in MVP, score updates on next page load. Real-time update within same page visit deferred to post-MVP.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes
- Unit test for `calculateProgressScore()` (mock Supabase response, verify sum)

#### Manual Verification:

- Mark 2 beginner tricks (weight 1 each) as finished → navigate to `/profile` → see "2 training points"
- Mark 1 intermediate trick (weight 2) as finished → refresh `/profile` → see "4 training points"
- Change finished trick back to in-progress → score decreases
- Create new account, no tricks marked → score shows "0 training points"

---

## Phase 8: Public Profiles & Sharing

### Overview

Create dynamic route for public profile URLs (`/user/username` via `user/[username].astro`), fetch profile and trick progress by username, display dog info and tricks grouped by status, add copy link button to user's own profile, and handle 404 for missing usernames.

### Changes Required:

#### 1. Public profile page route

**File**: `src/pages/user/[username].astro` (new file)

**Intent**: Dynamic route matching `/user/username` URLs to display public profile.

**Contract**: Extract username from `Astro.params.username`. Fetch profile:
```typescript
const username = Astro.params.username;

const { data: profile } = await supabase
  .from("profiles")
  .select("*")
  .eq("login_name", username)
  .single();

if (!profile) return Astro.redirect("/404", 404);
```

Fetch user's trick progress:
```typescript
const { data: userTricks } = await supabase
  .from("user_tricks")
  .select("trick_id, status, tricks(*)")
  .eq("user_id", profile.user_id);

const favorites = userTricks?.filter(ut => ut.status === "favorite") || [];
const inProgress = userTricks?.filter(ut => ut.status === "in-progress") || [];
const finished = userTricks?.filter(ut => ut.status === "finished") || [];
```

Render:
- Dog photo + name + breed + owner nickname (read-only, no edit)
- Progress score (call `calculateProgressScore()`)
- Three sections: "⭐ Favorites", "🕐 In Progress", "✅ Finished"
- Each section lists trick names (no status toggle — view-only)

#### 2. Copy link button on own profile

**File**: `src/pages/profile.astro`

**Intent**: Add button to copy profile URL (`/user/{login_name}`) to clipboard.

**Contract**: Client-side button component:
```tsx
<button onclick={() => {
  navigator.clipboard.writeText(`${window.location.origin}/user/${profile.login_name}`);
  toast.success("Profile link copied!");
}}>
  Copy profile link
</button>
```

Requires sonner toast already set up in Phase 6.

#### 3. Handle 404 for missing usernames

**File**: `src/pages/user/[username].astro`

**Intent**: Redirect to 404 page if username doesn't exist (already implemented in contract above).

**Contract**: If `profile` is null after query, return `Astro.redirect("/404", 404)`.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes
- Build succeeds (`npm run build`)

#### Manual Verification:

- Create profile with username "alice-dog", navigate to `/user/alice-dog` → see public profile
- From `/profile`, click "Copy profile link" → clipboard contains full URL, toast confirms "Profile link copied!"
- Open link in incognito window (or share with friend) → profile visible without login
- Navigate to `/user/nonexistent-user` → see 404 page
- Verify public profile shows tricks grouped by status (Favorites, In Progress, Finished)
- Verify public profile is read-only (no status toggle buttons)

---

## Phase 9: Navigation & Polish

### Overview

Update top navigation bar with Catalog and Profile links, add `/catalog` and `/profile` to protected routes, build empty state components for edge cases (no profile, no tricks, no photo), and verify mobile responsiveness across all pages.

### Changes Required:

#### 1. Update navigation bar

**File**: `src/components/Topbar.astro`

**Intent**: Add links to Catalog and Profile for authenticated users.

**Contract**: Modify existing topbar (currently shows sign in/out). For authenticated users (`Astro.locals.user`), show:
- "Catalog" link → `/dashboard`
- "Profile" link → `/profile`
- "Sign out" button (existing)

#### 2. Add routes to PROTECTED_ROUTES

**File**: `src/middleware.ts`

**Intent**: Protect `/profile` and `/catalog` (if separate from dashboard).

**Contract**: Update `PROTECTED_ROUTES` array:
```typescript
const PROTECTED_ROUTES = ["/dashboard", "/profile", "/catalog"];
```

Note: `/catalog` may not be needed if dashboard IS the catalog (per Phase 4 implementation). Verify and adjust.

#### 3. Verify empty state handling

**No new files** — Empty states are handled inline in existing pages.

**Intent**: Confirm that empty state scenarios are handled gracefully with clear messaging.

**Contract**: Verify the following empty states are implemented:
- `/dashboard` — If user has no profile, redirect to `/profile/create` (already implemented in Phase 4 step 2)
- `/dashboard` — If tricks array is empty, show inline message "No tricks in catalog yet. Check back soon!" (already implemented in Phase 4 step 2)
- `/profile` and `/user/username` — If `photo_url` is null, show placeholder avatar `/placeholder-dog.png` (already implemented in Phase 3)

Note: Reusable `EmptyState` component is deferred until a third distinct empty state pattern emerges. Current empty states are context-specific and benefit from inline implementation.

#### 4. Mobile responsiveness check

**File**: All pages

**Intent**: Ensure all pages are usable on mobile devices (320px+ width).

**Contract**: Test on Chrome DevTools mobile emulator (iPhone SE, iPad). Verify:
- No horizontal scroll
- Touch targets ≥44px (status icons, buttons)
- Text readable without zoom (≥16px base font)
- Form inputs accessible
- Navigation hamburger menu (if implemented) works
- Cards stack vertically on small screens (grid cols-1)

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes
- ESLint passes
- Build succeeds (`npm run build`)

#### Manual Verification:

- Sign in → see Topbar with Catalog, Profile, Sign out links
- Click Catalog → navigate to `/dashboard`
- Click Profile → navigate to `/profile`
- Try visiting `/profile` while signed out → redirected to `/auth/signin`
- Manually delete profile from Supabase → see "Complete your profile" empty state on dashboard
- Create profile without photo → see placeholder dog avatar
- Test on mobile viewport (320px width) → all pages responsive, no horizontal scroll
- Test touch targets on mobile → status icons and buttons easily tappable (≥44px)

---

## Testing Strategy

### Unit Tests:

- `calculateProgressScore()` — mock Supabase responses, verify weight sums (2 beginner + 1 advanced = 5 points)
- Username validation regex — test valid (`alice-123`) and invalid (`Alice_Cooper`, `ab`, `-alice-`) inputs
- Breed dropdown constant — verify alphabetical order, no duplicates

### Integration Tests:

- Profile creation flow end-to-end (form submit → API insert → redirect → profile page displays data)
- Status mutation flow (click Star → optimistic update → API call → revalidation → score recalc)
- Public profile access (visit `/user/username` → see profile, visit `/user/nonexistent` → 404)

### Manual Testing Steps:

1. **Full north star flow:** Sign up → create profile with photo → browse catalog → mark trick in-progress → view detail page → mark finished → check profile score updated → copy profile link → visit link in incognito → see public profile
2. **Error paths:** Try duplicate username, upload 3MB photo, disconnect network and click status toggle (verify toast + rollback)
3. **Edge cases:** Create profile without photo, mark all tricks finished, create brand new account with zero tricks marked
4. **Mobile:** Test on real iPhone or Android device if possible, verify touch targets and scrolling
5. **Cross-browser:** Test on Chrome, Firefox, Safari (latest 2 versions per PRD NFR)

## Performance Considerations

**Catalog load time (< 2s guardrail):**
- Server-side fetch of 10-15 tricks in `.astro` frontmatter is fast (< 100ms)
- No pagination needed at this scale
- Photo lazy loading via browser native `loading="lazy"` attribute

**Score calculation:**
- On-demand query (no caching for MVP) is acceptable with indexed `user_tricks.user_id` and small dataset
- If score query becomes slow (> 200ms), consider denormalizing into `profiles.score` column + database trigger (deferred to post-MVP)

**Optimistic updates:**
- SWR handles caching and revalidation
- Mutation latency hidden by instant UI update
- No perceived delay even on slow 3G networks

**Photo uploads:**
- 2MB limit enforced client + server
- Supabase Storage CDN handles delivery
- Consider adding WebP compression in post-MVP for smaller file sizes

## Migration Notes

**Initial setup (one-time, after F-01 migrations applied):**
1. Run `npx supabase start` to spin up local Supabase stack
2. Apply F-01 migrations: `npx supabase db reset` (if starting fresh) or `npx supabase migration up`
3. Verify schema: `npx supabase db diff` should show no changes
4. Generate TypeScript types: `npx supabase gen types typescript --local > src/lib/database.types.ts`
5. Seed tricks (F-02): `npx supabase db seed` or manual INSERT via Supabase dashboard
6. Create Storage bucket `dog-photos` (manual dashboard step or migration, see Phase 3)

**Data assumptions:**
- Existing users in `auth.users` from Supabase Auth (untouched by this plan)
- New `profiles` table starts empty — users create profiles after signup
- `tricks` and `user_tricks` tables seeded by F-02 with 10-15 starter tricks
- No existing profile data to migrate (greenfield)

**Deployment checklist:**
1. Push to `main` branch → GitHub Actions CI runs (`npm ci`, `npm run lint`, `npm run build`)
2. Deploy workflow pushes to Cloudflare Workers
3. Set Supabase env vars in Cloudflare Workers dashboard (or via `wrangler secret put`)
4. Verify production Supabase project has:
   - F-01 migrations applied
   - F-02 seed data inserted
   - Storage bucket `dog-photos` created with RLS policies
5. Test signup flow in production → create profile → upload photo → mark tricks

## References

- Related foundation work: F-01 (database-schema), F-02 (seed-trick-catalog)
- PRD: `context/foundation/prd.md` (US-01, FR-001-012, Business Logic, Success Criteria)
- Roadmap: `context/foundation/roadmap.md` (S-01 definition)
- Similar auth implementation: `src/pages/api/auth/signup.ts`, `src/components/auth/SignUpForm.tsx`
- Supabase Storage docs: https://supabase.com/docs/guides/storage
- SWR mutation docs: https://swr.vercel.app/docs/mutation
- sonner toast docs: https://sonner.emilkowal.ski/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 0: Database Schema Creation

#### Automated

- [x] 0.1 Migrations run without errors (`npx supabase migration up`) — f7ac0ef
- [x] 0.2 TypeScript type generation succeeds — f7ac0ef
- [x] 0.3 All tables exist in schema (profiles, tricks, user_tricks) — f7ac0ef
- [x] 0.4 Seed data inserted (12 tricks total) — f7ac0ef

#### Manual

- [x] 0.5 Profiles table structure verified (login_name unique, user_id FK) — f7ac0ef
- [x] 0.6 Tricks query shows correct difficulty_weight values (1/2/3) — f7ac0ef
- [x] 0.7 Difficulty distribution correct (4 beginner, 4 intermediate, 4 advanced) — f7ac0ef
- [x] 0.8 RLS policies block anonymous user_tricks insert — f7ac0ef
- [x] 0.9 TypeScript types generated and include all three tables — f7ac0ef

### Phase 1: Foundation Setup & Dependencies

#### Automated

- [x] 1.1 Install SWR and sonner packages (`npm install` completes) — d216815
- [x] 1.2 Create breeds constant (`src/lib/breeds.ts` exports DOG_BREEDS) — d216815
- [x] 1.3 TypeScript compilation passes (`npm run typecheck`) — d216815

#### Manual

- [x] 1.4 Verify database types from Phase 0 include profiles, tricks, user_tricks tables — d216815

### Phase 2: Profile Creation Flow

#### Automated

- [x] 2.1 TypeScript compilation passes — b86031f
- [x] 2.2 ESLint passes (`npm run lint`) — b86031f
- [x] 2.3 Profile create route protected (401 for unauthenticated) — b86031f

#### Manual

- [x] 2.4 Signup redirects to profile creation wizard — b86031f
- [x] 2.5 Profile creation with valid data succeeds — b86031f
- [x] 2.6 Duplicate username shows error "Username taken" — b86031f
- [x] 2.7 Profile page displays created profile data — b86031f
- [x] 2.8 Signin with existing profile redirects to dashboard — b86031f
- [x] 2.9 Signin without profile redirects to profile creation (bypass prevented) — b86031f

### Phase 3: Photo Upload (Supabase Storage)

#### Automated

- [x] 3.1 Supabase Storage bucket `dog-photos` exists — f3e4292
- [x] 3.2 TypeScript compilation passes — f3e4292
- [x] 3.3 ESLint passes — f3e4292

#### Manual

- [x] 3.4 Photo upload succeeds and appears on profile — f3e4292
- [x] 3.5 Photo placeholder shown when no upload — f3e4292
- [x] 3.6 2MB file size limit enforced (error shown for 3MB file) — f3e4292
- [x] 3.7 MIME type validation works (reject .gif) — f3e4292
- [x] 3.8 Verify Storage API return structure (console.log getPublicUrl() result shows correct nesting) — f3e4292

### Phase 4: Catalog on Dashboard

#### Automated

- [x] 4.1 TypeScript compilation passes — 9cecd36
- [x] 4.2 Build succeeds (`npm run build`) — 9cecd36

#### Manual

- [x] 4.3 Dashboard shows tricks grouped by difficulty — 9cecd36
- [x] 4.4 Trick cards display with correct badges — 9cecd36
- [x] 4.5 Empty state shown if no tricks (test by deleting seed data) — 9cecd36
- [x] 4.6 Mobile responsive (cards stack vertically) — 9cecd36

### Phase 5: Trick Detail Pages

#### Automated

- [x] 5.1 TypeScript compilation passes — 415eea3
- [x] 5.2 Build succeeds (`npm run build`) — 415eea3

#### Manual

- [x] 5.3 Trick detail page shows full description — 415eea3
- [x] 5.4 Breadcrumb "Back to Catalog" navigates correctly — 415eea3
- [x] 5.5 Missing trick slug shows 404 page — 415eea3

### Phase 6: Status Tracking (Optimistic Updates)

#### Automated

- [x] 6.1 TypeScript compilation passes — 59e6531
- [x] 6.2 ESLint passes — 59e6531
- [x] 6.3 Build succeeds (`npm run build`) — 59e6531

#### Manual

- [x] 6.4 Status icon click updates UI instantly (optimistic) — 59e6531
- [x] 6.5 Status persists after page reload — 59e6531
- [x] 6.6 Network error shows toast and rolls back status — 59e6531
- [x] 6.7 Status consistent across catalog and detail pages — 59e6531
- [x] 6.8 Mobile touch targets ≥44px for icons — 59e6531

### Phase 7: Progress Score Calculation

#### Automated

- [x] 7.1 TypeScript compilation passes — 2133f5b
- [x] 7.2 Unit test for calculateProgressScore passes — 2133f5b

#### Manual

- [x] 7.3 Profile shows correct score for finished tricks — 2133f5b
- [x] 7.4 Score updates when trick marked finished — 2133f5b
- [x] 7.5 New account shows "0 training points" — 2133f5b

### Phase 8: Public Profiles & Sharing

#### Automated

- [x] 8.1 TypeScript compilation passes — 706ae9d
- [x] 8.2 Build succeeds (`npm run build`) — 706ae9d

#### Manual

- [x] 8.3 Public profile accessible via /user/username — 706ae9d
- [x] 8.4 Copy link button works and copies full URL — 706ae9d
- [x] 8.5 Public profile shows tricks grouped by status — 706ae9d
- [x] 8.6 Missing username shows 404 — 706ae9d

### Phase 9: Navigation & Polish

#### Automated

- [x] 9.1 TypeScript compilation passes — a145b36
- [x] 9.2 ESLint passes — a145b36
- [x] 9.3 Build succeeds (`npm run build`) — a145b36

#### Manual

- [x] 9.4 Topbar shows Catalog and Profile links — a145b36
- [x] 9.5 Protected routes redirect when signed out — a145b36
- [x] 9.6 Empty states display correctly — a145b36
- [x] 9.7 All pages responsive on mobile (320px+ width, no horizontal scroll) — a145b36
