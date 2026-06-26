---
date: 2026-06-25T00:00:00+00:00
researcher: Oliwia Achyna
git_commit: c971347953b394f774e3238b6ad94f7ec6a4e4b3
branch: feature/m5l3-code-review
repository: dog-trick-tracker
topic: "Eval readiness of packages/code-reviewer and promptfoo compatibility"
tags: [research, evals, promptfoo, code-reviewer, ai-sdk, openrouter, multi-model]
status: complete
last_updated: 2026-06-25
last_updated_by: Oliwia Achyna
---

# Research: Eval readiness of packages/code-reviewer and promptfoo compatibility

**Date**: 2026-06-25  
**Researcher**: Oliwia Achyna  
**Git Commit**: `c971347953b394f774e3238b6ad94f7ec6a4e4b3`  
**Branch**: `feature/m5l3-code-review`  
**Repository**: dog-trick-tracker

---

## Research Question

Analyze the current state of `packages/code-reviewer` for potential eval introduction — reusability of prompts, importability of the agent, etc. Primary pick is promptfoo. If the tech stack is not aligned, identify OSS alternatives.

Additional lesson context (from `.github/prompts/m5l3-promptfoo.md`): the target plan is a three-model comparison (`anthropic/claude-sonnet-4.5`, `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`) over one complex React 16→19 migration diff with three intentional flaws, verified by LLM-as-a-judge and a static `passed === false` assertion.

---

## Summary

**promptfoo is the right tool. Proceed with confidence.**

Three independent signals converge on this conclusion:

1. The `code-reviewer-agent` change (already shipped) explicitly documented that `reviewCode()` was designed as an importable public API for promptfoo eval harnesses — "design was promptfoo-first, not CI-first."
2. The prompt architecture (`REVIEW_SYSTEM_INSTRUCTIONS` as an exported constant, `buildReviewPrompt()` as a pure function) is already in the shape promptfoo expects.
3. All three target models are available natively via promptfoo's OpenRouter provider (`openrouter:<model-id>`) — no custom provider required for the multi-model comparison use case.

