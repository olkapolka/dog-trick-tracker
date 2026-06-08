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
| 1 | Critical access and failure-path floor | Defend access and fallback behavior for highest-risk flows | #1, #3, #5 | integration + focused unit | change opened | context/changes/testing-critical-access-failure-floor/ |
| 2 | Data integrity and scoring invariants | Protect migration/runtime integrity and weighted-score correctness | #2, #4 | migration verification + integration + unit | not started | - |
| 3 | Privileged write-path hardening | Contain admin write-path regressions and role-boundary leaks | #6, #5 | API integration + selective end-to-end | not started | - |
| 4 | Quality-gates wiring and cookbook capture | Enforce gates and codify reusable test patterns for future changes | cross-cutting | gates + selective visual/runtime checks | not started | - |

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | none yet | n/a | Sparse test base exists; bootstrap in Phase 1 |
| API mocking | none yet | n/a | Decide with rollout based on cheapest signal |
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

How to add tests in this project. Entries below start as placeholders and are filled as phases ship.

### 6.1 Adding a unit test

TBD - see section 3 phase 1 for score and rule-invariant pattern.

### 6.2 Adding an integration test

TBD - see section 3 phase 1 for auth and fallback behavior pattern.

### 6.3 Adding an end-to-end test

TBD - see section 3 phase 3 for privileged write-path verification pattern.

### 6.4 Adding a test for a new API endpoint

TBD - see section 3 phase 3 for role-boundary and ownership-denial pattern.

### 6.5 Adding a test for migration-sensitive behavior

TBD - see section 3 phase 2 for migration/runtime consistency pattern.

### 6.6 Per-rollout-phase notes

TBD - append short lessons after each phase lands.

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
