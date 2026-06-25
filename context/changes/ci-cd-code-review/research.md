---
date: 2026-06-24T00:00:00+02:00
researcher: Oliwia Achyna
git_commit: d84232b5d15d3e32e95da485b85f2752d24a95ec
branch: feature/m5-teamwork-with-ai
repository: dog-trick-tracker
topic: "GitHub Actions workflow for agentic code review based on packages/code-reviewer"
tags: [research, ci-cd, github-actions, code-reviewer, openrouter, composite-action]
status: complete
last_updated: 2026-06-24
last_updated_by: Oliwia Achyna
---

# Research: GitHub Actions Workflow for Agentic Code Review

**Date**: 2026-06-24  
**Researcher**: Oliwia Achyna  
**Git Commit**: `d84232b5d15d3e32e95da485b85f2752d24a95ec`  
**Branch**: `feature/m5-teamwork-with-ai`  
**Repository**: dog-trick-tracker

## Research Question

What does the existing codebase look like — specifically `packages/code-reviewer`, existing GHA workflows, and prior architectural decisions — and what needs to change to implement the CI/CD code review workflow defined in `requirements.md`?

## Summary

The `packages/code-reviewer` package exists but is **not CI-ready** as written. Its input schema (`{code, language}`), output schema (severity-bucketed issues list), and review criteria (performance, readability, etc.) all diverge from the requirements (PR diff inputs, 1–10 criterion scores, 6 specific criteria). Both the code reviewer's TypeScript source and a new GHA workflow + composite action need to be built. The good news: the architectural foundation — `ToolLoopAgent`, Zod schemas, OpenRouter provider — is solid and the changes are surgical.

---

## Detailed Findings

### 1. packages/code-reviewer — Current State

**Entry point**: `packages/code-reviewer/src/index.ts` — a thin demo harness, not a CLI. It hardcodes an example input and calls `reviewCode()` from `./agent.ts`.

```ts
// packages/code-reviewer/src/index.ts (all 8 lines)
const exampleInput = { code: `function add(a, b) { return a + b; }`, language: 'JavaScript' };
reviewCode(exampleInput).then(console.log).catch(console.error);
```

**How it runs** (`packages/code-reviewer/package.json`):
```json
"start": "node --env-file=.env --import tsx src/index.ts"
```
No build step. Uses `tsx` to execute TypeScript directly. ES module package (`"type": "module"`).

**Core function** (`packages/code-reviewer/src/agent.ts:17–23`):
```ts
export async function reviewCode(input: ReviewInput): Promise<ReviewOutput> {
  const validated = ReviewInputSchema.parse(input);
  const result = await codeReviewerAgent.generate({ prompt: buildReviewPrompt(validated) });
  return result.output as ReviewOutput;
}
```

**Current input schema** (`packages/code-reviewer/src/schemas.ts`):
```ts
export const ReviewInputSchema = z.object({
  code: z.string().min(1),
  language: z.string().optional(),
});
```

**Current output schema** (`packages/code-reviewer/src/schemas.ts`):
```ts
export const ReviewOutputSchema = z.object({
  summary: z.string(),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'suggestion']),
    message: z.string(),
    line: z.number().optional(),
  })),
});
```

**Current review criteria** (`packages/code-reviewer/src/prompts.ts`):
correctness, security vulnerabilities, performance, readability, maintainability.

**Required environment variable**: `OPENROUTER_API_KEY` (read at `packages/code-reviewer/src/agent.ts:7`). NOT loaded by the package itself in CI — caller must inject it.

**AI model**: `anthropic/claude-sonnet-4` via OpenRouter (`packages/code-reviewer/src/agent.ts:10`).

**Output to stdout**: `console.log(result)` prints the JS object representation — not `JSON.stringify`. Would produce `{ summary: '...', issues: [...] }` (not valid JSON) in the current demo runner.

**No tests**: No `*.test.ts` files exist in `packages/code-reviewer/src/`.

---

### 2. Existing GitHub Actions Workflows

**Node version**: 22 (`.nvmrc` at repo root).

**`.github/actions/` directory**: Does NOT exist. The composite action will need to create it.

**`.github/workflows/ci.yml`** — triggers on push to `main` and PR to `main`:
- Runs `npm ci`, `npx astro sync`, `npm run lint`, `npm run build`
- Injects `SUPABASE_URL` and `SUPABASE_KEY` for build
- **No explicit `permissions:` block** — uses GitHub's default token permissions