One design fork exists for the plan phase: **native provider path** (use promptfoo's OpenRouter provider directly with the exported prompts) vs. **custom provider path** (wrap `reviewCode()` but parameterize the model). Both are viable; the native path is simpler for comparing prompt quality across models; the custom path tests the full agent stack including `Output.object()` schema enforcement.

---

## Detailed Findings

### 1. Package Structure and Eval Readiness

**File inventory** (5 source files, zero test files):

| File | Role | Eval-relevant exports |
|---|---|---|
| `src/prompts.ts` | Prompt strings | `REVIEW_SYSTEM_INSTRUCTIONS` (string), `buildReviewPrompt(input)` (pure fn) |
| `src/schemas.ts` | Zod schemas | `ReviewInputSchema`, `ReviewOutputSchema`, `ReviewInput`, `ReviewOutput` types |
| `src/agent.ts` | Agent + wrapper | `codeReviewerAgent` (ToolLoopAgent), `reviewCode(input): Promise<ReviewOutput>` |
| `src/cli.ts` | CI entrypoint | Not relevant for evals — reads env vars, calls `reviewCode()` |
| `src/index.ts` | Demo runner | Not relevant for evals |

**Key observations:**

- `src/prompts.ts:3` — `REVIEW_SYSTEM_INSTRUCTIONS` is a top-level exported `const string`. Directly importable into `promptfooconfig.ts` without any transformation.
- `src/prompts.ts:35` — `buildReviewPrompt(input: ReviewInput): string` assembles the user-turn prompt from `prTitle`, `prDescription?`, and `gitDiff`. Pure function, no side effects.
- `src/agent.ts:9` — The model is hardcoded: `openrouter("anthropic/claude-sonnet-4.5")`. For multi-model comparison via the custom provider path, this line would need to be parameterized.
- `src/agent.ts:17` — `reviewCode()` is a clean async wrapper: parse input with Zod, call agent, return typed output. The function signature is exactly what a promptfoo custom provider `callApi` would delegate to.
- `src/schemas.ts:15` — `ReviewOutputSchema` is a Zod v4 object. The six criteria (`implementationCorrectness`, `idiomaticity`, `complexity`, `testRiskCoverage`, `documentation`, `securitySafety`) each have `{ score: number, rationale: string }`. Top-level: `overallSummary: string` and `passed: boolean`.

**Current testing posture**: zero automated tests. Only `npm run typecheck` and manual `npm start` / `npm run ci` runs.

### 2. promptfoo Compatibility Analysis

**Tech stack**:
```
TypeScript + "type": "module" (ESM)
Node.js with tsx for transpilation
ai@6.0.209 (ToolLoopAgent, Output.object)
@openrouter/ai-sdk-provider@2.9.1
zod@4.4.3
```

**Compatibility verdict per axis:**

| Axis | Status | Notes |
|---|---|---|
| **OpenRouter providers** | Native | `openrouter:anthropic/claude-sonnet-4.5`, `openrouter:z-ai/glm-5.1`, `openrouter:deepseek/deepseek-v4-flash` all work out of the box |
| **Multi-model comparison** | Core feature | Defining multiple providers in `promptfooconfig.yaml` runs the same prompts/tests against each — this is the primary promptfoo use case |
| **Structured output assertion** | Supported | `javascript` assertion type: `JSON.parse(output).passed === false` or `JSON.parse(output).implementationCorrectness.score >= 5` |
| **LLM-as-a-judge** | Supported | `llm-rubric` assertion type verifies free-form criteria ("does the review identify all three flaws?") using a judge model |
| **TypeScript config** | Supported | `promptfooconfig.ts` (with `tsx` to run) allows importing `REVIEW_SYSTEM_INSTRUCTIONS` and `buildReviewPrompt()` directly |
| **ESM ("type": "module")** | Friction point | Custom provider loading has historically had ESM friction (see below); bypassed entirely if native providers are used |
| **YAML test cases** | Supported | `vars:` map in each test case populates `{{prTitle}}`, `{{gitDiff}}` etc. Can also be a TypeScript/JSON file |

**ESM friction detail**: promptfoo loads custom provider `.ts` files via an internal require/import mechanism. Projects with `"type": "module"` in `package.json` can cause module resolution issues when the provider file is loaded. Workarounds:
1. Use a `.mts` extension for the provider file
2. Configure `transform` in `promptfooconfig.yaml` to use `tsx` explicitly
3. Avoid custom providers entirely by using native OpenRouter providers (cleanest for this use case)

For the target lesson scope (multi-model prompt comparison), option 3 sidesteps the friction entirely.

### 3. Integration Architecture: Two Viable Approaches

#### Approach A: Native Provider + Exported Prompts (Recommended for multi-model comparison)

```yaml
# promptfooconfig.yaml
prompts:
  - id: system
    raw: "{{systemInstructions}}"

providers:
  - id: openrouter:anthropic/claude-sonnet-4.5
  - id: openrouter:z-ai/glm-5.1
  - id: openrouter:deepseek/deepseek-v4-flash

defaultTest:
  vars:
    systemInstructions: "{{REVIEW_SYSTEM_INSTRUCTIONS}}"  # imported via TS config

tests:
  - description: "React 16→19 migration with 3 flaws"
    vars:
      prTitle: "..."
      gitDiff: "..."
    assert:
      - type: javascript
        value: "JSON.parse(output).passed === false"
      - type: llm-rubric
        value: "The review must identify: (1) ..., (2) ..., (3) ..."
```

**How prompts get in**: use `promptfooconfig.ts` instead of YAML to import `REVIEW_SYSTEM_INSTRUCTIONS` and call `buildReviewPrompt()` for the user prompt.

**Trade-off**: Bypasses `ToolLoopAgent` and `Output.object()` schema enforcement. The system prompt already instructs "Return ONLY raw JSON" — well-behaved models comply, but weaker models may wrap in markdown. The `javascript` assertion would fail on malformed output, which is itself a useful signal.

#### Approach B: Custom Provider Wrapping `reviewCode()` (Tests full agent stack)

Requires making `reviewCode()` model-configurable:

```typescript
// src/agent.ts refactor
export function createReviewAgent(modelId: string) {
  return new ToolLoopAgent({
    model: openrouter(modelId),
    instructions: REVIEW_SYSTEM_INSTRUCTIONS,
    output: Output.object({ schema: ReviewOutputSchema }),
  });
}

export async function reviewCode(input: ReviewInput, modelId = "anthropic/claude-sonnet-4.5"): Promise<ReviewOutput> {
  const agent = createReviewAgent(modelId);
  const validated = ReviewInputSchema.parse(input);
  const result = await agent.generate({ prompt: buildReviewPrompt(validated) });
  return result.output;
}
```

Custom provider file:
```typescript
// evals/provider.ts
import { reviewCode } from "../src/agent.js";

export default {
  id: () => process.env.EVAL_MODEL ?? "anthropic/claude-sonnet-4.5",
  callApi: async (prompt: string, ctx: any) => {
    const result = await reviewCode(ctx.vars, process.env.EVAL_MODEL);
    return { output: JSON.stringify(result) };
  },
};
```

**Trade-off**: More code, ESM friction to navigate, but tests `Output.object()` schema enforcement — meaning if a model returns malformed JSON, the agent itself throws rather than the assertion failing. Stronger correctness guarantee.

### 4. Assertion Strategy for the Lesson Test Case

For one complex React 16→19 diff with three intentional flaws:

| Assertion type | What it checks | promptfoo type |
|---|---|---|
| **Static structural** | `passed === false` (the review must fail) | `javascript` |
| **Static score** | Each flawed criterion scores ≤ 5 (e.g., `testRiskCoverage`) | `javascript` |
| **LLM-as-a-judge** | Review text correctly names all three flaws | `llm-rubric` |
| **JSON schema** | Output parses as valid `ReviewOutput` shape | `javascript` (parse + check keys) |

The `llm-rubric` assertion passes `output` and a rubric string to a judge model. The judge returns pass/fail. This is the right tool for verifying qualitative correctness ("does it mention that `componentDidMount` is deprecated?").

### 5. Alternative Eval Tools (If promptfoo Were Not Used)

| Tool | ESM support | Wrap custom fn | Cloud dependency | Best for |
|---|---|---|---|---|
| **Evalite** (Matt Pocock) | Native (Vitest) | First-class `task` API | None | Local-first, TypeScript-native, offline |
| **Braintrust** | Native | First-class `task` API | Dashboard (free tier) | Score regression tracking over time |
| **Vitest + matchers** | Native | Trivial | None | Simplest possible, no eval-specific UX |
| **LangSmith** | Native | Via `traceable()` wrapper | Datasets are cloud-only | LangChain ecosystem; overkill here |
| **RAGAS** | Python only | N/A | None | RAG pipelines; wrong problem shape |
| **OpenAI Evals** | Python only | N/A | None | OpenAI-specific; not applicable |

**Recommendation if promptfoo were out**: Evalite. TypeScript ESM native, identical `task`/`data`/`scorers` API shape to Braintrust, local UI for iteration, no API key required. Braintrust is a clean upgrade path once the suite matures and regression tracking across runs becomes important.

---

## Code References

- `packages/code-reviewer/src/prompts.ts:3` — `REVIEW_SYSTEM_INSTRUCTIONS` export (system prompt string, importable directly)
- `packages/code-reviewer/src/prompts.ts:35` — `buildReviewPrompt()` export (user prompt builder, pure fn)
- `packages/code-reviewer/src/schemas.ts:3` — `ReviewInputSchema` (Zod v4, `{ prTitle, prDescription?, gitDiff }`)
- `packages/code-reviewer/src/schemas.ts:15` — `ReviewOutputSchema` (6 criteria + `overallSummary` + `passed`)
- `packages/code-reviewer/src/agent.ts:9` — Hardcoded model: `openrouter("anthropic/claude-sonnet-4.5")` — parameterize if using Approach B
- `packages/code-reviewer/src/agent.ts:17` — `reviewCode()` entry point, clean async signature
- `packages/code-reviewer/package.json:3` — `"type": "module"` — ESM friction point for custom provider loading
- `packages/code-reviewer/package.json:10` — `ai@6.0.209`, `@openrouter/ai-sdk-provider@2.9.1`, `zod@4.4.3`

---

## Architecture Insights

**Prompt reusability score: high.** `REVIEW_SYSTEM_INSTRUCTIONS` is a plain exported string — the simplest possible shape for promptfoo to consume. `buildReviewPrompt()` takes a typed input and returns a string, making it trivially usable as a prompt template builder in TypeScript config.

**Agent importability score: high with one caveat.** `reviewCode()` is exported and has a clean async API. The single limitation for multi-model evals is the hardcoded model in `agent.ts:10`. The refactor to parameterize it is minimal (one extra parameter with a default).

**ESM risk: low for the lesson's intended use case.** Since all three target models are on OpenRouter, the native `openrouter:model-id` provider syntax handles them without any custom provider file — ESM is never in the loop.

**Structured output reliability across models**: `Output.object()` (AI SDK's structured output enforcement) is only active in Approach B. In Approach A, model compliance with the "Return ONLY raw JSON" instruction varies. Weaker models (`deepseek/deepseek-v4-flash`, `z-ai/glm-5.1`) may wrap output in markdown fences. This is worth knowing before writing assertions.

---

## Historical Context

- `context/changes/code-reviewer-agent/plan.md` — Explicitly states: "reviewCode() is designed as an importable public API for external consumers (promptfoo eval harnesses)." The modular architecture (separate schemas, prompts, agent) was intentional to support this.
- `context/changes/ci-cd-code-review/plan.md` — Notes: "Design was promptfoo-first, not CI-first: The output shape (severity-bucketed issues) maps to promptfoo eval scoring, not PR label pass/fail logic." Also confirms: no automated test suite was built or planned for the CI/CD change — evals were always the intended path.

---

## Open Questions

1. **Approach A vs B**: Does the plan require testing the full `ToolLoopAgent` stack (Approach B — custom provider, small refactor to `agent.ts`) or just the prompt quality across models (Approach A — native OpenRouter providers)? The lesson prompt suggests prompt comparison across models → Approach A.

2. **JSON compliance of weaker models**: Under Approach A, will `z-ai/glm-5.1` and `deepseek/deepseek-v4-flash` reliably return raw JSON without markdown fences given the current `REVIEW_SYSTEM_INSTRUCTIONS`? May need a `transform` or `postprocess` step in the promptfoo config if they don't.

3. **Judge model selection**: For `llm-rubric` assertions, which model should be the judge? A strong judge (e.g., `openrouter:anthropic/claude-sonnet-4.5`) reviewing weaker model outputs may introduce bias. The plan should specify judge model and rubric format.

4. **React 16→19 diff design**: The three intentional flaws need to be chosen so that they are (a) non-trivial enough to distinguish model quality, (b) detectable from diff alone without runtime context, and (c) distinct enough that partial credit is meaningful. Plan phase should define these concretely.

5. **promptfoo version pinning**: Per project lessons — exact versions in `package.json` (no `^` or `~`). Confirm current promptfoo stable version before pinning.
