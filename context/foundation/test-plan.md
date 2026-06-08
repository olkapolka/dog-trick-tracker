# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (sections 1-5); cookbook patterns at the bottom (section 6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run /10x-test-plan --refresh when stale (see section 8).
>
> Last updated: 2026-06-03

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. Cost x signal. The cheapest test that gives a real signal for the risk wins. Do not default to end-to-end checks when integration tests can catch the same breakage cheaper.
2. User concerns are first-class evidence. Risks raised directly by the team carry the same weight as PRD and churn data.
3. Risks are scenarios, not code locations. This plan documents what can fail and why it is likely. It does not claim which specific line owns the failure. That grounding is produced per rollout phase by research.

Hot-spot scope used for likelihood weighting: src, supabase.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by risk = impact x likelihood.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence - not anchor) |
|---|---|---|---|---|
| 1 | Logged-in users lose access to dashboard/profile statistics after auth or session changes | High | High | PRD access control, interview Q1 and Q3, hot-spot dirs src/pages (71 commits/30d), src/middleware.ts (7 commits/30d) |
| 2 | Migration state drift causes schema/runtime mismatch and breaks core profile/trick flows | High | Medium | Interview Q2, hot-spot dir supabase/migrations (25 commits/30d), archived rollout history |
| 3 | Error and fallback paths fail silently while happy-path checks still pass | High | High | Interview Q4, sparse test-base profile, hot-spot dirs src/pages and src/components |
| 4 | Weighted progress score becomes inconsistent after status or difficulty-related changes | High | Medium | PRD business rule on weighted scoring, first-trick and admin archived slice plans |
| 5 | Authenticated user can access or mutate data they do not own (authorization abuse/IDOR class) | High | Medium | PRD privacy + access control, interview auth concern, shared-profile surface |
| 6 | Admin trick write paths regress and cause user-visible catalog inconsistencies | Medium | Medium | PRD admin capabilities, archived admin CRUD implementation scope |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context research must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Authenticated users consistently reach protected screens through session transitions | Signed in once means all protected routes are safe | Session lifecycle and guard behavior boundaries | Integration | Happy-path-only auth tests |
| #2 | Migration sequence yields expected runtime behavior, not only successful command exit | Migration applied means behavior is correct | Migration ordering, required constraints, rollback assumptions | Migration verification + integration | Exit-code-only checks |
| #3 | Failure states show explicit and correct fallback behavior | No crash means acceptable UX | Error translation and fallback rendering rules | Integration | Oracle copied from implementation |
| #4 | Score changes always match independent difficulty/status rules | Current score output is the truth source | Rule source, recalculation triggers, mutation boundaries | Unit + focused integration | Mirroring production calculation in assertions |
| #5 | Unauthorized ownership/action attempts are denied consistently | Logged in equals authorized for target resource | Ownership scoping and denial behavior | Integration security scenarios | Auth-only tests without ownership checks |
| #6 | Admin writes succeed only for admins and preserve user-facing consistency | One endpoint check protects all privileged paths | Role checks across all write paths, soft-delete visibility rules | API integration | Over-mocking role checks |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Critical access and failure-path floor | Defend access and fallback behavior for highest-risk flows | #1, #3, #5 | integration + focused unit | implementing | context/changes/testing-critical-access-failure-floor/ |
| 2 | Data integrity and scoring invariants | Protect migration/runtime integrity and weighted-score correctness | #2, #4 | migration verification + integration + unit | not started | - |
| 3 | Privileged write-path hardening | Contain admin write-path regressions and role-boundary leaks | #6, #5 | API integration + selective end-to-end | not started | - |
| 4 | Quality-gates wiring and cookbook capture | Enforce gates and codify reusable test patterns for future changes | cross-cutting | gates + selective visual/runtime checks | not started | - |

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | Node test + tsx | v22 / tsx 4.x | Bootstrapped in Phase 1 — `npm run test:unit` and `npm run test:integration` |
| API mocking | none (contract layer) | n/a | Use `src/lib/ownership-contracts.ts` and `src/lib/page-state-contracts.ts` pattern instead |
| end-to-end | browser/runtime tooling available | n/a | Use selectively when integration is insufficient |
| accessibility | none yet | n/a | Add only for high-signal critical screens |
| AI-native | none yet | n/a | Add only if deterministic checks miss target signal |

