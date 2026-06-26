# Promptfoo Eval Configuration — Plan Brief

> Full plan: `context/changes/code-review-evals/plan.md`
> Research: `context/changes/code-review-evals/research.md`

## What & Why

Introduce promptfoo as a first eval configuration for `packages/code-reviewer`, enabling side-by-side comparison of the existing code review prompt across three LLM providers. The goal is to gain empirical signal on which models correctly detect breaking changes in a realistic PR diff — a capability the package was designed to support from day one but has never exercised with automated assertions.

## Starting Point

The `packages/code-reviewer` package has five source files and zero tests. The system prompt and user prompt builder are already exported from `src/prompts.ts` as a string constant and a pure function, respectively. No eval tooling, no `evals/` directory, no fixtures exist yet.

## Desired End State

Running `npm run eval` from `packages/code-reviewer/` triggers a promptfoo evaluation that tests `REVIEW_SYSTEM_INSTRUCTIONS` against three OpenRouter models (`anthropic/claude-sonnet-4.5`, `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`), runs a single React 16→19 migration fixture with three intentional breaking API flaws, and outputs a side-by-side table showing which models correctly identified each flaw. All assertions — JSON schema validity, static `passed === false`, and LLM-as-a-judge — run automatically.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Integration approach | Approach A: native `openrouter:` providers | Bypasses ESM friction entirely; directly tests prompt quality across models, which is the lesson goal | Research |
| Three test flaws | ReactDOM.render(), string ref, missing key prop | Each maps to a distinct review criterion (correctness, idiomaticity, testRiskCoverage) and is detectable from the diff alone | Plan |
| Judge model | `anthropic/claude-sonnet-4.5` (fixed) | Consistent evaluation bar across all three subject providers; avoids self-judging | Plan |
| File layout | `evals/` subdirectory inside `packages/code-reviewer` | Co-located with source, no monorepo changes needed | Plan |
| Prompt delivery | System prompt in `file://fixtures/system-prompt.txt` | Keeps YAML readable; `file://` syntax loads at eval time | Plan |
| Markdown-fence handling | `defaultTest.options.transform` stripping expression | Defensive no-op for compliant models; safety net for weaker models that wrap JSON in fences | Plan |
| promptfoo version | `0.121.17` exact | Lessons.md: no `^` or `~` | Research + Lessons |

## Scope

**In scope:**
- Install `promptfoo@0.121.17` as a devDependency
- Add `npm run eval` script
- `evals/fixtures/system-prompt.txt` (verbatim copy of `REVIEW_SYSTEM_INSTRUCTIONS`)
- `evals/fixtures/react-migration.diff` (80–120 line realistic PR with 3 flaws)
- `evals/promptfooconfig.yaml` with 3 providers, 1 test case, 3 assertions

**Out of scope:**
- No `agent.ts` refactoring — `reviewCode()` is not used (Approach A)
- No CI/GHA integration
- No multi-test-case expansion
- No promptfoo web UI
- No streaming or tool-use configuration

## Architecture / Approach

Native `openrouter:` providers in promptfoo's YAML config make the three-model comparison entirely configuration-driven — no TypeScript code required. The system prompt is loaded via `file://` from a fixture file. The user prompt is a JSON chat array inline in the config that mirrors `buildReviewPrompt()` output. A `transform` expression strips markdown fences before assertions fire. The `llm-rubric` assertion specifies a fixed judge model to ensure consistency.

```
promptfooconfig.yaml
  ├── providers: [claude-sonnet-4.5, glm-5.1, deepseek-v4-flash]
  ├── prompts: [chat JSON array with {{systemPrompt}} + {{gitDiff}}]
  ├── defaultTest.vars.systemPrompt: file://fixtures/system-prompt.txt
  ├── defaultTest.options.transform: strip markdown fences
  └── tests[0]:
        vars: prTitle + file://fixtures/react-migration.diff
        assert:
          - javascript: JSON schema validity
          - javascript: passed === false
          - llm-rubric (judge: claude-sonnet-4.5): flaw detection
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Scaffold | `promptfoo` installed, `evals/` directory created, `npm run eval` script wired | None — purely additive |
| 2. Fixture Files | `system-prompt.txt` + `react-migration.diff` with 3 detectable flaws | Flaws too obvious or not visible in diff alone |
| 3. Config | `promptfooconfig.yaml` wired with providers, prompt, transform, assertions | YAML parse errors; `llm-rubric` judge not overridden |
| 4. Verify | `npm run eval` produces 3×1 results table with meaningful discrimination | Weaker models don't return valid JSON even with transform |

**Prerequisites:** `OPENROUTER_API_KEY` set in `packages/code-reviewer/.env` (already present from CI work)
**Estimated effort:** ~1 session across 4 phases

## Open Risks & Assumptions

- `z-ai/glm-5.1` is a less-known model; if it's not available on OpenRouter under that exact ID, the provider will fail — verify the model ID via the OpenRouter model list before running
- Weaker models that cannot follow the "Return ONLY raw JSON" instruction even after the `transform` strip will fail the JSON schema assertion — this is informative signal, not a config bug
- The `llm-rubric` rubric says "at least two of three issues" — if Sonnet itself misses one of the three flaws, the assertion passes but the fixture design should be revisited

## Success Criteria (Summary)

- `npm run eval` exits without crash and shows a 3-provider × 1-test-case results table
- `passed === false` fires on all three providers (the diff is clearly broken)
- The `llm-rubric` column shows which models correctly named the React 19 breaking changes — giving the first empirical comparison signal across models
