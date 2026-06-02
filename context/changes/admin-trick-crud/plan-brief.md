# Admin Trick CRUD — Plan Brief

> Full plan: [context/changes/admin-trick-crud/plan.md](context/changes/admin-trick-crud/plan.md)
> Research: [context/changes/admin-trick-crud/research.md](context/changes/admin-trick-crud/research.md)

## What & Why

Implement full CRUD operations for the trick catalog so admins can add, edit, and remove tricks without manual SQL editing. Currently, the catalog is populated via [seed.sql](supabase/seed.sql) only — no admin interface exists. This change delivers FR-018, FR-019, FR-020 (admin add/edit/remove tricks) and unblocks ongoing catalog curation as the product scales beyond the initial 12 starter tricks.

## Starting Point

Tricks table exists with public SELECT RLS policy but no INSERT/UPDATE/DELETE policies. Profiles table has no admin role field. Existing UI components ([FormField.tsx](src/components/auth/FormField.tsx), [ShareModal.tsx](src/components/profile/ShareModal.tsx)) provide reusable form and modal patterns. API routes follow established auth-check → validate → operate → respond pattern. Current tricks are seeded via SQL with manual kebab-case slugs (no generation utility).

## Desired End State

Admin user accesses `/admin/tricks` via nav link (visible only when `is_admin=true`), views all tricks including soft-deleted, creates new tricks via modal form with auto-generated slugs (editable), edits existing tricks, and soft-deletes tricks (sets `deleted_at`, filters from user catalog but preserves user progress). When admin changes a trick's difficulty, the system automatically recalculates progress scores for all users who have finished that trick within 1 second.

## Key Decisions Made

| Decision                       | Choice                            | Why (1 sentence)                                                                                                      | Source   |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Admin role assignment          | Database flag (is_admin)          | Simplest approach following existing patterns, checked via RLS policies.                                             | Plan     |
| Trick deletion                 | Soft delete (deleted_at)          | Preserves user_tricks history and allows restore, prevents irrecoverable data loss.                                  | Plan     |
| Slug generation                | Auto-generate, manual override    | Reduces admin friction (DX like modern CMSs) while allowing explicit control when needed.                            | Plan     |
| Description input              | Plain textarea                    | Matches current seed.sql plain text, zero dependencies, fast to implement.                                           | Plan     |
| Admin UI approach              | Modal-based (create/edit dialog)  | Faster UX without page navigation, matches ShareModal pattern from research.                                         | Plan     |
| Database security              | RLS with admin check              | Database-level enforcement per Supabase best practices, works even if API bypassed.                                  | Plan     |
| Validation strategy            | Client + server defense-in-depth  | Instant feedback for admin, matches CreateProfileForm.tsx pattern.                                                   | Plan     |
| Admin UI access                | Visible in nav when admin         | Discoverable immediately after login, low risk (route still guarded by middleware).                                  | Plan     |
| Edits to tracked tricks        | Allow edits, recalc scores        | Full flexibility to fix errors, users see updated scores immediately without data integrity loss.                    | Plan     |

## Scope

**In scope:**
- Add `is_admin` boolean to profiles table via migration
- Add `deleted_at` timestamp to tricks table via migration
- Create RLS policies for admin INSERT/UPDATE/DELETE on tricks table
- Build admin middleware helper (`isAdmin`) and utilities (`generateSlug`, `validateTrickInput`)
- Implement 4 admin API routes: create, update, delete (soft), check-slug
- Build modal-based admin UI with TrickFormModal and AdminTrickList components
- Add Admin link to Topbar (visible when `is_admin=true`)
- Implement score recalculation when trick difficulty changes

**Out of scope:**
- Rich text editor or markdown for descriptions (plain textarea only)
- Image upload for tricks (no images in schema)
- Custom difficulty weights (enforced 1/2/3 mapping per PRD)
- Bulk operations (multi-select delete/edit)
- Full audit log (soft delete provides basic history only)
- Admin user management UI (`is_admin` set via SQL)
- Pagination for admin list (acceptable with < 100 tricks)

## Architecture / Approach

**Five-phase incremental backend-first approach:**

1. **Database Foundation** — Migrations add `is_admin` and `deleted_at`, RLS policies grant admin write access
2. **Middleware & Utilities** — Admin auth helper, slug generation, validation utilities
3. **API Routes** — Four admin-protected endpoints (create/update/delete/check-slug) with validation
4. **UI Components** — Modal-based form (Radix Dialog), trick list table, nav link integration
5. **Score Recalculation** — Handle difficulty edits by recalculating affected user scores inline

Backend phases (1-3) establish foundation and are independently testable via curl/Postman. UI phase (4) builds on established API. Phase 5 handles the critical edge case of editing tracked tricks.

## Phases at a Glance

| Phase     | What it delivers                                                               | Key risk                                                           |
| --------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1. DB     | Admin role + soft delete schema, RLS policies for admin writes                | RLS policy subquery performance; testing policy logic via SQL     |
| 2. Utils  | Admin check, slug generation, validation helpers                              | Slug uniqueness edge cases (race conditions on concurrent create) |
| 3. API    | Create/update/delete/check-slug endpoints with validation                     | Error handling consistency; difficulty weight calculation bug     |
| 4. UI     | Modal form (create/edit), admin list table, nav integration, toast feedback   | Modal state management; client validation parity with server      |
| 5. Scores | Recalculate user progress scores when trick difficulty changes                | Performance with many users; ensuring < 1 second update           |

**Prerequisites:** None — this change builds on existing database schema (tricks, profiles tables) and auth (Supabase middleware).

**Estimated effort:** ~4-5 focused sessions across 5 phases (roughly 1 session per phase, testing overlap).

## Open Risks & Assumptions

- **Assumption:** First admin assigned manually via SQL (`UPDATE profiles SET is_admin=true WHERE login_name='...'`) — no self-service admin grant flow
- **Risk:** RLS policy subquery `(SELECT is_admin FROM profiles WHERE user_id = auth.uid())` adds join on every admin write — acceptable for low-frequency admin operations, but may need optimization if admin team grows > 10 people
- **Risk:** Slug uniqueness check is async (on blur) — race condition possible if two admins create tricks simultaneously with same name — low probability given single-admin expected usage in MVP
- **Assumption:** Score recalculation runs inline (not background job) — acceptable with < 100 users per trick, may need queue if user base grows > 10k
- **Risk:** Soft delete doesn't actually trigger CASCADE on `user_tricks` foreign key — if admin needs true hard delete, must manually clean up user_tricks first (out of scope for MVP)

## Success Criteria (Summary)

- Admin creates trick "New Trick" → slug auto-generates to `new-trick`, appears in catalog immediately
- Admin edits tracked trick's difficulty from beginner to intermediate → affected user scores update within 1 second
- Admin deletes trick → disappears from user catalog, user_tricks history preserved, admin can restore
- Non-admin user sees no admin link, direct navigation to `/admin/tricks` returns 403 or redirects
