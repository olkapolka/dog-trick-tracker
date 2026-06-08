# Critical Access and Failure-Path Floor Implementation Plan

## Overview

Implement rollout Phase 1 from `context/foundation/test-plan.md` for risks #1, #3, and #5 using integration + focused unit tests, sequenced by cost x signal and risk priority. The plan establishes a minimum viable test harness, lands high-signal auth/ownership/failure-path assertions, and updates cookbook guidance in section 6 of the test plan.

## Current State Analysis

The codebase has strong production logic for auth gating and ownership scoping but sparse automated test coverage outside `src/lib/*.test.ts`. Current behavior patterns are asymmetrical: API handlers usually return explicit errors, while SSR loaders and helper contracts often collapse failures into empty/zero outcomes.

Key constraints and realities:
- Middleware is the primary guard and auth hydration point for protected routes and API locals.
- Endpoint ownership is scoped server-side and reinforced by RLS on `follows` and `user_tricks`.
- Existing test command only runs `src/lib/*.test.ts`; no established integration command is currently defined.

## Desired End State

After this rollout phase:
- Risk #1 is protected by integration tests proving authenticated access continuity through signin/signout/session transitions, protected-page gating, and profile-creation redirects.
- Risk #5 is protected by integration security scenarios proving cross-user mutation attempts are denied by endpoint ownership filters and RLS backstops.
- Risk #3 is protected by focused unit + integration assertions proving failure states are distinct from legitimate empty/zero states.
- `context/foundation/test-plan.md` section 6 is updated with shipped cookbook patterns from this phase.

Verification of completion:
- New automated test suites run in CI-ready commands and pass.
- Manual checks confirm real session transition behavior and denial semantics.
- Cookbook entries in section 6 reflect concrete, repeatable patterns from shipped tests.

### Key Discoveries:

- `src/middleware.ts` is the load-bearing auth/session hydration and route gate for both page and API surfaces.
- `src/pages/dashboard.astro`, `src/pages/profile.astro`, and `src/pages/friends.astro` currently read query data without explicit query-error handling branches.
- `src/lib/calculate-score.ts` and `src/lib/admin.ts` currently allow error/value ambiguity (error can look like legitimate `0` or `false`).
- `src/pages/api/follow.ts`, `src/pages/api/unfollow.ts`, `src/pages/api/tricks/status.ts`, and `src/pages/api/profile/upload-photo.ts` enforce ownership with user-derived filters.
- RLS policies in `supabase/migrations/20260526132227_create_user_tricks_table.sql` and `supabase/migrations/20260531000001_create_follows_table.sql` provide DB-level ownership backstops.

## What We're NOT Doing