**`.github/workflows/deploy.yml`** — triggers on push to `main` only:
- Same Node 22 setup, deploys via `cloudflare/wrangler-action@v3`
- Secrets: `SUPABASE_URL`, `SUPABASE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **No explicit `permissions:` block**

**Existing secrets in use**: `SUPABASE_URL`, `SUPABASE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

**No composite actions**, no reusable workflows, no PR-commenting workflows exist yet.

**No npm workspaces**: `packages/code-reviewer` is not a workspace dependency of the root. `npm ci` inside `packages/code-reviewer/` is independent of root `npm ci`.

---

### 3. Prior Change Context — code-reviewer-agent

The `code-reviewer-agent` change refactored a flat 33-line script into a modular agent. Key load-bearing decisions:

- **Primary interface is programmatic**: `reviewCode(input)` in `agent.ts` is designed for external callers (e.g. promptfoo evals). `index.ts` is explicitly a "thin demo runner".
- **ToolLoopAgent rationale**: Chosen over bare `generateText` for structured output guarantee (`Output.object({ schema })`), not for tool-calling (the plan notes "None — structured output only… tools can be added in a follow-up change").
- **No file I/O at runtime**: Prompts are built from `buildReviewPrompt()` template functions. No reading from disk.
- **Design was promptfoo-first, not CI-first**: The output shape (`severity-bucketed issues`) maps to promptfoo eval scoring, not PR label pass/fail logic.
- **Exact dependency versions enforced**: `ai@6.0.209`, `@openrouter/ai-sdk-provider@2.9.1`, `zod@4.4.3` — consistent with the "use exact npm package versions" lesson.

---

## Gap Analysis: Requirements vs. Current State

| Dimension | Required | Current | Gap |
|-----------|----------|---------|-----|
| **Input** | `{ prTitle, prDescription?, gitDiff }` | `{ code, language? }` | Schema + prompt template must change |
| **Review criteria** | 6 criteria, each scored 1–10 | 5 criteria, severity-bucketed issues | Prompts + output schema must change |
| **Output** | Criterion scores + pass/fail | Issue list + summary | Output schema must change |
| **CI entrypoint** | Accepts external inputs, prints JSON | Demo harness with hardcoded input | New `src/cli.ts` or modified `src/index.ts` needed |
| **GHA workflow** | PR trigger + label trigger | Does not exist | New `.github/workflows/code-review.yml` |
| **Composite action** | Wraps review logic | Does not exist | New `.github/actions/code-review/action.yml` |
| **PR comment** | Post structured review comment | Does not exist | `gh pr comment` in workflow |
| **Labels** | `ai-cr:failed` / `ai-cr:passed` | Do not exist | Create labels + label management steps |
| **Secret** | `OPENROUTER_API_KEY` in GH secrets | Exists locally in `.env` only | Must be added to repo secrets |

---

## Architecture Insights

### Recommended package changes

**`packages/code-reviewer/src/schemas.ts`** — replace with PR-focused schemas:
```ts
export const ReviewInputSchema = z.object({
  prTitle: z.string().min(1),
  prDescription: z.string().optional(),
  gitDiff: z.string().min(1),
});

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
  passed: z.boolean(),  // derived: true if all scores >= threshold
});
```

**`packages/code-reviewer/src/prompts.ts`** — rewrite system prompt for the 6 required criteria scored 1–10, and user prompt template to format `prTitle`, `prDescription`, `gitDiff`.

**New `packages/code-reviewer/src/cli.ts`** — thin CLI entrypoint that reads inputs from environment variables (`PR_TITLE`, `PR_DESCRIPTION`, `GIT_DIFF`) and prints `JSON.stringify(result)` to stdout. This keeps `index.ts` as a local demo and separates CI concerns.

### Recommended GHA architecture

```
.github/
  workflows/
    code-review.yml       # outer workflow — trigger logic, checkout, label management
  actions/
    code-review/
      action.yml          # composite action — npm install, run reviewer, parse output, post comment
```

**Trigger in `code-review.yml`**:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [master]
  pull_request_target:   # for label-triggered re-runs
    types: [labeled]
    branches: [master]
```
On `labeled` event: gate with `if: github.event.label.name == 'ai-cr:review'`, then remove the label after review to reset for next trigger.

**Permissions needed** (post comment + manage labels):
```yaml
permissions:
  pull-requests: write   # post comments
  issues: write          # add/remove labels (labels use the issues API)
  contents: read         # checkout
```

**Concurrency** (prevent duplicate runs):
```yaml
concurrency:
  group: code-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

**Secret injection**:
```yaml
env:
  OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

**npm install for code-reviewer** (since it's NOT a workspace):
```yaml
- run: npm ci
  working-directory: packages/code-reviewer
