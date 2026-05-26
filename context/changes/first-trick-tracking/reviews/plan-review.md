<!-- PLAN-REVIEW-REPORT -->
# Plan Review: User Can Track Their First Trick

- **Plan**: context/changes/first-trick-tracking/plan.md
- **Mode**: Deep
- **Date**: 2026-05-25
- **Verdict**: SOUND (after fixes)
- **Findings**: 8 total (3 critical, 4 warnings, 1 observation) — all addressed

## Verdicts

| Dimension | Initial | After Fixes |
|-----------|---------|-------------|
| End-State Alignment | WARNING | PASS |
| Lean Execution | WARNING | PASS |
| Architectural Fitness | PASS | PASS |
| Blind Spots | FAIL | PASS |
| Plan Completeness | WARNING | PASS |

## Grounding

5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Database schema (F-01/F-02) doesn't exist

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Overview, Current State Analysis
- **Detail**: Plan assumed F-01 (database-schema) and F-02 (seed-trick-catalog) were already implemented, but codebase verification showed no SQL migrations exist. The supabase/ directory has no migrations/, schema_paths = [], and roadmap marks F-01 as "ready" aspirationally. Phases 2-9 would fail immediately when trying to query non-existent tables.
- **Fix A ⭐ Recommended**: Add Phase 0 to create schema before current Phase 1
  - Strength: Makes plan self-contained; implementer can run end-to-end without external dependencies
  - Tradeoff: Expands scope beyond "first trick tracking" into foundation work (4 tables + RLS + seed)
  - Confidence: HIGH — schema shape is well-defined in roadmap.md
  - Blind spot: If F-01 is separate work by another team, creates coordination conflict
- **Decision**: FIXED via Fix A — Added Phase 0 with complete schema creation (profiles, tricks, user_tricks tables + RLS policies + 12 seeded tricks with step-by-step descriptions)

---

### F2 — Signin flow bypasses profile creation requirement

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 (Profile Creation Flow), Phase 6 (access control)
- **Detail**: Phase 2 changes signup to redirect to /profile/create, ensuring new users complete profiles. However, src/pages/api/auth/signin.ts still redirects directly to /dashboard. Users who signed up before this feature, cleared cookies and signed in again, or use multiple devices would bypass profile creation and land on dashboard. If they have no profile, Phase 4-9 features fail.
- **Fix**: Add profile existence check to signin flow and dashboard frontmatter
  - Strength: Closes the bypass gap; users without profiles are redirected to /profile/create from any entry point
  - Tradeoff: Adds a profile query to signin and dashboard page load (minimal perf cost with indexed user_id)
  - Confidence: HIGH — plan already has similar logic for /profile page
  - Blind spot: None significant
- **Decision**: FIXED — Added profile check to signin route (Phase 2 step 6) and dashboard frontmatter (Phase 4 step 2), plus manual verification steps 2.8–2.9

---

### F3 — Supabase Storage API return structure unverified

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3, step 3 — API route: Upload photo
- **Detail**: Plan's photo upload code assumes getPublicUrl() returns `{ data: { publicUrl } }` with nested destructuring. Codebase has NEVER used Supabase Storage (only auth). The destructuring pattern is based on docs but Supabase v2 API shows nesting ambiguity. Current package has @supabase/supabase-js v2.99.1 but no local evidence confirms this works.
- **Fix**: Add verification step in Phase 3 success criteria to log return structure
  - Strength: Quick console.log during manual testing catches the issue before production
  - Tradeoff: None—this should already be in manual testing
  - Confidence: HIGH — standard debugging practice for new APIs
  - Blind spot: None—logging reveals truth immediately
- **Decision**: FIXED — Added manual verification step 3.8 to verify Storage API return structure

---

### F4 — Bucket setup approach is vague ("manual OR migration")

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, step 1 — Supabase Storage bucket setup
- **Detail**: Phase 3 step 1 said "Manual Supabase dashboard step OR supabase/migrations/..." with no guidance on which to use. Implementer must decide, breaking flow. Migration approach is better (version-controlled, repeatable, works in CI/CD) but plan didn't say so.
- **Fix**: Specify migration approach as recommended; provide exact SQL
  - Strength: Removes decision burden; SQL in plan is copy-paste ready
  - Tradeoff: None—migrations are already being used for schema per Phase 0
  - Confidence: HIGH — this is standard infrastructure-as-code practice
  - Blind spot: None significant
- **Decision**: FIXED — Changed Phase 3 step 1 to specify migration approach with complete SQL including file size limit, MIME type restrictions, and all four RLS policies

---

