# Admin Trick CRUD Implementation Plan

## Overview

Implement full CRUD operations for trick catalog management with admin authentication, soft delete, auto-slug generation, modal-based UI, and automatic score recalculation when trick difficulty changes.

## Current State Analysis

**What exists today:**
- ✅ Tricks table with public SELECT RLS policy ([supabase/migrations/20260526132218_create_tricks_table.sql](supabase/migrations/20260526132218_create_tricks_table.sql))
- ✅ 12 starter tricks seeded via SQL ([supabase/seed.sql](supabase/seed.sql))
- ✅ Trick display in catalog ([src/pages/dashboard.astro](src/pages/dashboard.astro#L35-L50)) and detail pages ([src/pages/tricks/[slug].astro](src/pages/tricks/[slug].astro))
- ✅ User progress tracking via user_tricks junction table with CASCADE delete
- ✅ Supabase auth with middleware protecting routes ([src/middleware.ts](src/middleware.ts))
- ✅ Reusable form components ([FormField.tsx](src/components/auth/FormField.tsx), [SubmitButton.tsx](src/components/auth/SubmitButton.tsx))
- ✅ Modal pattern established ([ShareModal.tsx](src/components/profile/ShareModal.tsx) using Radix Dialog)
- ❌ **No admin role mechanism** — profiles table has no `is_admin` field
- ❌ **No INSERT/UPDATE/DELETE RLS policies** on tricks table — currently locked to reads only
- ❌ **No admin UI** — "admin" is reserved username but no `/admin/*` pages exist
- ❌ **No slug generation utility** — slugs manually defined in seed.sql
- ❌ **No soft delete** — hard delete would CASCADE to user_tricks, losing user progress

**Key constraints discovered:**
- Tricks table has unique constraint on `slug` column ([create_tricks_table.sql:7](supabase/migrations/20260526132218_create_tricks_table.sql#L7))
- Difficulty enum is `beginner | intermediate | advanced` ([database.types.ts:151](src/lib/database.types.ts#L151))
- Difficulty weight must be 1-3 and match difficulty per business logic ([create_tricks_table.sql:9](supabase/migrations/20260526132218_create_tricks_table.sql#L9))
- User progress scores calculated from finished tricks with difficulty weights ([PRD Business Logic](context/foundation/prd.md#L80-L90))
- Existing API routes follow pattern: auth check → Supabase client → validation → operation → JSON response ([research.md](context/changes/admin-trick-crud/research.md#L423-L507))

## Desired End State

**Admin user can:**
1. Access `/admin/tricks` page (link visible in nav when `is_admin=true`)
2. View list of all tricks (including soft-deleted, with restore option)
3. Create new tricks via modal form with auto-generated slug (editable)
4. Edit existing tricks via modal form
5. Soft-delete tricks (sets `deleted_at`, filters from user catalog)
6. System automatically recalculates user scores when trick difficulty changes

**Verification:**
- Admin creates a trick named "Test Trick", slug auto-generates to `test-trick`, appears in catalog immediately
- Admin edits a tracked trick's difficulty from beginner to intermediate, affected user scores update within 1 second
- Admin deletes a trick, it disappears from user catalog but user_tricks history preserved
- Non-admin user sees no admin link in nav, `/admin/tricks` redirects to dashboard

### Key Discoveries

- **Modal pattern established:** [ShareModal.tsx](src/components/profile/ShareModal.tsx#L50-L120) uses Radix Dialog with overlay, animated transitions, and cosmic glass styling — adaptable for TrickFormModal
- **Validation pattern:** Client + server defense-in-depth used in [CreateProfileForm.tsx](src/components/profile/CreateProfileForm.tsx#L30-L77) with real-time error clearing and on-blur async checks
- **Server validation:** [profile/create.ts](src/pages/api/profile/create.ts#L20-L60) accumulates errors array, checks unique constraints via database error codes (23505)
- **Slug pattern:** Existing seed uses kebab-case (e.g., "High Five" → `high-five`) with no generation utility
- **Score calculation:** [calculate-score.ts](src/lib/calculate-score.ts#L10-L20) aggregates finished tricks by difficulty weight — will need inverse recalculation for difficulty edits

## What We're NOT Doing

- **Rich text editor** — using plain textarea for descriptions (matches current seed.sql plain text)
- **Image upload for tricks** — no images in current schema or UI, deferred to future enhancement
- **Custom difficulty weights** — enforcing 1/2/3 mapping per PRD Business Logic
- **Markdown rendering** — descriptions stored and displayed as plain text with `\n` line breaks
- **Bulk operations** — no multi-select delete or bulk edit, one trick at a time only
- **Audit log** — soft delete provides basic history, full audit trail deferred
- **Admin user management UI** — `is_admin` flag set via SQL only, no admin-creates-admin flow

## Implementation Approach

**Five-phase incremental approach:**

1. **Database Foundation** — Add admin role field and soft delete support via migrations, establish RLS policies
2. **Middleware & Utilities** — Build admin auth checking, slug generation, and validation utilities
3. **API Routes** — Implement admin-protected CRUD endpoints with validation and error handling
4. **UI Components** — Build modal-based admin interface with form reuse and toast notifications
5. **Score Recalculation** — Handle difficulty edit edge case by recalculating affected user scores

Each phase is independently testable and delivers incremental value. Phases 1-3 establish backend foundation, Phase 4 adds UI, Phase 5 handles the critical edge case of editing tracked tricks.

## Phase 1: Database Foundation

### Overview

Add `is_admin` boolean to profiles table, `deleted_at` timestamp to tricks table, create RLS policies allowing admin INSERT/UPDATE/DELETE, and regenerate TypeScript types.

### Changes Required

#### 1. Database Migration — Admin Role

**File**: `supabase/migrations/20260602000001_add_admin_role.sql`

**Intent**: Add `is_admin` boolean column to profiles table with default false, create index for admin queries.

**Contract**: New column `profiles.is_admin BOOLEAN DEFAULT false NOT NULL`. After migration, all existing profiles have `is_admin=false`. Manual SQL grant needed for first admin.

#### 2. Database Migration — Soft Delete

**File**: `supabase/migrations/20260602000002_add_tricks_soft_delete.sql`

**Intent**: Add `deleted_at` timestamp column to tricks table, create partial index for active tricks.

**Contract**: New column `tricks.deleted_at TIMESTAMPTZ DEFAULT NULL`. Active tricks have `deleted_at IS NULL`. Soft-deleted tricks have timestamp value.

#### 3. RLS Policies — Admin Write Access

**File**: Add to migration `20260602000002_add_tricks_soft_delete.sql`

**Intent**: Create RLS policies allowing INSERT, UPDATE, DELETE on tricks table when user is admin.

**Contract**: Three new policies:
- `"Admins can insert tricks"` — checks `auth.uid()` matches a profile with `is_admin=true`
- `"Admins can update tricks"` — same admin check
- `"Admins can delete tricks"` — same admin check (enables soft delete via UPDATE)

RLS query pattern uses subquery:
```sql
(SELECT is_admin FROM profiles WHERE user_id = auth.uid()) = true
```

#### 4. Filter Deleted Tricks from User Views

**File**: Update migration `20260602000002_add_tricks_soft_delete.sql`

**Intent**: Modify existing public read policy to exclude soft-deleted tricks from user catalog.

**Contract**: Update existing RLS policy `"Tricks are publicly readable"` to add `WHERE deleted_at IS NULL`.

#### 5. TypeScript Type Regeneration

**File**: `src/lib/database.types.ts`

**Intent**: Regenerate TypeScript types from updated Supabase schema.

**Contract**: Run `npx supabase gen types typescript --local > src/lib/database.types.ts` after migrations apply. New fields: `profiles.is_admin: boolean`, `tricks.deleted_at: string | null`.

### Success Criteria

#### Automated Verification

- Migrations apply cleanly: `npx supabase db reset` (local dev)
- Type generation succeeds: `npx supabase gen types typescript --local`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification

- Create test profile with `is_admin=false`, verify cannot insert trick via RLS
- Set test profile `is_admin=true` via SQL, verify can insert trick
- Soft-delete a trick via SQL (`UPDATE tricks SET deleted_at=NOW() WHERE slug='test'`), verify it disappears from dashboard catalog
- Check deleted trick still exists in database with `SELECT * FROM tricks WHERE deleted_at IS NOT NULL`

**Implementation Note**: After automated verification passes, manually test RLS policies via Supabase SQL editor before proceeding to Phase 2.

---

## Phase 2: Middleware & Utilities

### Overview

Build admin authentication middleware helper, slug generation utility with uniqueness handling, trick input validation utility, and update protected routes array.

### Changes Required

#### 1. Admin Check Middleware Helper

**File**: `src/lib/admin.ts`

**Intent**: Provide reusable function to check if current user is admin, for use in API routes and middleware.

**Contract**: Export `isAdmin(userId: string, supabase: SupabaseClient): Promise<boolean>`. Queries profiles table for `is_admin` flag. Returns false on query error or missing profile.

#### 2. Slug Generation Utility

**File**: `src/lib/slugify.ts`

**Intent**: Generate URL-safe kebab-case slugs from trick names, with optional uniqueness suffix.

**Contract**: Export `generateSlug(name: string): string` that:
- Converts to lowercase
- Replaces spaces with hyphens
- Removes non-alphanumeric except hyphens
- Returns kebab-case string (e.g., "High Five!" → "high-five")

No database uniqueness check in this utility — API route handles that via separate check-slug endpoint.

#### 3. Trick Validation Utility

**File**: `src/lib/validate-trick.ts`

**Intent**: Centralize validation rules for trick input, reusable in client and server.

**Contract**: Export `validateTrickInput(input: { name?: string; slug?: string; difficulty?: string; description?: string }): Record<string, string>`. Returns object with field names as keys, error messages as values (empty object if valid).

Validation rules:
- `name`: required, 1-100 chars
- `slug`: required, matches `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- `difficulty`: required, one of `beginner | intermediate | advanced`
- `description`: required, min 20 chars

#### 4. Update Protected Routes

**File**: `src/middleware.ts`

**Intent**: Add `/admin` and `/api/admin` to protected routes array.

**Contract**: Update `PROTECTED_ROUTES` array to include `"/admin"` and `"/api/admin"`. No admin role check in middleware yet — role check happens in each admin API route.

### Success Criteria

#### Automated Verification

- Unit tests for `generateSlug`: `"Hello World"` → `"hello-world"`, `"Test! 123"` → `"test-123"`
- Unit tests for `validateTrickInput`: empty name fails, valid input passes
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification

- Import `isAdmin` in Astro dev tools console, verify returns false for non-admin user
- Set test user `is_admin=true`, verify returns true
- Test `generateSlug` with edge cases: empty string, special chars, Unicode
- Test `validateTrickInput` with missing fields, invalid slug format
- Navigate to `/admin/tricks` while logged in, verify middleware allows access (no 404)

**Implementation Note**: After automated tests pass, manually verify utilities work as expected in Node REPL or Astro dev console before proceeding to Phase 3.

---

## Phase 3: Admin API Routes

### Overview

Implement four API endpoints for admin CRUD operations with authentication, validation, and error handling following established patterns.

### Changes Required

#### 1. Check Slug Availability API

**File**: `src/pages/api/admin/tricks/check-slug.ts`

**Intent**: Query-based endpoint to check if a slug is available (mirrors `/api/profile/check-username.ts` pattern).

**Contract**: GET endpoint accepting `?slug=...` query param. Returns 200 (available), 409 (taken), or 400 (invalid format). Response body: `{ available: boolean }`.

#### 2. Create Trick API

**File**: `src/pages/api/admin/tricks/create.ts`

**Intent**: POST endpoint to insert new trick with admin authentication and validation.

**Contract**: Accepts JSON body `{ name, slug, difficulty, description }`. Returns 201 + `{ success: true, trick: {...} }` on success, or 400/401/409/500 on error.

Steps:
1. Check `context.locals.user` (401 if missing)
2. Create Supabase client
3. Check `isAdmin(user.id)` (403 if false)
4. Parse JSON body
5. Validate with `validateTrickInput` (400 if invalid)
6. Calculate `difficulty_weight` from difficulty (beginner=1, intermediate=2, advanced=3)
7. Insert into tricks table
8. Handle duplicate slug error (code 23505 → 409 Conflict)
9. Return created trick with 201

#### 3. Update Trick API

**File**: `src/pages/api/admin/tricks/update.ts`

**Intent**: POST endpoint to update existing trick with admin auth and optional difficulty change handling.

**Contract**: Accepts JSON body `{ id, name?, slug?, difficulty?, description? }`. Returns 200 + `{ success: true, trick: {...} }` on success.

Steps:
1. Auth + admin check (401/403)
2. Validate input (400 if invalid)
3. Fetch current trick to compare difficulty
4. Update trick row
5. If difficulty changed, update `difficulty_weight` and trigger score recalculation (delegated to Phase 5 utility)
6. Return updated trick

#### 4. Delete Trick API (Soft Delete)

**File**: `src/pages/api/admin/tricks/delete.ts`

**Intent**: POST endpoint to soft-delete trick by setting `deleted_at` timestamp.

**Contract**: Accepts JSON body `{ id }`. Returns 200 + `{ success: true }` on success.

Steps:
1. Auth + admin check (401/403)
2. Validate `id` is UUID (400 if invalid)
3. Update trick: `SET deleted_at = NOW() WHERE id = ...`
4. Return success (trick disappears from user catalog due to RLS policy filter)

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- API routes exist at expected paths: `ls src/pages/api/admin/tricks/*.ts`

#### Manual Verification

- **Check-slug**: GET `/api/admin/tricks/check-slug?slug=sit` returns `{ available: false }`, `?slug=brand-new` returns `{ available: true }`
- **Create**: POST to `/api/admin/tricks/create` as non-admin returns 403, as admin with valid data returns 201, duplicate slug returns 409
- **Update**: POST to `/api/admin/tricks/update` with changed difficulty returns 200, verify trick appears with new difficulty in catalog
- **Delete**: POST to `/api/admin/tricks/delete` with trick ID returns 200, verify trick disappears from user dashboard but still queryable with `deleted_at IS NOT NULL` filter

**Implementation Note**: After automated checks pass, manually test all four endpoints via curl or Postman with admin and non-admin auth tokens before proceeding to Phase 4.

---

## Phase 4: Admin UI Components

### Overview

Build modal-based admin interface with trick list table, shared create/edit form modal, nav integration, and toast notifications for success/error feedback.

### Changes Required

#### 1. Admin Tricks List Page

**File**: `src/pages/admin/tricks.astro`

**Intent**: Server-rendered page querying all tricks (including soft-deleted) with create/edit/delete actions.

**Contract**: Protected route (requires auth + admin). Queries tricks table with `deleted_at` column visible. Renders `AdminTrickList` React component with trick data as props.

#### 2. Admin Trick List Component

**File**: `src/components/admin/AdminTrickList.tsx`

**Intent**: Client-side React component displaying tricks in table with action buttons.

**Contract**: Table columns: Name, Slug, Difficulty, Status (Active/Deleted), Actions (Edit/Delete/Restore). Uses SWR for data fetching with revalidation on mutation. Clicking Edit opens `TrickFormModal` in edit mode, Delete shows confirmation toast then calls delete API, Restore (for deleted tricks) sets `deleted_at=NULL`.

#### 3. Trick Form Modal Component

**File**: `src/components/admin/TrickFormModal.tsx`

**Intent**: Radix Dialog modal with shared form for create and edit modes.

**Contract**: Props: `mode: 'create' | 'edit'`, `trick?: Trick`, `onSuccess: () => void`. Form fields:
- Name (text input with `FormField`)
- Slug (text input, auto-populates on name change in create mode, editable)
- Difficulty (select dropdown: beginner/intermediate/advanced)
- Description (textarea with char count)

Client-side validation with `validateTrickInput`, real-time error clearing on change, on-blur slug uniqueness check via `/api/admin/tricks/check-slug`. Submit calls create or update API, shows toast on success, triggers `onSuccess` callback for list refresh.

#### 4. Navigation Integration

**File**: `src/components/Topbar.astro`

**Intent**: Add "Admin" link to navigation when user is admin.

**Contract**: After querying user's profile in Topbar's server-side section, conditionally render Admin link if `profile.is_admin === true`. Link points to `/admin/tricks`, styled consistently with existing nav links.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- React Compiler rules pass: `npm run lint` (no `react-compiler/react-compiler` errors)

#### Manual Verification

- **Admin sees link**: Log in as admin user, verify "Admin" link appears in Topbar, clicking navigates to `/admin/tricks`
- **Non-admin no link**: Log in as regular user, verify Admin link absent, direct navigation to `/admin/tricks` redirects or shows 403
- **Create flow**: Click Create button, modal opens, fill form with "Test Trick" (slug auto-generates to `test-trick`), submit, modal closes, trick appears in list immediately
- **Slug uniqueness**: Try creating trick with existing slug, verify error toast and form field error message
- **Edit flow**: Click Edit on existing trick, modal opens with pre-filled data, change difficulty from beginner to intermediate, submit, verify trick updates in list and difficulty badge changes
- **Delete flow**: Click Delete on trick, confirmation toast appears, confirm, trick marked as deleted in list (shows "Deleted" status)
- **Restore flow**: Click Restore on deleted trick, verify status changes to "Active"
- **Validation**: Submit empty form, verify all required field errors appear
- **Client perf**: Modal open/close animations smooth, no layout shift on form errors

**Implementation Note**: After automated checks pass, manually test full CRUD cycle in browser with toast notifications visible before proceeding to Phase 5.

---

## Phase 5: Score Recalculation

### Overview

Handle difficulty edit edge case by recalculating weighted progress scores for all users who have marked the edited trick as finished.

### Changes Required

#### 1. Score Recalculation Utility

**File**: `src/lib/recalculate-user-scores.ts`

**Intent**: Recalculate progress scores for users affected by a trick's difficulty change.

**Contract**: Export `recalculateScoresForTrick(trickId: string, supabase: SupabaseClient): Promise<void>`. Queries all user_tricks rows with `status='finished'` for the given trick, recalculates each user's total score using `calculate-score.ts` logic, updates profile or cache (depending on where score is stored — currently calculated on-the-fly per research).

If scores are calculated on-the-fly (not stored), this function may be a no-op placeholder. If scores are cached, update cache here.

#### 2. Integrate into Update API

**File**: `src/pages/api/admin/tricks/update.ts`

**Intent**: Trigger score recalculation when trick difficulty changes.

**Contract**: After successful UPDATE query in Phase 3 update API, compare `oldDifficulty !== newDifficulty`. If changed, call `recalculateScoresForTrick(trickId, supabase)`. Operation runs async but completes before response (scores update within 1 second per NFR).

#### 3. Verification Endpoint (Test Helper)

**File**: `src/pages/api/admin/tricks/verify-scores.ts`

**Intent**: Development-only endpoint to verify score recalculation worked correctly.

**Contract**: GET endpoint accepting `?trickId=...` query param. Returns array of affected users with their recalculated scores. Used for manual verification during testing.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Unit test for `recalculateScoresForTrick`: mock Supabase, verify query shape and logic
- Linting passes: `npm run lint`

#### Manual Verification

- Create test user, mark "Sit" (beginner, 1 pt) as finished, verify score = 1
- As admin, edit "Sit" difficulty to intermediate (2 pts)
- Refresh test user's profile, verify score = 2 now
- Check `/api/admin/tricks/verify-scores?trickId=...` shows updated score for test user
- Verify update took < 1 second (check network timing in browser DevTools)
- Test with multiple users: User A finishes trick, User B does not, admin edits difficulty, verify only User A's score changes

**Implementation Note**: After automated tests pass, manually verify with real user data in local Supabase before considering this phase complete.

---

## Testing Strategy

### Unit Tests

- **Utilities**: `generateSlug`, `validateTrickInput`, `recalculateScoresForTrick` — test edge cases, empty inputs, special chars
- **Validation**: Test all validation rules independently (name length, slug format, difficulty enum, description min chars)

### Integration Tests

- **API Routes**: Test full request/response cycle with mock Supabase client
  - Create trick: valid input → 201, duplicate slug → 409, non-admin → 403
  - Update trick: difficulty change triggers recalc
  - Delete trick: soft delete sets timestamp, trick disappears from user catalog
- **RLS Policies**: Test via Supabase SQL Editor
  - Non-admin user tries INSERT → rejected
  - Admin user tries INSERT → succeeds
  - Soft-deleted trick filtered from public reads

### Manual Testing Steps

1. **Admin Setup**: Manually set `is_admin=true` for one test user via SQL
2. **Nav Link**: Log in as admin, verify Admin link visible; log in as regular user, verify hidden
3. **Create Flow**: Create trick "Dance", verify slug auto-generates to `dance`, appears in catalog
4. **Edit Flow**: Edit "Dance" difficulty, verify difficulty badge updates, scores recalculate
5. **Delete Flow**: Delete "Dance", verify disappears from user dashboard, still in admin list as deleted
6. **Restore Flow**: Restore "Dance", verify reappears in user catalog
7. **Slug Uniqueness**: Try creating trick with existing slug, verify error message
8. **Non-Admin Block**: Log out admin, try accessing `/admin/tricks` as regular user, verify redirect/403

## Performance Considerations

**Database Queries:**
- Admin list page queries full tricks table — acceptable with < 100 tricks (current: 12)
- If catalog grows > 1000 tricks, add pagination to admin list (deferred for MVP)
- Slug uniqueness check is additional query on form blur — cached via SWR to reduce load

**RLS Policy Performance:**
- Admin check via subquery `(SELECT is_admin FROM profiles WHERE user_id = auth.uid())` adds join per write operation
- Acceptable for admin writes (low frequency)
- Profile queries already indexed ([create_profiles_table.sql:14](supabase/migrations/20260526132201_create_profiles_table.sql#L14))

**Score Recalculation:**
- Runs inline on difficulty edit (not background job)
- With 100 users, recalculating all scores takes < 100ms (single query + calculation)
- If user base grows > 10k, move to background queue (deferred)

## Migration Notes

**First Admin Setup:**
After Phase 1 migration, manually grant admin role to initial admin user:
```sql
UPDATE profiles SET is_admin = true WHERE login_name = 'your-admin-username';
```

**Slug Migration:**
Existing tricks from seed.sql already have slugs — no migration needed. New tricks created via admin UI will have auto-generated slugs.

**Soft Delete vs Hard Delete:**
Current foreign key constraint on `user_tricks.trick_id` uses `ON DELETE CASCADE`. With soft delete, the trick row never actually deletes, so CASCADE never fires. User progress is preserved. If admin needs to hard-delete (rare), must manually delete user_tricks rows first or use `ON DELETE SET NULL` (not implemented in MVP).

## References

- Related research: [context/changes/admin-trick-crud/research.md](context/changes/admin-trick-crud/research.md)
- PRD admin requirements: [context/foundation/prd.md#L117-L126](context/foundation/prd.md#L117-L126) (FR-018, FR-019, FR-020)
- Roadmap context: [context/foundation/roadmap.md:S-05](context/foundation/roadmap.md#L45-L49)
- Similar implementation (profile CRUD): [src/pages/api/profile/create.ts](src/pages/api/profile/create.ts)
- Modal pattern reference: [src/components/profile/ShareModal.tsx](src/components/profile/ShareModal.tsx)
- Database schema: [supabase/migrations/20260526132218_create_tricks_table.sql](supabase/migrations/20260526132218_create_tricks_table.sql)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Foundation

#### Automated

- [x] 1.1 Migrations apply cleanly: `npx supabase db reset`
- [x] 1.2 Type generation succeeds: `npx supabase gen types typescript --local`
- [x] 1.3 Type checking passes: `npm run typecheck`
- [x] 1.4 Linting passes: `npm run lint`

#### Manual

- [x] 1.5 RLS policies verified via Supabase SQL editor (admin can insert, non-admin cannot)
- [x] 1.6 Soft-delete verified (deleted trick disappears from catalog, still in database)

### Phase 2: Middleware & Utilities

#### Automated

- [ ] 2.1 Unit tests for `generateSlug` pass
- [ ] 2.2 Unit tests for `validateTrickInput` pass
- [ ] 2.3 Type checking passes: `npm run typecheck`
- [ ] 2.4 Linting passes: `npm run lint`

#### Manual

- [ ] 2.5 `isAdmin` helper verified (returns true for admin, false for regular user)
- [ ] 2.6 Utilities tested with edge cases (empty strings, special chars, Unicode)
- [ ] 2.7 Middleware allows `/admin/tricks` access for authenticated users

### Phase 3: Admin API Routes

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 API route files exist at expected paths

#### Manual

- [ ] 3.4 Check-slug API verified (available/taken responses correct)
- [ ] 3.5 Create API verified (admin succeeds 201, non-admin 403, duplicate 409)
- [ ] 3.6 Update API verified (difficulty change returns 200, catalog reflects change)
- [ ] 3.7 Delete API verified (trick soft-deleted, disappears from user catalog)

### Phase 4: Admin UI Components

#### Automated

- [ ] 4.1 Type checking passes: `npm run typecheck`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 React Compiler rules pass (no `react-compiler/react-compiler` errors)

#### Manual

- [ ] 4.4 Admin link visible to admin users, hidden from regular users
- [ ] 4.5 Create flow complete (modal opens, form validates, trick appears in list)
- [ ] 4.6 Slug uniqueness check works (error on duplicate, success on unique)
- [ ] 4.7 Edit flow complete (modal pre-fills, updates apply, difficulty badge changes)
- [ ] 4.8 Delete flow complete (confirmation toast, trick marked deleted)
- [ ] 4.9 Restore flow complete (deleted trick reactivated)
- [ ] 4.10 Form validation complete (empty form shows all errors)
- [ ] 4.11 Modal animations smooth (no layout shift, toasts appear)

### Phase 5: Score Recalculation

#### Automated

- [ ] 5.1 Type checking passes: `npm run typecheck`
- [ ] 5.2 Unit tests for `recalculateScoresForTrick` pass
- [ ] 5.3 Linting passes: `npm run lint`

#### Manual

- [ ] 5.4 Score recalculation verified (difficulty edit updates user scores within 1 second)
- [ ] 5.5 Multi-user test verified (only users with finished trick affected)
- [ ] 5.6 Verify endpoint tested (returns correct recalculated scores)
