# CI/CD Code Review Workflow Implementation Plan

## Overview

Adapt `packages/code-reviewer` to accept PR diff inputs and return 6-criterion scored reviews, then add a GitHub Actions composite action and outer workflow that triggers on PRs to `main`, posts a formatted review comment, and applies `ai-cr:passed` / `ai-cr:failed` labels. On-demand retrigger is supported via the `ai-cr:review` label.

## Current State Analysis

- `packages/code-reviewer` has a working `ToolLoopAgent` + OpenRouter setup (`agent.ts`) but the wrong input schema (`{code, language}`), wrong output schema (severity-bucketed issues list), and no CLI entrypoint — `index.ts` is a hardcoded demo runner
- No `.github/actions/` directory exists; existing workflows (`ci.yml`, `deploy.yml`) target `main`, use Node 22, and follow a consistent secrets-injection pattern
- `package-lock.json` is present in `packages/code-reviewer/` — `npm ci` will work without issues
- Lessons file mandates exact npm package versions (no `^` or `~`)

## Desired End State

- `packages/code-reviewer` accepts `{ prTitle, prDescription?, gitDiff }` and returns 6 criterion scores plus a model-decided `passed` boolean
- `cli.ts` reads inputs from environment variables, prints `JSON.stringify(ReviewOutput)` to stdout, exits 1 on error
- Any PR opened/updated against `main` triggers a GHA review job; a formatted markdown comment is posted and `ai-cr:passed` or `ai-cr:failed` label is applied
- The review is **advisory only** — the `code-review` job never blocks merge regardless of the `passed` result or any API failure
- Adding `ai-cr:review` label to a PR retriggers the review via `pull_request_target` (safe: cli.ts runs from the base branch, the diff is data only)
- Fork PRs receive a single skip comment on open explaining that a maintainer can add `ai-cr:review` after reviewing the code

### Key Discoveries

- `agent.ts` needs one change: model string `anthropic/claude-sonnet-4` → `anthropic/claude-sonnet-4.5`; everything else (ToolLoopAgent setup, OpenRouter provider, `reviewCode()` signature) is untouched
- `index.ts` stays as a demo runner; `cli.ts` is the new CI entrypoint with no `--env-file` flag (secrets come from the calling environment)
- `pull_request_target` is safe for the label-triggered flow because the code running is checked out from the base branch — the PR diff is passed as a file path argument, never executed
- Exact dependency versions: no `^` or `~` in any new `package.json` entries (lesson)

## What We're NOT Doing