### F5 — Photo upload failure leaves orphaned Storage files

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 (photo upload flow)
- **Detail**: Current flow: PhotoUpload component → upload to Storage → return URL → user saves profile form → insert profile row with photo_url. If profile creation fails (username constraint violation, network error), the photo is already in Storage but not referenced. Orphaned files accumulate over time. No cleanup mentioned.
- **Fix A ⭐ Recommended**: Reverse order—create profile first, upload photo after
  - Strength: Profile insert validates all data before uploading expensive 2MB file; no orphaned files
  - Tradeoff: Requires RLS policy to allow INSERT to {user_id}/* where user_id matches auth.uid(); UX flow changes—user sees profile partially created
  - Confidence: HIGH — eliminates the orphan problem entirely
  - Blind spot: UX flow changes; need loading state during upload
- **Fix B**: Add PENDING state or cleanup job for orphaned files
  - Strength: Keeps current flow; handles cleanup separately
  - Tradeoff: More complexity (cron job, state transitions); adds scope beyond MVP
  - Confidence: MEDIUM — cleanup jobs add operational overhead
  - Blind spot: Cost of orphaned 2MB files over time
- **Decision**: FIXED via Fix A — Restructured photo upload flow to create profile first (Phase 2), then upload photo as a profile UPDATE operation (Phase 3 step 3 now verifies profile exists, uploads photo, then updates profile row)

---

### F6 — Dashboard shows empty state before catalog implemented

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase sequencing (Phase 2 vs Phase 4)
- **Detail**: Phase 2 redirects signup → /profile/create → /dashboard. But catalog implementation is Phase 4. If implementer runs phases sequentially and tests after each phase, users land on the current empty dashboard ("Welcome, email@example.com" placeholder) after creating profiles in Phase 2-3. Not a runtime bug, but creates awkward intermediate UX if deploying incrementally or testing early phases.
- **Fix**: Note in Phase 2 that dashboard remains placeholder until Phase 4
  - Strength: Sets expectations; implementer knows this is temporary
  - Tradeoff: None—just documentation clarity
  - Confidence: HIGH — simple note prevents confusion
  - Blind spot: None
- **Decision**: FIXED — Added note in Phase 2 overview explaining that dashboard will show empty placeholder until Phase 4 (catalog) is implemented

---

### F7 — Type generation will fail without schema

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, step 2 — Generate TypeScript types
- **Detail**: Phase 1 step 2 runs `npx supabase gen types typescript --local` and assumes "F-01 migrations are applied to local Supabase instance." But with Phase 0 now added (creating the schema), type generation should happen AFTER Phase 0, not in Phase 1. Currently Phase 1 happens before schema exists, so generated types would be empty/minimal and Phase 1 success criteria "Verify database types include profiles, tricks, user_tricks tables" would fail.
- **Fix**: Move type generation to Phase 0 (after migrations) OR to start of Phase 1 with dependency note
  - Strength: Types reflect actual schema; TypeScript compilation works
  - Tradeoff: None—this is just sequencing
  - Confidence: HIGH — obvious dependency order
  - Blind spot: None
- **Decision**: FIXED — Moved TypeScript type generation from Phase 1 to Phase 0 (new step 5) so it happens after schema creation. Updated progress tracking and Phase 1 overview accordingly.

---

### F8 — EmptyState component might be premature abstraction

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 9, step 3 — Empty state component
- **Detail**: Phase 9 creates reusable `EmptyState.astro` component (message + optional CTA). Plan shows it used once: dashboard "Complete your profile to start tracking tricks" message. The pattern "extract component when used 2-3 times" suggests this is premature—one usage doesn't justify abstraction. Phase 4 already has inline empty state for "No tricks in catalog yet."
- **Fix**: Inline the dashboard empty state markup; defer component until 3rd usage
  - Strength: Less code, fewer concepts; follows "add abstraction when needed" pattern seen elsewhere in codebase
  - Tradeoff: If a third empty state appears soon, we refactor twice (minor duplication of 5-10 lines)
  - Confidence: MEDIUM — low stakes either way; style preference
  - Blind spot: Future roadmap items that might need empty states
- **Decision**: FIXED — Removed premature `EmptyState.astro` component creation from Phase 9. Empty states are now handled inline in their respective pages, deferring abstraction until a third usage emerges.

---

## Summary

All 8 findings have been addressed through targeted plan edits:

- **Phase 0 added** — Complete schema creation (profiles, tricks, user_tricks + RLS + seed data + type generation)
- **Profile checks strengthened** — Signin and dashboard now verify profile exists before proceeding
- **Photo upload flow reversed** — Profile created first, then photo uploaded and profile updated (prevents orphans)
- **Migration approach clarified** — Storage bucket setup uses migration with complete SQL
- **Type generation sequenced correctly** — Moved to Phase 0 after schema creation
- **Documentation improved** — Added notes explaining intermediate states and verification steps
- **Premature abstraction removed** — EmptyState component deferred until justified by usage

The plan is now **SOUND** and ready for implementation.