```

**Run reviewer via cli.ts**:
```yaml
- name: Run code review
  working-directory: packages/code-reviewer
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
    PR_DESCRIPTION: ${{ github.event.pull_request.body }}
    GIT_DIFF: ${{ steps.diff.outputs.diff }}
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: node --import tsx src/cli.ts > review-output.json
```

**Post comment** (using `gh` CLI, always available in GHA):
```yaml
- name: Post review comment
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    SUMMARY=$(jq -r '.overallSummary' review-output.json)
    gh pr comment ${{ github.event.pull_request.number }} --body "$SUMMARY"
```

**Apply label**:
```yaml
- name: Apply result label
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    PASSED=$(jq -r '.passed' review-output.json)
    gh pr edit ${{ github.event.pull_request.number }} \
      --remove-label "ai-cr:passed" --remove-label "ai-cr:failed" 2>/dev/null || true
    if [ "$PASSED" = "true" ]; then
      gh pr edit ${{ github.event.pull_request.number }} --add-label "ai-cr:passed"
    else
      gh pr edit ${{ github.event.pull_request.number }} --add-label "ai-cr:failed"
    fi
```

---

## Code References

- `packages/code-reviewer/package.json` — `start` script, dependencies, no build step
- `packages/code-reviewer/src/index.ts` — demo harness (8 lines, hardcoded input)
- `packages/code-reviewer/src/agent.ts` — `reviewCode()` function, `OPENROUTER_API_KEY`, OpenRouter + ToolLoopAgent setup
- `packages/code-reviewer/src/schemas.ts` — `ReviewInputSchema`, `ReviewOutputSchema`
- `packages/code-reviewer/src/prompts.ts` — `REVIEW_SYSTEM_INSTRUCTIONS`, `buildReviewPrompt()`
- `.github/workflows/ci.yml` — Node 22 setup pattern, no permissions block
- `.github/workflows/deploy.yml` — secrets injection pattern
- `.nvmrc` — Node 22
- `context/changes/code-reviewer-agent/plan.md` — original ToolLoopAgent design rationale
- `context/changes/code-reviewer-agent/plan-brief.md` — "thin demo runner" characterization of index.ts, promptfoo-first design intent

---

## Historical Context (from prior changes)

- `context/changes/code-reviewer-agent/plan.md` — Documents the deliberate "structured output only, no tools" choice for ToolLoopAgent. If the CI workflow later needs tools (e.g. to look up context beyond the diff), this is the extension point.
- `context/changes/code-reviewer-agent/plan-brief.md` — Confirms `index.ts` is "thin demo runner" and that `reviewCode` in `agent.ts` is the intended public API. The change was scoped to promptfoo eval; CI integration was not in scope.

---

## Open Questions

1. **Pass/fail threshold**: The requirements define 6 criteria scored 1–10, labels `ai-cr:failed` vs `ai-cr:passed`, but don't define the threshold. Proposed default: fail if any criterion scores ≤ 4, or if the average across all 6 is < 6. Should the model decide (boolean `passed` in output schema) or should the workflow apply a fixed threshold to the scores?

2. **PR description as input** (flagged as cost tradeoff in requirements): At current OpenRouter pricing for `claude-sonnet-4`, a 500-char description adds ~100 tokens — negligible cost. However for very large PRs (10K+ token diffs), the description may dilute signal rather than add it. Recommendation: **include by default, keep it optional** — the `optional()` on `prDescription` in the schema is the right call.

3. **Label pre-creation**: Labels `ai-cr:review`, `ai-cr:passed`, `ai-cr:failed` must exist in the repo before the workflow can apply them. Should label creation be part of the workflow (with `gh label create ... 2>/dev/null || true`) or a one-time setup step documented separately?

4. **Fork PR safety**: `pull_request` events from forked repos don't have access to repository secrets. Gate with `if: github.event.pull_request.head.repo.full_name == github.repository` to prevent secret leakage on fork PRs, and either skip silently or post a comment explaining why review was skipped.

5. **`pull_request` vs `pull_request_target` for label trigger**: `pull_request_target` runs in the context of the target branch (has secrets access) but is a security risk if the workflow checks out PR code and runs it. The label-based re-run (`ai-cr:review`) is safer with `pull_request` + a separate `workflow_run` or using the same `pull_request` event with `labeled` type — but then it only re-runs when a new push also happens. Needs a decision.

6. **Git diff scope**: `git diff origin/master...HEAD` gives the full PR diff. For very large PRs this could exceed the model's context window. Should a max diff size be enforced (truncate with a warning, or fail gracefully)?