- No tests (none exist, not in scope for this change)
- No changes to root `package.json`, `ci.yml`, or `deploy.yml`
- No pass/fail threshold logic in the workflow (model populates `passed` holistically)
- No branch protection required-check configuration (the review is advisory; that setting lives outside this repo's code)
- No promptfoo eval compatibility (separate concern)
- No automated secret creation (`OPENROUTER_API_KEY` is a one-time manual step — documented in Migration Notes)

## Implementation Approach

Phase 1 updates the TypeScript package's type contract (schemas + prompts) and adds the CLI entrypoint. Phase 2 builds the GHA composite action and outer workflow, relying on Phase 1's `cli.ts` for review execution. The composite action encapsulates all review steps so the outer workflow remains easy to reason about.

## Critical Implementation Details

**`pull_request_target` safety constraint**: The composite action must checkout `inputs.base_sha` (the target branch code) — never the PR head — before running `cli.ts`. The PR diff is written to `/tmp/pr-diff.txt` and passed via `GIT_DIFF_FILE` env var. If the action ever added a `ref: inputs.head_sha` checkout step, it would run untrusted code with repository secrets. The plan avoids this by always checking out the base SHA and fetching only the head SHA for diff computation.

---

## Phase 1: TypeScript Package — PR-aware schemas, prompts, and CLI entrypoint

### Overview

Replace the `{code, language}` input contract and severity-bucketed output with the PR-diff input and 6-criterion scored output defined in `requirements.md`. Add a `cli.ts` CLI entrypoint for CI use. Update `index.ts` so the demo stays type-correct.

### Changes Required

#### 1. `packages/code-reviewer/src/agent.ts`

**Intent**: Update the model string to `anthropic/claude-sonnet-4.5`. All other wiring (ToolLoopAgent, OpenRouter provider, `reviewCode()` function, structured output setup) is untouched.

**Contract**: Line 10 — change `openrouter('anthropic/claude-sonnet-4')` to `openrouter('anthropic/claude-sonnet-4.5')`.

#### 2. `packages/code-reviewer/src/schemas.ts`

**Intent**: Replace the existing schemas with PR-focused types. The old `IssueSchema` is removed. `CriterionSchema` captures a score (1–10 integer) and rationale string. The model populates `passed` holistically — no threshold arithmetic in the workflow.

**Contract**:
```ts
export const ReviewInputSchema = z.object({
  prTitle: z.string().min(1),
  prDescription: z.string().optional(),
  gitDiff: z.string().min(1),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const CriterionSchema = z.object({
  score: z.number().int().min(1).max(10),
  rationale: z.string(),
});

export const ReviewOutputSchema = z.object({
  implementationCorrectness: CriterionSchema,
  idiomaticity: CriterionSchema,
  complexity: CriterionSchema,
  testRiskCoverage: CriterionSchema,
  documentation: CriterionSchema,
  securitySafety: CriterionSchema,
  overallSummary: z.string(),
  passed: z.boolean(),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
```

#### 3. `packages/code-reviewer/src/prompts.ts`

**Intent**: Rewrite the system instructions to describe the 6 required criteria from `requirements.md` (with scoring anchors from the requirements doc), and rewrite `buildReviewPrompt()` to format `prTitle`, `prDescription`, and `gitDiff` as the user prompt. The model must output a `passed` boolean reasoning over all 6 scores holistically.

**Contract**:
- `REVIEW_SYSTEM_INSTRUCTIONS` — instructs the model to score each criterion 1–10, include a `rationale` string per criterion, write an `overallSummary`, and set `passed: true/false`; embeds the 1/10 anchors from `requirements.md` verbatim for each criterion
- `buildReviewPrompt(input: ReviewInput): string` — formats PR title (always), description (only when present), and full diff

#### 4. `packages/code-reviewer/src/cli.ts` (new file)

**Intent**: Thin CLI entrypoint for GHA. Reads `PR_TITLE`, `PR_DESCRIPTION`, and `GIT_DIFF_FILE` from `process.env`, calls `reviewCode()`, and writes `JSON.stringify(result) + '\n'` to stdout. Exits with code 1 on error so the GHA step fails visibly.

**Contract**:
```ts
// Env vars consumed:
//   PR_TITLE        — required; passed from github.event.pull_request.title
//   PR_DESCRIPTION  — optional; passed from github.event.pull_request.body
//   GIT_DIFF_FILE   — path to file containing the git diff
// Output: JSON.stringify(ReviewOutput) + newline on stdout
// On error: stderr message + process.exit(1)
```
Use `fs.readFileSync(process.env.GIT_DIFF_FILE!, 'utf-8')` for the diff (file-based avoids env var size limits on large diffs). No `--env-file` — secrets come from the calling environment.

#### 5. `packages/code-reviewer/src/index.ts`

**Intent**: Update the hardcoded demo input to match the new `ReviewInput` schema so the file remains runnable and type-correct after the schema change.

**Contract**: Replace `{ code, language }` fields with `{ prTitle, prDescription, gitDiff }` using a trivial example diff string (e.g. a one-line function add).

#### 6. `packages/code-reviewer/package.json`

**Intent**: Add a `ci` script that invokes `cli.ts` via `tsx` without `--env-file` (secrets come from the GHA environment, not a `.env` file).

**Contract**: New script alongside existing `start`: `"ci": "node --import tsx src/cli.ts"`

### Success Criteria

#### Automated Verification

- Type checking passes in `packages/code-reviewer/`: `npm run typecheck`

#### Manual Verification

- Running `PR_TITLE="Add login feature" GIT_DIFF_FILE=/tmp/sample.diff npm run ci` (with a real diff file) produces valid JSON on stdout matching the `ReviewOutput` shape (6 criterion objects each with `score` and `rationale`, `overallSummary` string, `passed` boolean)
- `npm start` runs the updated demo without TypeScript or runtime errors

**Implementation Note**: After completing Phase 1 and automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: GitHub Actions Infrastructure

### Overview

Create the composite action (`.github/actions/code-review/action.yml`) and the outer workflow (`.github/workflows/code-review.yml`). The composite action owns all review execution steps. The outer workflow owns triggers, permissions, concurrency, and fork PR handling.

### Changes Required

#### 1. `.github/actions/code-review/action.yml` (new file)

**Intent**: Composite action that encapsulates the full review flow — Node setup, idempotent label creation, dependency install, diff computation with soft cap, running `cli.ts`, posting the formatted comment, applying the result label, and removing the `ai-cr:review` trigger label.

**Contract**:

Inputs (all `required: true` except `pr_description`):
- `pr_number` — PR number for `gh` CLI calls
- `pr_title` — passed as `PR_TITLE` env var to `cli.ts`
- `pr_description` — optional, default `''`; passed as `PR_DESCRIPTION`
- `base_sha` — checked out as the working tree; diff base
- `head_sha` — fetched for diff head; never checked out as code
- `openrouter_api_key` — marked `no-log: true`
- `github_token` — marked `no-log: true`; used for `gh` CLI via `GH_TOKEN`

Steps (all `shell: bash`):
1. `actions/checkout@v4` with `ref: ${{ inputs.base_sha }}` and `fetch-depth: 0`
2. `git fetch origin ${{ inputs.head_sha }}` — fetches only the head commit, not the full head branch
3. `actions/setup-node@v4` with `node-version: 22` and `cache: npm`, `cache-dependency-path: packages/code-reviewer/package-lock.json`
4. Create labels idempotently — three `gh label create` calls with `2>/dev/null || true`:
   - `ai-cr:review` color `0075ca`
   - `ai-cr:passed` color `0e8a16`
   - `ai-cr:failed` color `d93f0b`
5. `npm ci` in `packages/code-reviewer/`
6. Compute diff + soft cap: `git diff ${{ inputs.base_sha }}...${{ inputs.head_sha }} > /tmp/pr-diff.txt`; if `wc -l < /tmp/pr-diff.txt` > 3000, truncate with `head -n 3000` and set step output `truncated=true`; otherwise `truncated=false`
7. Run reviewer: `node --import tsx src/cli.ts > /tmp/review-output.json` from `working-directory: packages/code-reviewer` with env vars `PR_TITLE`, `PR_DESCRIPTION`, `GIT_DIFF_FILE=/tmp/pr-diff.txt`, `OPENROUTER_API_KEY`
8. Format and post PR comment using `jq` to extract fields; comment format:

```markdown
## AI Code Review — ✅ PASSED / ❌ FAILED

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Implementation Correctness | N/10 | ... |
| Idiomaticity | N/10 | ... |
| Complexity | N/10 | ... |
| Test / Risk Coverage | N/10 | ... |
| Documentation | N/10 | ... |
| Security & Safety | N/10 | ... |

**Overall**: <overallSummary>

> ⚠️ Diff was truncated at 3 000 lines — review may be incomplete.
```
(Truncation note only when `steps.diff.outputs.truncated == 'true'`.)

Post via `gh pr comment ${{ inputs.pr_number }} --body "..."`.

9. Apply result label: remove both `ai-cr:passed` and `ai-cr:failed` first (`2>/dev/null || true`), then add the appropriate one based on `jq -r '.passed' /tmp/review-output.json`
10. Remove `ai-cr:review` trigger label: `gh pr edit ${{ inputs.pr_number }} --remove-label ai-cr:review 2>/dev/null || true`

#### 2. `.github/workflows/code-review.yml` (new file)

**Intent**: Outer workflow defining the two triggers, permissions block, concurrency group, and two jobs — `code-review` (review execution) and `fork-pr-notice` (skip comment for fork PRs).

**Contract**:

Triggers:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]
  pull_request_target:
    types: [labeled]
    branches: [main]
