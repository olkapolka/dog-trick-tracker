# Critical Access and Failure-Path Floor — Plan Brief

> Full plan: `context/changes/testing-critical-access-failure-floor/plan.md`
> Research: `context/changes/testing-critical-access-failure-floor/research.md`

## What & Why

This rollout phase implements the first testing floor from the project test plan for risks #1, #3, and #5 using integration + focused unit tests. The goal is to protect the highest-impact access, authorization, and failure-path behaviors before broader test expansion. It prioritizes assertions that prove user-visible and security-significant behavior, not implementation details.

## Starting Point

The app already enforces auth and ownership in production code (middleware + endpoint filters + RLS), but the automated test surface is sparse and concentrated in `src/lib/*.test.ts`. Research found a key asymmetry: API routes often expose explicit error semantics, while SSR loaders/helpers can collapse failures into empty/zero outcomes.

## Desired End State

When this plan is complete, critical session transitions and protected-route access are guarded by integration tests, cross-user mutation attempts are denied in both endpoint and DB policy layers, and failure states are clearly distinguished from legitimate empty/zero states. The test-plan cookbook is updated with practical recipes from shipped work so later phases can reuse proven patterns quickly.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Test harness shape | Hybrid harness (in-process integration + runtime smoke) | Balances realistic auth/session signal with manageable runtime cost for Phase 1. | Plan |
| SSR failure behavior | Explicit fallback state distinct from empty state | Directly addresses risk #3 and prevents silent-failure false success. | Plan |
| Helper error contract | Distinct error outcomes for helper failures | Avoids collapsing errors into valid business outputs like `0` or `false`. | Plan |
| Ownership abuse proof depth | Endpoint ownership assertions + RLS backstop checks | Provides defense-in-depth evidence for risk #5 without full combinatorial matrix cost. | Plan |
| Sequencing strategy | Thin bootstrap then immediate high-risk assertions | Delivers meaningful protection early while keeping setup effort controlled. | Plan |
| Verification depth | Automated checks + targeted manual confirmation | Preserves repeatability while validating realistic session and denial semantics. | Plan |

## Scope

**In scope:**
- Minimal harness to run integration + focused unit tests.
- Risk #1 session/access continuity scenarios.
- Risk #5 ownership-denial scenarios including RLS backstops.
- Risk #3 failure-vs-empty distinction scenarios across SSR + helpers.
- Section 6 cookbook updates in `context/foundation/test-plan.md`.

**Out of scope:**
- Broad E2E matrix across all product surfaces.
- Privacy-policy redesign for intentionally broad read surfaces.
- Rollout phases for risks #2, #4, and #6.

## Architecture / Approach

The rollout is structured as five phases: establish minimal harness capability, then land risk protections in priority order (#1 then #5 then #3), then codify reusable patterns in the test-plan cookbook. Integration coverage focuses on middleware/API/RLS boundaries, while focused unit tests pin helper error contracts where ambiguity currently exists.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Harness Bootstrap | Minimal runnable integration + focused unit setup | Overbuilding infra before protections land |
| 2. Risk #1 Access Continuity | Session-transition and protected-route continuity assertions | Auth regressions hidden by happy-path checks |
| 3. Risk #5 Ownership Denial | Cross-user mutation denial with endpoint + RLS proof | IDOR-style mutation leak |
| 4. Risk #3 Failure Distinction | Explicit failure-vs-empty/zero contracts in tests | Silent failure appearing as valid empty output |
| 5. Cookbook Capture | Section 6 shipped test recipes and continuation clarity | Knowledge loss and repeated anti-patterns |

**Prerequisites:** local Supabase test fixtures available, ability to run middleware-aware integration tests, baseline lint/typecheck commands working.
**Estimated effort:** ~2-3 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Assumes chosen helper error contract can be introduced without blocking upstream page/API consumers.
- Assumes local integration harness can model session/cookie transitions with sufficient fidelity.
- Assumes targeted manual checks remain feasible each phase to satisfy continuation gating.

## Success Criteria (Summary)

- Critical auth/session transitions and protected-route gating are covered by reliable integration tests.
- Cross-user mutation attempts are denied and validated at both endpoint and RLS layers.
- Failure states are tested as distinct from legitimate empty/zero states, with cookbook guidance updated for reuse.