---
date: 2026-06-02T00:00:00Z
researcher: GitHub Copilot
git_commit: 00ce07166c1889fdc193526407d473bae5315fd9
branch: main
repository: olkapolka/dog-trick-tracker
topic: "How the tricks catalog currently works - comprehensive research for admin CRUD"
tags: [research, codebase, tricks, catalog, admin, crud, ui-patterns, validation]
status: complete
last_updated: 2026-06-02
last_updated_by: GitHub Copilot
---

# Research: How the Tricks Catalog Currently Works

**Date**: 2026-06-02
**Researcher**: GitHub Copilot
**Git Commit**: 00ce07166c1889fdc193526407d473bae5315fd9
**Branch**: main
**Repository**: olkapolka/dog-trick-tracker

## Research Question

Research the codebase to understand how the tricks catalog currently works:
1. Find all files that display or interact with tricks (pages, components, API routes)
2. Understand the tricks table schema and any related queries
3. Identify existing UI patterns for forms, modals, or CRUD operations
4. Look for validation patterns and error handling
5. Check if there are any existing admin UI components or pages

## Summary

The tricks catalog is a **read-only system** currently populated via database seed file ([supabase/seed.sql](supabase/seed.sql)). There are **no admin CRUD operations** implemented yet. The system displays 12 starter tricks across three difficulty levels (beginner/intermediate/advanced) with users able to track their progress via status toggles (favorite/in-progress/finished). 