Stack grounding tools (current session):
- Docs: none - no docs MCP exposed in this session; checked: 2026-06-03
- Search: none - no search MCP exposed in this session; checked: 2026-06-03
- Runtime/browser: browser tooling available - selective use for critical flows only; checked: 2026-06-03
- Provider/platform: GitHub-oriented tools available - useful for quality-gate and workflow follow-through; checked: 2026-06-03

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck | local + CI | required | syntactic and type drift |
| unit + integration | local + CI | required after section 3 phase 1 | logic and behavior regressions |
| end-to-end on critical flows | CI on PR | required after section 3 phase 1 | broken critical user paths |
| post-edit hook | local agent loop | recommended after section 3 phase 3 | fast regression detection during edits |
| visual diff deterministic | CI on PR | optional | rendering regressions |
| multimodal visual review | CI on PR | optional | visual issues deterministic diff may miss |
| pre-prod smoke | merge-to-prod window | optional | environment-specific failures |

## 6. Cookbook Patterns

How to add tests in this project. Entries are filled in from Phase 1 of the rollout (commits 2c69a9a → 8445818).

### 6.1 Adding a unit test

**Runner:** `npm run test:unit` — executes `src/lib/*.test.ts` via Node test + tsx.

**Pattern — helper error/empty distinction (from Phase 4, `src/lib/calculate-score.test.ts` and `src/lib/admin.test.ts`):**

1. Build a minimal stub supabase client that returns `{ data: null, error: { message: "..." } }` for the error branch.
2. Call the `*Result` variant of the helper (e.g. `calculateProgressScoreResult`, `getAdminCheckResult`).
3. Assert `result.ok === false` and `result.error` matches expected message.
4. In a separate test, return `{ data: <empty value>, error: null }` and assert `result.ok === true` with the expected zero/false value.
5. Oracle must come from the domain rule, not from replaying the implementation.

Anti-pattern to avoid: asserting `result === 0` when the helper collapsed an error to `0` — use the `*Result` variants so error and empty are structurally different.

### 6.2 Adding an integration test

**Runner:** `npm run test:integration` — executes `src/test/integration/**/*.test.ts` via Node test + tsx.

**Pattern — auth/session contract (from Phase 2, `src/test/integration/auth-access/` and `auth-transitions/`):**

1. Import the relevant function from `src/lib/auth-contracts.ts` (`shouldRedirectToSignIn`, `shouldRedirectToProfileCreate`, `resolveSignInRedirect`).
2. Call it with controlled boolean inputs representing session state.
3. Assert the returned path or boolean matches the PRD-derived contract (not implementation output).
4. Keep each test to one behavior: unauthed redirect, profile-missing redirect, or session teardown.

**Pattern — page failure-state contract (from Phase 4, `src/test/integration/failure-states/page-failure-contracts.test.ts`):**

1. Import the relevant resolver from `src/lib/page-state-contracts.ts`.
2. Call with `{ ...Error: true, ...Count: 0 }` for the error branch — assert `"error"`.
3. Call with `{ ...Error: false, ...Count: 0 }` for the empty branch — assert `"empty"`.
4. Both tests together prove error and empty are structurally distinct.

### 6.3 Adding an end-to-end test

Defer to runtime smoke path in `src/test/integration/utils/runtime-smoke.ts`. Set `TEST_RUNTIME_BASE_URL` and run:

```bash
node --import tsx -e "import { runRuntimeSmoke } from './src/test/integration/utils/runtime-smoke.ts'; ..."
```