- Building full browser E2E coverage for all flows in this phase.
- Changing product privacy policy semantics for intentionally broad read surfaces.
- Reworking unrelated feature logic outside risk #1, #3, #5 protections.
- Completing later test rollout phases (#2, #4, #6 risks) from section 3 of `test-plan.md`.

## Implementation Approach

Use a thin bootstrap followed immediately by high-priority risk assertions:
1. Create only the minimum test harness needed to run integration and focused unit tests.
2. Land risk #1 and #5 integration protection next (highest impact).
3. Land risk #3 failure-state distinction tests with explicit oracle contracts.
4. Close by codifying reusable cookbook patterns in test-plan section 6.

This sequencing maximizes early protection while avoiding premature overbuilding.

## Critical Implementation Details

Middleware-hydrated `context.locals.user` is a non-obvious dependency for protected API behavior in this codebase. Integration tests for auth and ownership must include middleware participation (or a harness that faithfully reproduces middleware-populated locals), otherwise they can pass while missing real session transition regressions.

## Phase 1: Harness Bootstrap for Integration + Focused Unit

### Overview

Establish the smallest test harness and command surface required to execute integration scenarios (middleware + API + local Supabase context) and focused helper unit tests.

### Changes Required:

#### 1. Test Command Surface

**File**: `package.json`

**Intent**: Define explicit scripts for focused unit and integration suites, preserving existing lib unit runner behavior.

**Contract**: Add deterministic scripts for integration and focused helper tests so Phase 2-4 verification can run under named commands without ad hoc invocation.

#### 2. Integration Test Utilities

**File**: `src/test/integration/*` (new utilities)

**Intent**: Provide reusable fixtures for session/cookie setup, request construction, middleware execution, and DB cleanup for risk scenarios.

**Contract**: Utility layer must support in-process integration flows and one runtime-backed smoke path for session transitions.

### Success Criteria:

#### Automated Verification:

- Integration test command executes with passing bootstrap smoke test.
- Focused unit test command executes with passing baseline test.
- Type checking passes: `npm run typecheck`.
- Linting passes: `npm run lint`.

#### Manual Verification:

- Confirm local test environment can reset fixture state reproducibly.
- Confirm runtime-backed smoke path can run once end-to-end without manual patching.

### Risk Grounding

- **Behavior asserted**: Test harness reliably exercises middleware-aware integration paths and focused helper units.
- **Regression caught**: False confidence from tests that bypass real auth/session wiring.
- **Research source**: `context/changes/testing-critical-access-failure-floor/research.md` (middleware and runner findings).
- **Edge/error/boundary case**: Session fixture setup with and without valid auth cookies.
- **Anti-pattern avoided**: Test infrastructure overbuild before first risk protection lands.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Risk #1 Access Continuity Scenarios

### Overview

Add integration tests that prove authenticated users retain expected access through signin/session transitions, and that protected page/API gating is correct for unauthenticated and profile-missing states.

### Changes Required:

#### 1. Middleware Access Continuity Tests

**File**: `src/test/integration/auth-access/*.test.ts` (new)

**Intent**: Validate protected-route behavior across authenticated, unauthenticated, and profile-incomplete conditions.

**Contract**: Assertions cover `/dashboard`, `/profile`, `/friends` and profile-creation flow redirects via middleware behavior.

#### 2. Signin/Signout Transition Tests

**File**: `src/test/integration/auth-transitions/*.test.ts` (new)

**Intent**: Validate signin redirect contract and signout access teardown contract.

**Contract**: Verify signin redirects to `/profile/create` when profile is missing and to return target or dashboard otherwise; verify signout removes protected access to route/API surfaces.

### Success Criteria:

#### Automated Verification:

- Integration tests assert unauthenticated requests to protected routes redirect to `/auth/signin`.
- Integration tests assert profile-missing authenticated requests redirect to `/profile/create` for protected flows.
- Integration tests assert signin redirect contract behavior for profile present vs absent.
- Integration tests assert signout transition denies subsequent protected page/API access.
- Type checking passes: `npm run typecheck`.
- Linting passes: `npm run lint`.

#### Manual Verification:

- Perform signin as a profile-complete user and confirm protected page access persists across immediate navigation.
- Perform signin as a profile-missing user and confirm forced redirect to profile creation path.
- Perform signout and confirm protected page and protected API are denied on next request.

### Risk Grounding

- **Behavior asserted**: Authenticated users consistently reach protected screens through session transitions; unauthorized requests are gated.
- **Regression caught**: Middleware/session regressions that silently break protected-route continuity.
- **Research source**: `context/changes/testing-critical-access-failure-floor/research.md` (risk #1 findings) plus `src/middleware.ts`, `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signout.ts`.
- **Edge/error/boundary case**: Valid session with missing profile, and post-signout immediate access attempt.
- **Anti-pattern avoided**: Happy-path-only auth checks.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Risk #5 Ownership Denial Scenarios

### Overview

Add integration security tests proving cross-user mutation attempts are denied by endpoint ownership filters and RLS policies for follows and trick-status write paths.

### Changes Required:

#### 1. Endpoint Ownership Integration Tests

**File**: `src/test/integration/ownership-endpoints/*.test.ts` (new)

**Intent**: Verify follow/unfollow/trick-status/photo endpoints enforce user-scoped mutations and denial semantics.

**Contract**: Tests must assert actor A cannot mutate as actor B, including idempotent unfollow semantics and target-user validation behavior.

#### 2. RLS Backstop Tests

**File**: `src/test/integration/ownership-rls/*.test.ts` (new)

**Intent**: Confirm DB policies deny cross-user writes even if endpoint filtering is bypassed or regresses.

**Contract**: Target `follows` and `user_tricks` write policy behavior with controlled fixtures and explicit denial expectations.

### Success Criteria:

#### Automated Verification:

- Integration tests assert cross-user follow/unfollow mutation attempts are denied or scoped to authenticated actor only.
- Integration tests assert trick status writes cannot persist for another user ID.
- Integration tests assert RLS denial for unauthorized `follows` and `user_tricks` write attempts.
- Integration tests assert no auth-only false positive by including ownership dimension in each denial scenario.
- Type checking passes: `npm run typecheck`.
- Linting passes: `npm run lint`.

#### Manual Verification:

- With two users, attempt cross-user follow/unfollow/status operations and confirm denial semantics.
- Validate denied operations do not mutate target user state in DB.

### Risk Grounding

- **Behavior asserted**: Unauthorized ownership/action attempts are denied consistently.
- **Regression caught**: IDOR-style mutation leak when endpoint filtering or policy assumptions drift.
- **Research source**: `context/changes/testing-critical-access-failure-floor/research.md` (risk #5 findings), endpoint files under `src/pages/api/`, and RLS migrations under `supabase/migrations/`.
- **Edge/error/boundary case**: Authenticated actor attempts mutation on existing target resource owned by another user.
- **Anti-pattern avoided**: Auth-only tests without ownership assertions.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Risk #3 Failure-State Distinction Contracts

### Overview

Add focused unit and integration assertions proving failure states are explicitly distinguishable from legitimate empty/zero states across SSR queries and helper contracts.

### Changes Required:

#### 1. Helper Contract Focused Unit Tests

**File**: `src/lib/calculate-score.test.ts`, `src/lib/admin.test.ts` (new or expanded)

**Intent**: Assert explicit helper behavior for query failure vs valid empty/false states.

**Contract**: Tests must encode distinct oracle expectations for error outcomes, not infer expected values by replaying implementation logic.

#### 2. SSR Failure-Path Integration Tests

**File**: `src/test/integration/failure-states/*.test.ts` (new)

**Intent**: Validate dashboard/profile/friends required queries produce explicit fallback/error behavior on failure, distinct from empty-state rendering.

**Contract**: Cover at least one required-query failure per page and assert rendered contract is observably different than no-data scenarios.

### Success Criteria:

#### Automated Verification:

- Focused unit tests assert helper query error output is distinguishable from valid zero/false business outcomes.
- Integration tests assert required SSR query failures render explicit fallback/error contract, not empty-state contract.
- Integration tests assert legitimate empty/zero states still render normal empty-state UX.
- Type checking passes: `npm run typecheck`.
- Linting passes: `npm run lint`.

#### Manual Verification:

- Trigger a controlled data-query failure path and confirm user-visible fallback differs from empty-state copy.
- Validate normal empty-data case still shows expected empty-state behavior and not failure state.

### Risk Grounding

- **Behavior asserted**: Failure states are distinguishable from genuinely empty or zero states.
- **Regression caught**: Silent failure paths that appear as successful empty output.
- **Research source**: `context/changes/testing-critical-access-failure-floor/research.md` (risk #3 findings), `src/pages/dashboard.astro`, `src/pages/profile.astro`, `src/pages/friends.astro`, `src/lib/calculate-score.ts`, `src/lib/admin.ts`.
- **Edge/error/boundary case**: DB query error with otherwise valid authenticated context.
- **Anti-pattern avoided**: Implementation-mirror assertions.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Cookbook Capture and Gate Sync

### Overview

Update test-plan section 6 with reusable patterns proven in this rollout, and ensure downstream continuation is unambiguous for execution handoff.

### Changes Required:

#### 1. Test Plan Section 6 Cookbook Update

**File**: `context/foundation/test-plan.md`

**Intent**: Replace Phase 1 placeholders with concrete recipes for unit, integration, endpoint ownership, and failure-path assertions.

**Contract**: Section 6 updates must include:
- how to add integration auth/session continuity tests,
- how to add ownership-denial tests with endpoint + RLS layering,
- how to add failure-state distinction tests without implementation-mirror oracles,
- short lessons in section 6.6 tied to this rollout.

#### 2. Phase Completion Handoff

**File**: `context/changes/testing-critical-access-failure-floor/plan.md` (progress update during implementation)

**Intent**: Ensure downstream execution uses explicit phase checkpoints and continuation command conventions.

**Contract**: Progress checkboxes for completed items updated with commit SHAs; continuation command remains `/10x-implement testing-critical-access-failure-floor phase 1` for the first execution step.

### Success Criteria:

#### Automated Verification:

- Linting and type checks pass after cookbook/documentation updates where applicable.
- Progress section reflects phase task granularity required for downstream implementation tracking.

#### Manual Verification:

- Human reviewer confirms section 6 cookbook entries are actionable and match shipped test patterns.
- Human reviewer confirms continuation command and phase sequencing are clear for immediate execution.

### Risk Grounding

- **Behavior asserted**: Shipped test patterns are captured and reusable for future rollout phases.
- **Regression caught**: Loss of learned test strategy leading to repeated anti-patterns in later phases.
- **Research source**: `context/foundation/test-plan.md` section 3+6 and `context/changes/testing-critical-access-failure-floor/research.md`.
- **Edge/error/boundary case**: Cookbook guidance for ambiguous error-vs-empty assertions.
- **Anti-pattern avoided**: Undocumented ad hoc testing patterns.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering rollout Phase 1 complete.

---

## Testing Strategy

### Unit Tests:

- Helper contract tests for score/admin error distinction.
- Guardrail tests ensuring valid empty/zero states remain correctly represented.

### Integration Tests:

- Middleware + auth transition scenarios for protected routes and API boundaries.
- Ownership-denial scenarios across follow/unfollow/trick-status/photo endpoints.
- RLS backstop denial scenarios on `follows` and `user_tricks` write paths.
- SSR failure-state distinction scenarios for required query failures.

### Manual Testing Steps:

1. Validate signin/profile-creation/signout transitions against protected pages and API endpoints.
2. Validate cross-user mutation denials with two-user fixtures and DB state checks.
3. Validate failure-state fallback rendering versus legitimate empty/zero outputs.
4. Validate cookbook entries in section 6 are precise enough to apply to a new test in one pass.

## Performance Considerations

- Keep integration suite scoped to high-signal critical flows to control runtime.
- Use focused fixtures and deterministic setup/teardown to reduce flaky retries.
- Prefer narrow RLS denial checks over exhaustive actor matrices in this phase.

## Migration Notes

- No schema migration is required for this planning phase.
- Existing Supabase migrations and policies are used as the authorization baseline for tests.

## References

- Related research: `context/changes/testing-critical-access-failure-floor/research.md`
- Test plan strategy and risk map: `context/foundation/test-plan.md`
- Similar implementation structure: `context/archive/2026-06-02-admin-trick-crud/plan.md`
- Similar implementation structure: `context/archive/2026-05-31-public-profile-view/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Harness Bootstrap for Integration + Focused Unit

#### Automated

- [x] 1.1 Integration test command executes with passing bootstrap smoke test — 2c69a9a
- [x] 1.2 Focused unit test command executes with passing baseline test — 2c69a9a
- [x] 1.3 Type checking passes: `npm run typecheck` — 2c69a9a
- [x] 1.4 Linting passes: `npm run lint` — 2c69a9a

#### Manual

- [x] 1.5 Confirm local test environment can reset fixture state reproducibly — 2c69a9a
- [x] 1.6 Confirm runtime-backed smoke path can run once end-to-end without manual patching — 2c69a9a

### Phase 2: Risk #1 Access Continuity Scenarios

#### Automated

- [x] 2.1 Unauthenticated requests to protected routes redirect to `/auth/signin` — 27f6595
- [x] 2.2 Profile-missing authenticated requests redirect to `/profile/create` for protected flows — 27f6595
- [x] 2.3 Signin redirect contract holds for profile present vs absent — 27f6595
- [x] 2.4 Signout transition denies subsequent protected page/API access — 27f6595
- [x] 2.5 Type checking passes: `npm run typecheck` — 27f6595
- [x] 2.6 Linting passes: `npm run lint` — 27f6595

#### Manual

- [x] 2.7 Confirm profile-complete signin preserves protected page access across immediate navigation — 27f6595
- [x] 2.8 Confirm profile-missing signin redirects to profile creation path — 27f6595
- [x] 2.9 Confirm signout denies protected page and protected API on next request — 27f6595

### Phase 3: Risk #5 Ownership Denial Scenarios

#### Automated

- [x] 3.1 Cross-user follow/unfollow mutation attempts are denied or scoped to authenticated actor only — ae9069b
- [x] 3.2 Trick status writes cannot persist for another user ID — ae9069b
- [x] 3.3 RLS denies unauthorized `follows` write attempts — ae9069b
- [x] 3.4 RLS denies unauthorized `user_tricks` write attempts — ae9069b
- [x] 3.5 Ownership dimension is asserted in every denial scenario (no auth-only false positives) — ae9069b
- [x] 3.6 Type checking passes: `npm run typecheck` — ae9069b
- [x] 3.7 Linting passes: `npm run lint` — ae9069b

#### Manual

- [x] 3.8 Confirm cross-user follow/unfollow/status operations are denied in two-user fixtures — ae9069b
- [x] 3.9 Confirm denied operations do not mutate target user state in DB — ae9069b

### Phase 4: Risk #3 Failure-State Distinction Contracts

#### Automated

- [x] 4.1 Helper query error output is distinguishable from valid zero/false business outcomes — 8445818
- [x] 4.2 Required SSR query failures render explicit fallback/error contract — 8445818
- [x] 4.3 Legitimate empty/zero states render normal empty-state UX — 8445818
- [x] 4.4 Type checking passes: `npm run typecheck` — 8445818
- [x] 4.5 Linting passes: `npm run lint` — 8445818

#### Manual

- [x] 4.6 Confirm controlled query failure shows user-visible fallback distinct from empty-state copy — 8445818
- [x] 4.7 Confirm normal empty-data case still shows expected empty-state behavior — 8445818

### Phase 5: Cookbook Capture and Gate Sync

#### Automated

- [x] 5.1 Linting and type checks pass after cookbook/documentation updates where applicable
- [x] 5.2 Progress section reflects phase task granularity for downstream tracking

#### Manual

- [ ] 5.3 Confirm section 6 cookbook entries are actionable and match shipped test patterns
- [ ] 5.4 Confirm continuation command and phase sequencing are clear for immediate execution