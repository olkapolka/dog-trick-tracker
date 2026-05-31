<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: User Can Track Their First Trick

- **Plan**: context/changes/first-trick-tracking/plan.md
- **Scope**: All Phases (0-9)
- **Date**: 2026-05-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict    |
| ------------------- | ---------- |
| Plan Adherence      | ⚠️ WARNING |
| Scope Discipline    | ✅ PASS    |
| Safety & Quality    | ❌ FAIL    |
| Architecture        | ✅ PASS    |
| Pattern Consistency | ⚠️ WARNING |
| Success Criteria    | ✅ PASS    |

## Findings

### F1 — Missing 'Other' sex option in profile schema

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality, Plan Adherence
- **Location**: supabase/migrations/20260526132201_create_profiles_table.sql:8, src/components/profile/CreateProfileForm.tsx:212-223
- **Detail**: Plan specified CHECK constraint `(sex IN ('Male', 'Female', 'Other'))` but migration only allows `('Male', 'Female')`. Form component renders only Male/Female radio buttons. This prevents users from selecting 'Other', violating the planned contract and excluding users who don't identify with binary options.
- **Fix A ⭐ Recommended**: Add 'Other' option to both migration and form
  - Strength: Matches plan contract; inclusive design supports all users.
  - Tradeoff: Requires migration alteration. If already applied in production, needs a new migration to ALTER TABLE constraint.
  - Confidence: HIGH — plan explicitly specified this in Phase 0 contract.
  - Blind spot: Unknown if migration has run in production.
- **Fix B**: Update plan to reflect current implementation
  - Strength: Documents actual state; avoids schema change.
  - Tradeoff: Removes inclusive design feature; PRD shows no explicit requirement for 'Other' option, so technically not blocking.
  - Confidence: MEDIUM — removes planned functionality.
  - Blind spot: User feedback on gender options not gathered.
- **Decision**: FIXED via Fix B (plan already documents Male/Female only at lines 121, 429)

### F2 — Memory leak from unreleased blob URLs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/components/profile/PhotoUpload.tsx:31
- **Detail**: `URL.createObjectURL(selectedFile)` creates a blob URL for preview but never calls `URL.revokeObjectURL()`. Each file selection allocates memory that won't be freed until page unload. Users uploading multiple photos in one session could accumulate unreleased blob URLs.
- **Fix**: Add useEffect cleanup to revoke URL when preview changes
  - Strength: Standard React pattern; prevents memory leak.
  - Tradeoff: Minor — adds 4 lines of boilerplate cleanup code.
  - Confidence: HIGH — matches React docs recommendation for blob URLs.
  - Blind spot: None significant.
- **Decision**: FIXED (added useEffect cleanup)

### F3 — Type mismatch hidden by lint suppression

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/lib/calculate-score.ts:10
- **Detail**: Query uses LEFT JOIN which can return null for `tricks` relation, but generated types may not reflect this. Required `// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition` to silence type error on `row.tricks?.difficulty_weight`. This suggests type system doesn't match query reality — could hide bugs if join logic changes.
- **Fix**: Use explicit type annotation for query result
  - Strength: Makes null handling intentional; removes lint suppression.
  - Tradeoff: Requires manual typing instead of relying on generated types.
  - Confidence: MEDIUM — depends on Supabase type generation quirks.
  - Blind spot: Haven't verified if generated types from .select() actually support LEFT JOIN null handling in latest Supabase client.
- **Decision**: FIXED (added UserTrickWithWeight type annotation)

### F4 — Potential race condition on double-click

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/components/profile/PhotoUpload.tsx:39
- **Detail**: Rapid double-clicks on upload button could trigger concurrent uploads if both clicks happen within ~50ms before state updates. The `disabled` state prevents subsequent clicks, but race window exists before first render cycle completes.
- **Fix**: Add pending check at start of handleUpload
  - Strength: Fully eliminates race window; zero extra renders.
  - Tradeoff: Minor — one `if (uploading) return;` guard clause.
  - Confidence: HIGH — standard pattern for preventing concurrent mutations.
  - Blind spot: None significant.
- **Decision**: FIXED (added guard clause)

### F5 — Code duplication between profile pages

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/pages/profile.astro, src/pages/user/[username].astro
- **Detail**: Both files duplicate ~140 lines of profile display logic (photo, dog info, age calculation, progress score, trick grouping). Only difference is profile.astro includes PhotoUpload component. Violates DRY principle; changes to display format require editing both files.
- **Fix A ⭐ Recommended**: Extract shared rendering into ProfileDisplay component
  - Strength: Single source of truth for profile UI; easier maintenance.
  - Tradeoff: Adds abstraction layer; component needs props for edit/readonly.
  - Confidence: MEDIUM — depends on future profile editing plans (currently deferred to post-MVP per plan's "What We're NOT Doing").
  - Blind spot: If profile editing stays deferred long-term, refactor may be premature.
- **Fix B**: Accept duplication as temporary
  - Strength: Zero refactor cost; pages are self-contained.
  - Tradeoff: Maintenance burden if profile display evolves.
  - Confidence: MEDIUM — acceptable for MVP; revisit when editing is added.
  - Blind spot: Risk of divergence if one page is updated without the other.
- **Decision**: FIXED via Fix A (created ProfileDisplay.astro component, updated both pages)

### F6 — Copy link UX differs from plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/profile.astro:165-175
- **Detail**: Plan specified using sonner toast (`toast.success("Profile link copied!")`) but implementation changes button text to "✓ Link copied!" via inline script. Functional difference is minor (both confirm action), but UX is inconsistent with toast notifications used elsewhere (status errors).
- **Fix**: Replace inline text change with sonner toast
  - Strength: Matches plan contract; consistent notification pattern.
  - Tradeoff: Minor — requires importing toast, converting to client component.
  - Confidence: HIGH — sonner already wired up in Layout.astro Phase 6.
  - Blind spot: None significant.
- **Decision**: SKIPPED (user prefers current UX)