Use only when integration layer cannot provide the required signal (e.g. actual cookie exchange or redirect chain across real network hop).

### 6.4 Adding a test for a new API endpoint

**Pattern — ownership scoping (from Phase 3, `src/test/integration/ownership-endpoints/ownership-scoping.test.ts`):**

1. Add a builder function to `src/lib/ownership-contracts.ts` that constructs the write payload/filter from `actorId`.
2. Use that builder in the endpoint handler instead of inline `user.id` references.
3. In the test, call the builder with two distinct actor IDs (A and B) and assert the resulting payloads are structurally scoped to the respective actor.
4. Include an ownership-dimension assertion in every denial scenario — never test auth-only without also asserting the actor scoping.

**Pattern — RLS backstop (from Phase 3, `src/test/integration/ownership-rls/ownership-rls-policies.test.ts`):**

1. `readFileSync` the relevant migration SQL.
2. `assert.match` for the policy name and `WITH CHECK` / `USING` clause containing `auth.uid() = <owner_column>`.
3. One test per write policy (INSERT / UPDATE / DELETE).

Runtime RLS enforcement checks against a live Supabase instance are deferred to Phase 2 rollout (`testing-data-integrity-scoring-invariants`).

### 6.5 Adding a test for migration-sensitive behavior

Defer to Phase 2 rollout (`testing-data-integrity-scoring-invariants`). Pattern will be captured there.

For now: read the migration SQL directly and assert policy clauses with `assert.match` (see §6.4 RLS backstop pattern) as a cheap structural guard before runtime verification.

### 6.6 Per-rollout-phase notes

**Phase 1 — Harness Bootstrap (2c69a9a)**
- Node test + tsx is sufficient for all integration scenarios that don't need a real network hop.
- The runtime smoke helper (`runtime-smoke.ts`) requires `TEST_RUNTIME_BASE_URL` — it skips deterministically when unset, making CI safe without a live server.

**Phase 2 — Access Continuity (27f6595)**
- Extract auth routing rules into pure functions in `src/lib/auth-contracts.ts`; keep page/middleware code thin wiring only.
- Testing the contract function directly is cheaper and more reliable than mocking middleware internals.

**Phase 3 — Ownership Denial (ae9069b)**
- Direct import of Astro API route modules fails in Node runner (`astro:` protocol). Use ownership contract builders (`src/lib/ownership-contracts.ts`) as the testable boundary instead.
- RLS policy structural assertions (reading migration SQL) catch policy regressions without requiring a live DB in unit/integration phase.
- Every denial test must include both the auth check and the ownership dimension — auth-only tests produce false confidence.

**Phase 4 — Failure Distinction (8445818)**
- `calculateProgressScore` and `isAdmin` collapse errors to `0`/`false` by design for callers that just need a number/bool. For test assertions, always use the `*Result` variants (`calculateProgressScoreResult`, `getAdminCheckResult`) which return a tagged union.
- Page state resolvers (`src/lib/page-state-contracts.ts`) are the correct unit-test surface for SSR failure/empty distinction — they are importable without Astro runtime.
- When forcing error state manually: temporarily override `scoreResult` to `{ ok: false, error: "forced" }` in the page frontmatter; revert before committing.

## 7. What We Deliberately Don't Test

- Brittle snapshot tests for low-risk UI content. Reason: low signal and high maintenance noise. Re-evaluate only if UI risk profile changes significantly. Source: interview Q5.

## 8. Freshness Ledger

- Strategy (sections 1-5) last reviewed: 2026-06-03
- Stack versions last verified: 2026-06-03
- AI-native tool references last verified: 2026-06-03

Refresh (/10x-test-plan --refresh) when:
- a new top-3 risk appears from roadmap or archive,
- a recommended tool checked date is older than three months,
- the project stack changes,
- section 7 no longer matches team beliefs.
