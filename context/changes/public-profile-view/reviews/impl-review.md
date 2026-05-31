<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Public Profile View

- **Plan**: [context/changes/public-profile-view/plan.md](context/changes/public-profile-view/plan.md)
- **Scope**: Phases 1-5 (All)
- **Date**: 2026-05-31
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical / 3 warnings / 2 observations (all resolved)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | WARNING ⚠️ |
| Architecture | PASS ✅ |
| Pattern Consistency | WARNING ⚠️ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Friends page uses separate queries instead of JOINs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: [src/pages/friends.astro](src/pages/friends.astro#L14-L50)
- **Detail**: Plan specified using Supabase JOIN syntax via foreign key relationships: `supabase.from("follows").select("following_id, profiles!follows_following_id_fkey(login_name, dog_name)")`. Implementation uses separate queries (4 DB calls instead of 2) with manual JavaScript joining. Functionally equivalent but architecturally different.
- **Fix A ⭐ Recommended**: Refactor to use the planned JOIN approach
  - Strength: Matches plan intent; reduces DB calls from 4 to 2; reduces network latency; eliminates manual null-checking in template.
  - Tradeoff: Requires editing the query code (~10 lines changed).
  - Confidence: HIGH — JOIN syntax is well-documented in Supabase and matches the plan's explicit contract.
  - Blind spot: None significant.
- **Fix B**: Document as addendum
  - Strength: Preserves working code; updates plan to match reality.
  - Tradeoff: Keeps suboptimal query pattern; sets precedent for drift.
  - Confidence: MEDIUM — works now but performance gap may widen with scale.
  - Blind spot: Impact on future similar features (will they copy this pattern?).
- **Decision**: REVERTED (JOIN syntax doesn't work - foreign keys point to auth.users, not profiles. Separate queries with pagination is the correct approach.)

### F2 — Missing pagination on followers/following lists

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality (Performance)
- **Location**: [src/pages/friends.astro](src/pages/friends.astro#L17)
- **Detail**: All follow relationships loaded at once with no LIMIT/OFFSET. For users with hundreds of follows, this causes slow page loads, large DOM trees, and excessive memory usage.
- **Fix A ⭐ Recommended**: Implement pagination now
  - Strength: Prevents performance degradation as usage grows; follows NFR (performance) from PRD; sets good pattern for similar lists.
  - Tradeoff: Adds complexity (pagination UI + state management); MVP scope increase (~1-2 hours work).
  - Confidence: MEDIUM — PRD NFR states "anticipate growth" but didn't mandate pagination in first version.
  - Blind spot: Don't know current user behavior (how many follows typical users have). If median is <50, this may be premature.
- **Fix B**: Defer to post-MVP
  - Strength: Keeps MVP lean; addresses only when data proves it's needed.
  - Tradeoff: Risk of bad UX if early adopters have large friend lists; harder to add pagination after users expect instant full lists.
  - Confidence: MEDIUM — depends on whether power users exist at launch.
  - Blind spot: Launch timeline and user acquisition strategy unknown.
- **Decision**: FIXED via Fix A

### F3 — /friends route not in middleware PROTECTED_ROUTES

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: [src/middleware.ts](src/middleware.ts#L4)
- **Detail**: `/friends` checks auth in-page but isn't listed in `PROTECTED_ROUTES`. Other authenticated pages (`/dashboard`, `/profile`) use middleware protection for defense-in-depth. Current pattern from AGENTS.md: "Add new protected paths to the PROTECTED_ROUTES array — do not implement auth checks inline."
- **Fix**: Add "/friends" to PROTECTED_ROUTES array in middleware.ts
- **Decision**: FIXED

### F4 — Public follow visibility via RLS policy

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Security)
- **Location**: [supabase/migrations/20260531000001_create_follows_table.sql](supabase/migrations/20260531000001_create_follows_table.sql#L17)
- **Detail**: RLS policy "Follows are publicly readable" uses `USING (true)`, allowing anyone (even unauthenticated) to query who follows whom. This matches PRD's access control ("users can see who follows a profile"), but worth confirming intentional since it's broader than typical social networks.
- **Fix**: No action needed if intentional; otherwise restrict to authenticated users or parties involved in the relationship.
- **Decision**: FIXED (restricted to authenticated users via `auth.uid() IS NOT NULL`)

### F5 — API endpoints not in middleware protection

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: [src/pages/api/follow.ts](src/pages/api/follow.ts), [src/pages/api/unfollow.ts](src/pages/api/unfollow.ts)
- **Detail**: New API endpoints check auth in handlers rather than via PROTECTED_ROUTES. This matches [src/pages/api/tricks/status.ts](src/pages/api/tricks/status.ts) pattern, but `/api/tricks` is also in PROTECTED_ROUTES for defense-in-depth.
- **Fix**: Add "/api/follow" and "/api/unfollow" to PROTECTED_ROUTES for consistency with `/api/tricks` pattern.
- **Decision**: FIXED

## Success Criteria Verification

### Automated Checks (All Phases)
- ✅ ESLint: PASS
- ✅ TypeScript compilation: PASS
- ✅ Build: PASS

### Manual Checks (All Phases)
- ✅ All Progress items marked `[x]` with commit SHAs
- ✅ User confirmed manual testing complete for all phases

## Summary

**Implementation Quality:** The implementation is generally solid with good security practices, proper error handling, and consistent patterns. All planned features were implemented successfully.

**Key Strengths:**
- Database schema with proper constraints and RLS policies
- API endpoints follow established patterns
- Optimistic UI with error rollback
- Mobile-responsive navigation
- Complete test coverage per plan

**Areas for Attention:**
1. **Plan drift in data fetching approach** — Friends page uses separate queries instead of JOINs as specified
2. **Missing pagination** — Could cause performance issues as user base grows
3. **Pattern inconsistency** — `/friends` route and new API endpoints lack middleware-level protection

**Recommendation:** Address F3 (PROTECTED_ROUTES) immediately as it's a quick fix that improves consistency. Consider F1 (JOINs) for alignment with plan intent. Evaluate F2 (pagination) based on expected user behavior at launch.
