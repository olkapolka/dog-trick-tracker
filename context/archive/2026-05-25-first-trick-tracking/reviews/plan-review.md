<!-- PLAN-REVIEW-REPORT -->
# Plan Review: User Can Track Their First Trick

- **Plan**: context/changes/first-trick-tracking/plan.md
- **Mode**: Deep
- **Date**: 2026-05-26
- **Verdict**: REVISE
- **Findings**: 1 critical, 4 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Phase 2 step 6 signin code won't work as written

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Profile Creation Flow, step 6
- **Detail**: Plan instructs adding a profile existence check to signin.ts after successful authentication. The code snippet assumes `data.user.id` is available, but the current signin.ts only destructures `{ error }` from signInWithPassword(), not `{ data, error }`. The plan's code will fail at runtime with "Cannot read property 'user' of undefined". Evidence from codebase (src/pages/api/auth/signin.ts:11): `const { error } = await supabase.auth.signInWithPassword(...)`. Plan code at line 506-517 requires: `data.user.id` but data is never captured.
- **Fix A ⭐ Recommended**: Update plan to capture data destructuring before profile check
  - Strength: Matches the actual Supabase auth API contract; minimal change to plan (one line edit). The session IS established by signInWithPassword(), just needs to be captured.
  - Tradeoff: None significant — this is the correct implementation.
  - Confidence: HIGH — sub-agent verified signInWithPassword() returns { data, error } in Supabase v2.99.1.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A applied — added data destructuring to signin.ts)

### F2 — Plan Overview contradicts Phase 0 implementation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Overview section (lines 5-8) vs Phase 0
- **Detail**: Plan Overview states "This plan assumes F-01 (database-schema) and F-02 (seed-trick-catalog) are already implemented" but Phase 0 creates these schemas from scratch. The plan-brief correctly says "Database schema will be created in Phase 0 — this plan is self-contained". Implementers following Phase 0 will succeed, but the contradiction is confusing and could cause uncertainty.
- **Fix**: Update Overview to match plan-brief: "This plan is self-contained. Phase 0 creates the database schema (profiles, tricks, user_tricks) and seeds the starter trick catalog."
- **Decision**: FIXED (Overview updated to clarify Phase 0 creates schema)

### F3 — Orphaned Storage files on profile update failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Photo Upload, step 3 (API route)
- **Detail**: Phase 3 upload-photo API route uploads file to Storage, then updates the profiles table with photo_url. If the profile update fails, the file is already in Storage with no reference. Plan includes a TODO comment "Consider deleting uploaded file on profile update failure" but doesn't resolve it. Over time, orphaned files accumulate storage costs and clutter.
- **Fix A ⭐ Recommended**: Add cleanup on profile update failure
  - Strength: Prevents orphaned files; shows defensive programming. Simple try-catch or if-error block with supabase.storage.remove().
  - Tradeoff: Adds 5 lines of error handling code. If Storage.remove() also fails, you're in a partial state (logged but not fatal).
  - Confidence: HIGH — this is standard cleanup-on-failure pattern.
  - Blind spot: What if the storage.remove() call itself fails? Plan should log the error but let the upload-photo request fail gracefully.
- **Fix B**: Accept orphaned files as acceptable technical debt for MVP
  - Strength: Simpler implementation; defers complexity to post-MVP cleanup. With 2MB photo limit and low early-user volume, cost is minimal.
  - Tradeoff: Storage costs accumulate; no automated cleanup. Requires manual purge script later.
  - Confidence: MEDIUM — depends on risk tolerance and cleanup commitment.
  - Blind spot: No measurement of actual orphan frequency in prod.
- **Decision**: FIXED (Fix A applied — added storage cleanup on profile update failure)

### F4 — Username collision with existing routes not addressed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Profile Creation (username validation), Phase 8 — Public Profiles
- **Detail**: Plan creates public profiles at `/@username` via `[username].astro` dynamic route. No validation prevents users from registering usernames that conflict with existing routes like "dashboard", "profile", "api", "auth". Astro's file-based routing prioritizes static files over dynamic routes, so `/dashboard` beats `/[username].astro`. But a user named "dashboard" creates confusion — their profile link `/@dashboard` navigates to the catalog instead of their profile. Same for "tricks" (conflicts with `/tricks/[slug]`).
- **Fix A ⭐ Recommended**: Add reserved username validation at profile creation
  - Strength: Prevents routing confusion before it happens. Simple blocklist: ["dashboard", "profile", "api", "auth", "tricks", "admin"]. Shows "Username reserved by the system" error inline with other validation (same UX as "Username taken").
  - Tradeoff: Slightly more validation logic in CreateProfileForm and API route. Must keep reserved list in sync with new top-level routes.
  - Confidence: HIGH — common pattern in user-facing URL systems (GitHub, Twitter, etc. all reserve paths).
  - Blind spot: What if a route is added later? Reserved list becomes stale. Consider a shared constant or doc comment linking routes.
- **Fix B**: Accept collision risk and document expected behavior
  - Strength: No code changes. Trust Astro's routing priority and assume users entering "dashboard" as a dog name is rare edge case.
  - Tradeoff: Confusing UX if it happens; support burden. No programmatic prevention.
  - Confidence: LOW — conflicts are likely (dashboard, tricks, admin are plausible dog nicknames or online handles).
  - Blind spot: Frequency unknown without user testing.
- **Decision**: FIXED (Fix A applied — added reserved username blocklist to client and server validation)

### F5 — Supabase Storage getPublicUrl() API structure unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Photo Upload, step 3
- **Detail**: Plan assumes Supabase Storage's getPublicUrl() returns a nested structure: `const { data: { publicUrl } } = supabase.storage.from(...).getPublicUrl(...)`. This codebase has never used Supabase Storage before (only auth). The installed @supabase/supabase-js is v2.99.1, but return structure hasn't been tested. API shape has changed across v1 → v2 major versions. If the actual structure is `{ publicUrl }` (flat) or `{ data: { url } }` (different key), Phase 3 step 3 breaks at runtime. Plan includes manual verification in Phase 3.8 "Verify Storage API return structure" but doesn't block earlier phases if this hasn't been tested yet.
- **Fix**: Test getPublicUrl() structure BEFORE implementing Phase 3 step 3
  - Strength: Catches API shape mismatch early (5 min test vs mid-phase debugging). Simple verification: create scratch file, call getPublicUrl(), console.log() the result, confirm nested data.publicUrl exists.
  - Tradeoff: Requires manual pre-work before Phase 3. But Phase 3.8 already requires this, so just reorder the verification to happen first.
  - Confidence: HIGH — sub-agent confirmed no existing Storage usage, so this is the first integration point. Must verify before relying on it.
  - Blind spot: None significant.
- **Decision**: FIXED (Added pre-implementation verification requirement to Phase 3 step 3)