```

Top-level permissions:
```yaml
permissions:
  pull-requests: write
  issues: write
  contents: read
```

Top-level concurrency:
```yaml
concurrency:
  group: code-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

Job `code-review`:
```yaml
if: |
  (github.event_name == 'pull_request' &&
   github.event.pull_request.head.repo.full_name == github.repository) ||
  (github.event_name == 'pull_request_target' &&
   github.event.label.name == 'ai-cr:review')
runs-on: ubuntu-latest
continue-on-error: true   # advisory only — never blocks merge
```
`continue-on-error: true` ensures the GitHub check always reports success regardless of whether the review found issues (`passed: false`) or encountered an API/runtime failure. The result is communicated via PR comment and label, not via the check status. This job must NOT be added to branch protection required checks.

Single step: `uses: ./.github/actions/code-review` with all inputs sourced from `github.event.pull_request.*` and `secrets.OPENROUTER_API_KEY` / `github.token`.

Job `fork-pr-notice`:
```yaml
if: |
  github.event_name == 'pull_request' &&
  github.event.pull_request.head.repo.full_name != github.repository &&
  github.event.action == 'opened'
runs-on: ubuntu-latest
```
Single step: `gh pr comment ${{ github.event.pull_request.number }} --body "..."` with message explaining that AI review is unavailable for fork PRs and a maintainer can add `ai-cr:review` after reviewing the code. No checkout needed.

