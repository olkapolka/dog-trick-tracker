# CI/CD Code Review Workflow — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Add a GitHub Actions workflow that automatically runs an AI code review on every PR targeting `main`, posts a structured comment, and applies a pass/fail label. The review is powered by `packages/code-reviewer`, which needs its input/output schema updated to match the 6-criterion PR-diff review format defined in `requirements.md`.

## Starting Point

`packages/code-reviewer` has a working `ToolLoopAgent` + OpenRouter setup but accepts `{code, language}` input and returns severity-bucketed issues — neither matches the CI requirements. No `.github/actions/` directory exists and no PR-commenting workflow has been written yet.

## Desired End State

Every PR to `main` triggers an advisory review job that fetches the diff, calls the updated `packages/code-reviewer` CLI, posts a markdown table of 6 criterion scores + rationale, and labels the PR `ai-cr:passed` or `ai-cr:failed`. The job never blocks merge — it always shows green in GitHub checks. Adding `ai-cr:review` retriggers the review on demand. Fork PRs receive a single explanatory skip comment.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Pass/fail logic | Model decides (`passed: boolean` in output) | Contextual weighting across 6 criteria is better than a fixed numeric threshold | Plan |
| Advisory-only | `continue-on-error: true` on the GHA job | Review result is communicated via comment + label; the job check must never block merge | Plan |
| Model | `anthropic/claude-sonnet-4.5` via OpenRouter | Explicit user requirement; only change needed in `agent.ts` | Plan |
| Branch target | `main` | Matches existing `ci.yml` / `deploy.yml`; `master` in requirements was a stale reference | Plan |
| Label trigger mechanism | `pull_request_target` + `labeled` | Runs in base-branch context so secrets are available; safe because PR diff is data, not executed code | Research |
| Fork PR handling | Skip with one comment on open | Transparent to contributors; maintainers can add `ai-cr:review` after their own review | Plan |
| Label creation | Idempotent step in composite action | Self-healing — no out-of-band setup required | Plan |
| Diff size | Soft cap at 3 000 LOC with truncation warning | Reviews beyond this line count lose quality; graceful degradation beats opaque API failure | Plan |
| PR description | Included, optional | Negligible token cost; `optional()` in schema handles absent body | Research |
| CLI entrypoint | New `cli.ts`; `index.ts` stays as demo | Separates CI concerns from local demo; `agent.ts` `reviewCode()` is the shared public API | Research |

## Scope

**In scope:** `agent.ts` (model string only), `schemas.ts`, `prompts.ts`, new `cli.ts`, `index.ts` demo update, `package.json` `ci` script, `.github/actions/code-review/action.yml`, `.github/workflows/code-review.yml`

**Out of scope:** `agent.ts` changes, tests, root `package.json`, existing workflows, secret creation automation, promptfoo eval compatibility

## Architecture / Approach

The outer workflow (`code-review.yml`) owns trigger logic and permissions. It calls a composite action (`.github/actions/code-review/action.yml`) which encapsulates all review steps: checkout base SHA, fetch head SHA for diff, run `cli.ts` with diff piped via `GIT_DIFF_FILE`, format a markdown comment via `jq`, apply the result label, and clean up the `ai-cr:review` trigger label. The TypeScript package is invoked as a subprocess — no import or build step, just `node --import tsx src/cli.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. TypeScript Package | Updated schemas + prompts + `cli.ts` that produces valid `ReviewOutput` JSON | ToolLoopAgent structured output must match the new `ReviewOutputSchema` exactly or the agent will loop/fail |
| 2. GHA Infrastructure | Composite action + outer workflow; PR comment + labels working end-to-end | `pull_request_target` safety constraint — must never checkout PR head code |

**Prerequisites:** `OPENROUTER_API_KEY` added to GitHub repository secrets (one-time manual step)  
**Estimated effort:** ~2 focused sessions across 2 phases

## Open Risks & Assumptions

- `pull_request_target` is safe here only as long as the composite action never adds a `checkout` step pointing at the PR's head SHA — this constraint must be preserved in perpetuity
- Very large PRs (bulk moves, generated files) will receive truncated reviews; a diff-filtering step (strip binaries/generated files) would improve quality but is out of scope
- If OpenRouter's `claude-sonnet-4` model changes its output format or context window, the structured output guarantee from `ToolLoopAgent` acts as a guard rail but may need the prompt updated

## Success Criteria (Summary)

- `npm run typecheck` passes in `packages/code-reviewer/` with all schema/prompt changes applied
- Opening a test PR to `main` triggers a complete review job, posts a formatted markdown comment, and applies a pass/fail label
- Adding `ai-cr:review` label retriggers the review and the label is removed automatically after completion