**Key findings:**
- **Display:** Tricks shown on [dashboard.astro](src/pages/dashboard.astro#L35-L50) (catalog grid) and [tricks/[slug].astro](src/pages/tricks/[slug].astro) (detail pages)
- **UI Components:** Reusable form components ([FormField.tsx](src/components/auth/FormField.tsx), [SubmitButton.tsx](src/components/auth/SubmitButton.tsx)), modal pattern ([ShareModal.tsx](src/components/profile/ShareModal.tsx)), and UI primitives ([button.tsx](src/components/ui/button.tsx))
- **Slug Generation:** Manual in seed file; no auto-generation logic exists
- **Validation:** Server-side + client-side pattern established in [profile/create.ts](src/pages/api/profile/create.ts#L20-L60) with real-time client validation in [CreateProfileForm.tsx](src/components/profile/CreateProfileForm.tsx#L30-L77)
- **No Admin Routes:** "admin" is a reserved username, but no `/admin/*` pages exist

## Detailed Findings

### 1. Tricks Display & Interaction Points

#### Dashboard (Catalog Grid)
- **File:** [src/pages/dashboard.astro](src/pages/dashboard.astro)
- **Lines:** [35-50](src/pages/dashboard.astro#L35-L50) (query), [96-130](src/pages/dashboard.astro#L96-L130) (render)
- **Query Pattern:**
  ```typescript
  const { data: tricksData } = await supabase
    .from("tricks")
    .select(`
      *,
      user_tricks!left(status)
    `)
    .eq("user_tricks.user_id", user.id)
    .order("name");
  ```
- **Rendering:** Tricks grouped by difficulty (`beginner`, `intermediate`, `advanced`) into three sections, each displaying [TrickCard.astro](src/components/catalog/TrickCard.astro) components in a responsive grid
- **Empty State:** [dashboard.astro:134](src/pages/dashboard.astro#L134) shows "No tricks in catalog yet" message

#### Trick Detail Pages
- **File:** [src/pages/tricks/[slug].astro](src/pages/tricks/[slug].astro)
- **Dynamic Route:** Uses `Astro.params.slug` to fetch individual trick
- **Query:** [tricks/[slug].astro:22-30](src/pages/tricks/[slug].astro#L22-L30) fetches trick with left join to `user_tricks` for status
- **Content Display:** 
  - Trick name, difficulty badge ([tricks/[slug].astro:77-82](src/pages/tricks/[slug].astro#L77-L82))
  - Full step-by-step description ([tricks/[slug].astro:86-95](src/pages/tricks/[slug].astro#L86-L95))
  - StatusToggle component for authenticated users ([tricks/[slug].astro:97-106](src/pages/tricks/[slug].astro#L97-L106))
- **404 Handling:** [tricks/[slug].astro:38-41](src/pages/tricks/[slug].astro#L38-L41) redirects to `/404` if trick not found

#### Profile Pages
- **File:** [src/pages/profile.astro](src/pages/profile.astro)
- **Display:** User's tricks organized by status (favorite, in-progress, finished) in [ProfileDisplay.astro:131-155](src/components/profile/ProfileDisplay.astro#L131-L155)
- **Public Profiles:** [src/pages/user/[username].astro](src/pages/user/[username].astro) shows read-only view of another user's trick progress

### 2. Database Schema

#### Tricks Table
- **Migration:** [supabase/migrations/20260526132218_create_tricks_table.sql](supabase/migrations/20260526132218_create_tricks_table.sql)
- **Schema:**
  ```sql
  CREATE TABLE tricks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    difficulty difficulty_level NOT NULL,       -- ENUM: beginner | intermediate | advanced
    difficulty_weight INTEGER NOT NULL CHECK (difficulty_weight IN (1, 2, 3)),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **Indexes:** 
  - `idx_tricks_difficulty` on `difficulty` ([create_tricks_table.sql:14](supabase/migrations/20260526132218_create_tricks_table.sql#L14))
  - `idx_tricks_slug` on `slug` ([create_tricks_table.sql:15](supabase/migrations/20260526132218_create_tricks_table.sql#L15))
- **RLS:** Public read access ([create_tricks_table.sql:19-21](supabase/migrations/20260526132218_create_tricks_table.sql#L19-L21))

#### User Tricks Junction Table
- **Migration:** [supabase/migrations/20260526132227_create_user_tricks_table.sql](supabase/migrations/20260526132227_create_user_tricks_table.sql)
- **Schema:**
  ```sql
  CREATE TABLE user_tricks (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE NOT NULL,
    status trick_status NOT NULL,              -- ENUM: favorite | in-progress | finished
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, trick_id)
  );
  ```
- **RLS Policies:** Users can view/insert/update only their own trick progress ([create_user_tricks_table.sql:19-29](supabase/migrations/20260526132227_create_user_tricks_table.sql#L19-L29))

#### TypeScript Types
- **File:** [src/lib/database.types.ts](src/lib/database.types.ts)
- **Tricks Type:** [database.types.ts:80-110](src/lib/database.types.ts#L80-L110)
- **Enums:** [database.types.ts:150-152](src/lib/database.types.ts#L150-L152)
  - `difficulty_level`: `"beginner" | "intermediate" | "advanced"`
  - `trick_status`: `"favorite" | "in-progress" | "finished"`

### 3. Current Slug Generation Pattern

**Finding:** **No automatic slug generation exists.** Slugs are manually defined in the seed file.

- **Seed File:** [supabase/seed.sql](supabase/seed.sql)
- **Pattern Observed:** Slugs are kebab-case versions of trick names
- **Examples:**
  - "Sit" → `'sit'`
  - "Lie Down" → `'lie-down'`
  - "Roll Over" → `'roll-over'`
  - "High Five" → `'high-five'`
- **Uniqueness:** Enforced by `UNIQUE` constraint on `tricks.slug` column ([create_tricks_table.sql:7](supabase/migrations/20260526132218_create_tricks_table.sql#L7))
- **No Utility Function:** No slug generation helper found in `/src/lib/`

**Recommendation for Admin CRUD:** Implement a `generateSlug(name: string)` utility that:
1. Converts to lowercase
2. Replaces spaces with hyphens
3. Removes non-alphanumeric characters (except hyphens)
4. Handles duplicates by appending `-2`, `-3`, etc.

### 4. UI Components Available for Reuse

#### Form Components (Auth Pattern)

**FormField Component**
- **File:** [src/components/auth/FormField.tsx](src/components/auth/FormField.tsx)
- **Props:** `id`, `label`, `type`, `value`, `onChange`, `onBlur`, `placeholder`, `error`, `hint`, `icon`, `endContent`, `max`
- **Features:**
  - Icon support (left-aligned via Lucide icons)
  - Error state with red border and error message display ([FormField.tsx:60-66](src/components/auth/FormField.tsx#L60-L66))
  - Optional hint text (replaces error when no error present)
  - End content slot (used for password toggle)
- **Styling:** Cosmic glass theme with white/10 background, border validation states
- **Usage Example:** [SignUpForm.tsx:70-85](src/components/auth/SignUpForm.tsx#L70-L85)

**SubmitButton Component**
- **File:** [src/components/auth/SubmitButton.tsx](src/components/auth/SubmitButton.tsx)
- **Features:**
  - Automatic disabled state during form submission (via `formAction`)
  - Pending text swap (e.g., "Create account" → "Creating account...")
  - Icon support
  - Gradient cosmic theme
- **Usage:** [CreateProfileForm.tsx:213-215](src/components/profile/CreateProfileForm.tsx#L213-L215)

**ServerError Component**
- **File:** [src/components/auth/ServerError.tsx](src/components/auth/ServerError.tsx)
- **Purpose:** Display server-side error messages passed via URL query params
- **Usage:** [SignInForm.tsx:85](src/components/auth/SignInForm.tsx#L85), [CreateProfileForm.tsx:211](src/components/profile/CreateProfileForm.tsx#L211)

#### Modal Pattern (Radix UI)

**ShareModal Component**
- **File:** [src/components/profile/ShareModal.tsx](src/components/profile/ShareModal.tsx)
- **Tech:** `@radix-ui/react-dialog` for accessible modal
- **Features:**
  - Overlay with backdrop blur ([ShareModal.tsx:50-51](src/components/profile/ShareModal.tsx#L50-L51))
  - Animated entry/exit transitions
  - Close button with accessible label ([ShareModal.tsx:63-69](src/components/profile/ShareModal.tsx#L63-L69))
  - Sections within modal (Copy Link, QR Code, Email)
- **Pattern:** `Dialog.Root` → `Dialog.Trigger` → `Dialog.Portal` → `Dialog.Overlay` + `Dialog.Content`
- **Reusability:** This pattern can be adapted for admin forms (create/edit trick modal)

#### UI Primitives

**Button Component**
- **File:** [src/components/ui/button.tsx](src/components/ui/button.tsx)
- **Tech:** `class-variance-authority` for variants
- **Variants:** default, destructive, outline, secondary, ghost, link
- **Sizes:** default, sm, lg, icon
- **Features:** Focus states, disabled states, icon support

#### Catalog-Specific Components

**TrickCard Component**
- **File:** [src/components/catalog/TrickCard.astro](src/components/catalog/TrickCard.astro)
- **Purpose:** Display trick preview in catalog grid
- **Features:**
  - Difficulty badge (⭐/⭐⭐/⭐⭐⭐)
  - Truncated description (100 chars)
  - Link to detail page
  - StatusToggle embedded ([TrickCard.astro:41-43](src/components/catalog/TrickCard.astro#L41-L43))

**StatusToggle Component**
- **File:** [src/components/catalog/StatusToggle.tsx](src/components/catalog/StatusToggle.tsx)
- **Tech:** SWR mutation for optimistic updates
- **Features:**
  - Three icon buttons (Star/Clock/Check)
  - Optimistic UI updates ([StatusToggle.tsx:35-37](src/components/catalog/StatusToggle.tsx#L35-L37))
  - Error rollback with toast notification ([StatusToggle.tsx:41-45](src/components/catalog/StatusToggle.tsx#L41-L45))
- **Pattern:** Client-side mutation → API call → rollback on error

### 5. Validation Patterns

#### Client-Side Validation Pattern

**Example:** [CreateProfileForm.tsx](src/components/profile/CreateProfileForm.tsx)

**Features:**
1. **Real-time error clearing** ([CreateProfileForm.tsx:117-120](src/components/profile/CreateProfileForm.tsx#L117-L120))
   ```typescript
   onChange={(v) => {
     setLoginName(v.toLowerCase());
     clearError("loginName");
     setUsernameAvailable(null);
   }}
   ```

2. **Validation functions** ([CreateProfileForm.tsx:30-45](src/components/profile/CreateProfileForm.tsx#L30-L45))
   ```typescript
   function validateLoginName(username: string): string | undefined {
     if (!username.trim()) return "Username is required";
     if (username.length < 3 || username.length > 20) 
       return "Username must be 3-20 characters";
     if (!/^[a-z][a-z0-9-]{2,19}$/.test(username)) 
       return "Username must start with a letter, lowercase only...";
     if (RESERVED_USERNAMES.includes(username.toLowerCase())) 
       return "Username reserved by the system";
     return undefined;
   }
   ```

3. **On-blur async checks** ([CreateProfileForm.tsx:57-71](src/components/profile/CreateProfileForm.tsx#L57-L71))
   ```typescript
   async function handleUsernameBlur() {
     const validationError = validateLoginName(loginName);
     if (validationError) { /* set error */ return; }
     
     setCheckingUsername(true);
     const available = await checkUsernameAvailable(loginName);
     setUsernameAvailable(available);
     setCheckingUsername(false);
     
     if (!available) setErrors(prev => ({...prev, loginName: "Username taken"}));
   }
   ```

4. **Submit-time validation** ([CreateProfileForm.tsx:77-114](src/components/profile/CreateProfileForm.tsx#L77-L114))
   ```typescript
   const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (e) => {
     if (!validate()) {
       e.preventDefault();
     }
   };
   ```

#### Server-Side Validation Pattern

**Example:** [src/pages/api/profile/create.ts](src/pages/api/profile/create.ts)

**Features:**
1. **Validation errors array** ([create.ts:20-60](src/pages/api/profile/create.ts#L20-L60))
   ```typescript
   const validationErrors: string[] = [];
   
   if (!loginName.trim()) {
     validationErrors.push("Username is required");
   } else if (loginName.length < 3 || loginName.length > 20) {
     validationErrors.push("Username must be 3-20 characters");
   }
   // ... more checks
   
   if (validationErrors.length > 0) {
     return context.redirect(
       `/profile/create?error=${encodeURIComponent(validationErrors.join("; "))}`
     );
   }
   ```

2. **Database error handling** ([create.ts:80-85](src/pages/api/profile/create.ts#L80-L85))
   ```typescript
   if (error) {
     if (error.code === "23505") {  // Unique violation
       return context.redirect(
         `/profile/create?error=${encodeURIComponent("Username already taken")}`
       );
     }
     return context.redirect(`/profile/create?error=${encodeURIComponent(error.message)}`);
   }
   ```

**Reserved Username Pattern:**
- **File:** [src/pages/api/profile/create.ts:4](src/pages/api/profile/create.ts#L4)
- ```typescript
  const RESERVED_USERNAMES = ["dashboard", "profile", "api", "auth", "tricks", "admin"];
  ```
- This prevents route conflicts (e.g., `/user/profile` vs `/profile`)

### 6. Error Handling & Toast Notifications

#### Toast System Setup

**Provider:** [src/components/ui/ToastProvider.tsx](src/components/ui/ToastProvider.tsx)
- **Tech:** `sonner` library
- **Integration:** Added to [Layout.astro:39](src/layouts/Layout.astro#L39) as `client:only="react"`

**Usage Pattern:**
```typescript
import { toast } from "sonner";

// Success
toast.success("Link copied to clipboard!");

// Error
toast.error(`Failed to update status: ${errorMessage}`);
```

**Example:** [StatusToggle.tsx:44](src/components/catalog/StatusToggle.tsx#L44)

#### Error Propagation Pattern

1. **API Response** → JSON error object
2. **Client Catch** → Parse error message
3. **Toast Display** → User-friendly message
4. **UI Rollback** → Optimistic state reverted

**Example:** [StatusToggle.tsx:38-45](src/components/catalog/StatusToggle.tsx#L38-L45)

### 7. API Routes Pattern

#### Trick Status Update API
- **File:** [src/pages/api/tricks/status.ts](src/pages/api/tricks/status.ts)
- **Method:** POST
- **Auth Check:** [status.ts:5-11](src/pages/api/tricks/status.ts#L5-L11)
- **Validation:** [status.ts:36-42](src/pages/api/tricks/status.ts#L36-L42) validates status enum
- **Upsert Pattern:** [status.ts:45-53](src/pages/api/tricks/status.ts#L45-L53)
  ```typescript
  const { error } = await supabase.from("user_tricks").upsert(
    {
      user_id: user.id,
      trick_id: trickId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,trick_id" }
  );
  ```

**Pattern Observations:**
- All protected API routes check `context.locals.user` first
- Errors return JSON with `{ error: string }` shape
- Success returns JSON with `{ success: true }` or data object
- Supabase client created per-request via `createClient()`

### 8. Protected Routes & Middleware

**File:** [src/middleware.ts](src/middleware.ts)

**Protected Routes Array:**
```typescript
const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/friends",
  "/api/profile",
  "/api/tricks",
  "/api/follow",
  "/api/unfollow",
];
```

**Pattern:** Routes starting with any of the above require authentication. Middleware also checks for profile existence and redirects to `/profile/create` if missing ([middleware.ts:36-45](src/middleware.ts#L36-L45)).

**Recommendation:** Add `/admin` or `/api/admin` to `PROTECTED_ROUTES` for admin CRUD routes.

### 9. Existing Admin UI

**Finding:** **No admin UI exists yet.**

- "admin" is reserved in username list ([create.ts:4](src/pages/api/profile/create.ts#L4))
- No `/admin/*` pages or `/api/admin/*` routes found
- No role/permission system in database schema
- Current tricks management: manual SQL seed file only

## Code References

### Display & Components
- [src/pages/dashboard.astro:35-50](src/pages/dashboard.astro#L35-L50) - Catalog query with user status join
- [src/pages/tricks/[slug].astro:1-112](src/pages/tricks/[slug].astro) - Trick detail page
- [src/components/catalog/TrickCard.astro:1-43](src/components/catalog/TrickCard.astro) - Catalog card component
- [src/components/catalog/StatusToggle.tsx:1-95](src/components/catalog/StatusToggle.tsx) - Status mutation with optimistic UI

### Database & Schema
- [supabase/migrations/20260526132218_create_tricks_table.sql](supabase/migrations/20260526132218_create_tricks_table.sql) - Tricks table schema
- [supabase/migrations/20260526132227_create_user_tricks_table.sql](supabase/migrations/20260526132227_create_user_tricks_table.sql) - User tricks junction table
- [supabase/seed.sql:1-128](supabase/seed.sql) - 12 starter tricks seed data
- [src/lib/database.types.ts:80-152](src/lib/database.types.ts) - TypeScript types

### API & Validation
- [src/pages/api/tricks/status.ts:1-72](src/pages/api/tricks/status.ts) - Status mutation endpoint
- [src/pages/api/profile/create.ts:1-89](src/pages/api/profile/create.ts) - Server-side validation pattern

### Reusable UI Components
- [src/components/auth/FormField.tsx:1-70](src/components/auth/FormField.tsx) - Form input with error states
- [src/components/auth/SubmitButton.tsx](src/components/auth/SubmitButton.tsx) - Submit button with pending state
- [src/components/profile/ShareModal.tsx:1-120](src/components/profile/ShareModal.tsx) - Modal pattern (Radix Dialog)
- [src/components/ui/button.tsx:1-55](src/components/ui/button.tsx) - Button primitive with variants

### Error Handling
- [src/components/ui/ToastProvider.tsx](src/components/ui/ToastProvider.tsx) - Sonner toast provider
- [src/layouts/Layout.astro:39](src/layouts/Layout.astro#L39) - Toast provider integration
- [src/components/auth/ServerError.tsx](src/components/auth/ServerError.tsx) - Server error display component

### Routing & Middleware
- [src/middleware.ts:1-53](src/middleware.ts) - Auth middleware with protected routes

## Architecture Insights

### Current Patterns & Conventions

1. **Cosmic Glass Theme:** Consistent across all UI components
   - `bg-white/10`, `border-white/10`, `backdrop-blur-xl`
   - Gradient text: `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent`

2. **Server-Side Rendering First:** Pages are Astro components with server-side data fetching, React components for interactive elements (`client:load`)

3. **Optimistic UI Pattern:** Status changes update immediately, rollback on API error

4. **Error Propagation:** URL query params for page-level errors, toast for in-page mutations

5. **Type Safety:** Generated types from Supabase schema via `database.types.ts`

6. **Progressive Enhancement:** Core catalog browsing works without JS, status tracking requires JS

### Design Decisions from Historical Context

From [context/archive/2026-05-25-first-trick-tracking/plan-brief.md](context/archive/2026-05-25-first-trick-tracking/plan-brief.md):

- **No CRUD for tricks in MVP:** "Admin trick management (no CRUD for tricks; deferred to S-05)"
- **Weighted scoring:** Beginner=1pt, Intermediate=2pt, Advanced=3pt
- **Catalog grouping:** Three sections (Beginner/Intermediate/Advanced) on dashboard
- **Step-by-step descriptions:** Essential to product value (teaching instructions)

From implementation reviews ([impl-review-2026-05-27.md](context/archive/2026-05-25-first-trick-tracking/reviews/impl-review-2026-05-27.md)):
- **No LIMIT on queries:** Warning raised but deferred (acceptable with 12 tricks)
- **No HTML sanitization on descriptions:** Observation raised; seed data is plain text

## Open Questions

1. **Slug auto-generation strategy:** Should admin form auto-generate slugs from trick names, or allow manual override?
2. **Description input:** Plain textarea or rich text editor? Current descriptions use `\n` for step separations.
3. **Admin authentication:** Role-based (new `profiles.role` column) or hardcoded email list?
4. **Trick deletion:** Soft delete (add `deleted_at` column) or hard delete? Consider `user_tricks` rows with `ON DELETE CASCADE`.
5. **Difficulty weight:** Should admin be able to customize weights, or enforce 1/2/3 mapping?
6. **Image support:** Tricks currently have no images. Future enhancement?

## Recommendations for Admin CRUD Implementation

### High-Priority Patterns to Reuse

1. **FormField + SubmitButton:** Already handles error states, pending states, and cosmic theme
2. **ShareModal pattern:** Adapt Radix Dialog for Create/Edit Trick modals
3. **Server-side validation:** Mirror [profile/create.ts](src/pages/api/profile/create.ts) pattern for trick validation
4. **Protected routes:** Add `/admin` to `PROTECTED_ROUTES` in [middleware.ts](src/middleware.ts)

### Validation Rules to Implement

Based on existing schema constraints:

- **Name:** Required, max length TBD (no constraint in DB; suggest 100 chars)
- **Slug:** Required, unique, kebab-case regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- **Difficulty:** ENUM validation (beginner|intermediate|advanced)
- **Difficulty Weight:** Integer 1-3, must match difficulty (beginner=1, etc.)
- **Description:** Required, suggest min 20 chars for meaningful steps

### Missing Utilities to Create

1. **`generateSlug(name: string): string`:** Kebab-case conversion with duplicate handling
2. **`validateTrickInput(input: TrickInput): ValidationErrors`:** Centralized validation
3. **Slug uniqueness check API:** `/api/admin/tricks/check-slug?slug=...` (mirror username check)

### Suggested File Structure

```
src/pages/admin/
  tricks/
    index.astro         # Admin tricks list with CRUD actions
    create.astro        # Create new trick form (or modal)
    edit/[id].astro     # Edit existing trick (or modal)

src/pages/api/admin/tricks/
  create.ts             # POST /api/admin/tricks/create
  update.ts             # POST /api/admin/tricks/update
  delete.ts             # POST /api/admin/tricks/delete
  check-slug.ts         # GET /api/admin/tricks/check-slug?slug=...

src/components/admin/
  TrickForm.tsx         # Reusable form for Create/Edit (shared component)
  TrickList.tsx         # Admin tricks table/list
```

### Security Considerations

1. **Admin authentication:** Decide on role check (profile.role = 'admin') or hardcoded email allowlist
2. **RLS policies:** Add admin-specific policies to tricks table for INSERT/UPDATE/DELETE
3. **CSRF protection:** Astro forms POST to API routes; ensure same-origin validation
4. **Input sanitization:** Escape HTML in descriptions if not using markdown parser

---

**Next Steps:** Review findings with stakeholders, decide on open questions, then proceed to implementation planning.