### Success Criteria

#### Automated Verification

- Workflow YAML is syntactically valid — GitHub validates on push; job appears in the Actions tab without parse errors
- Composite action has no undefined `${{ inputs.* }}` references — all inputs declared match all usages

#### Manual Verification

- Open a test PR to `main` → `code-review` job runs to completion, review comment appears with the markdown table, `ai-cr:passed` or `ai-cr:failed` label is applied
- Confirm the `code-review` job check shows green in the PR checks list regardless of the `passed` value (advisory-only behavior via `continue-on-error: true`)
- Add `ai-cr:review` label to the PR → job retriggers; label is removed after the job completes
- Open a fork PR → only `fork-pr-notice` runs and posts the skip comment (one time only on open)
- `OPENROUTER_API_KEY` does not appear in any step log

**Implementation Note**: After completing Phase 2 and automated verification passes, pause for manual end-to-end confirmation before declaring the change complete.

---

## Testing Strategy

### Manual Testing Steps

1. **Phase 1 local test**: Create a small sample diff file (`/tmp/sample.diff`) from any file change, run `PR_TITLE="Test PR" GIT_DIFF_FILE=/tmp/sample.diff OPENROUTER_API_KEY=<key> npm run ci` in `packages/code-reviewer/`; verify JSON output and exit code 0
2. **Phase 2 PR test**: Push Phase 2 changes on the feature branch, open a PR targeting `main` — confirm job triggers, comment format, and label
3. **Retry test**: Add `ai-cr:review` label manually → confirm re-run completes and label is cleaned up
4. **Fork guard**: Either use a test fork or verify the `if:` condition logic against the GitHub event payload in the workflow YAML

## Performance Considerations

The soft diff cap at 3 000 lines (LOC) targets the model's practical review quality threshold — reviews of diffs beyond this size tend to miss details regardless of context window. Most PRs in this repo are well under this limit. Very large PRs (bulk file moves, generated files) will be truncated with a visible comment warning. If truncation becomes frequent, consider a pre-cap step that strips binary, generated, or lock files from the diff.

## Migration Notes

`OPENROUTER_API_KEY` must be added to GitHub repository secrets before the workflow runs:
- Settings → Secrets and variables → Actions → New repository secret
- Name: `OPENROUTER_API_KEY`
- Value: the key from `packages/code-reviewer/.env`

This is a one-time manual step not automated by this change.

## References

- Research: `context/changes/ci-cd-code-review/research.md`
- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- ToolLoopAgent design rationale: `context/changes/code-reviewer-agent/plan.md`
- Existing workflow pattern: `.github/workflows/ci.yml`
- Agent setup: `packages/code-reviewer/src/agent.ts:9`
- Current schemas: `packages/code-reviewer/src/schemas.ts`
- Current prompts: `packages/code-reviewer/src/prompts.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: TypeScript Package — PR-aware schemas, prompts, and CLI entrypoint

#### Automated

- [x] 1.1 Type checking passes in packages/code-reviewer/: npm run typecheck — 47e630e

#### Manual

- [x] 1.2 cli.ts produces valid ReviewOutput JSON on stdout when run with PR_TITLE and GIT_DIFF_FILE — 47e630e
- [x] 1.3 npm start runs the updated demo without TypeScript or runtime errors — 47e630e

### Phase 2: GitHub Actions Infrastructure

#### Automated

- [x] 2.1 Workflow YAML is syntactically valid — job appears in Actions tab without parse errors — b36c63f
- [x] 2.2 Composite action has no undefined inputs.* references — b36c63f

#### Manual

- [x] 2.3 Test PR triggers code-review job and runs to completion
- [x] 2.4 PR comment is posted with formatted markdown table
- [x] 2.5 ai-cr:passed or ai-cr:failed label is applied
- [x] 2.6 code-review job check shows green regardless of passed value (advisory-only)
- [ ] 2.7 Adding ai-cr:review label retriggers the job; label is removed after completion
- [ ] 2.8 Fork PR only triggers fork-pr-notice job and posts skip comment once
- [x] 2.9 OPENROUTER_API_KEY does not appear in any step log
