# Code Review Agent — Plan Brief

> Full plan: `context/changes/code-reviewer-agent/plan.md`

## What & Why

Refactor `packages/code-reviewer/src/index.ts` from a monolithic flat script into a modular code review agent using AI SDK's `ToolLoopAgent`. The motivation is reusability: the agent and its wrapper function need to be importable by external consumers (promptfoo eval harnesses) without coupling callers to internal SDK details.

## Starting Point

A single 33-line `src/index.ts` that inlines its Zod schema, prompt string, and `generateText` call. Exports nothing. The package already has `ai`, `@openrouter/ai-sdk-provider`, and `zod` installed.

## Desired End State

Four files under `src/` — `schemas.ts`, `prompts.ts`, `agent.ts`, and a thin `index.ts` demo runner. `agent.ts` exports `codeReviewerAgent` (the `ToolLoopAgent` instance), `reviewCode(input): Promise<ReviewOutput>` (the wrapper for promptfoo), and `CodeReviewerUIMessage` (the inferred UI message type for future streaming). `npm start` still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Output schema shape | Flat issues list: `{ summary, issues[{ severity, message, line? }] }` | Maps 1:1 to how promptfoo evals score outputs — each issue is independently testable. |
| Tools in this phase | None — structured output only | Simpler foundation; tools can be added in a follow-up change without changing the eval interface. |
| Export interface | Agent instance + `reviewCode` wrapper | promptfoo calls the function; streaming callers use the agent instance directly. |
| Prompt management | Typed template functions in `prompts.ts` | Type-safe, testable in isolation, no file I/O at runtime. |

## Scope

**In scope:** `schemas.ts`, `prompts.ts`, `agent.ts`, updated `index.ts`

**Out of scope:** promptfoo eval config, streaming endpoint, tools, UI integration, new dependencies

## Architecture / Approach

```
schemas.ts  ←  prompts.ts
         ↘      ↙
          agent.ts  →  exports: codeReviewerAgent, reviewCode, CodeReviewerUIMessage
             ↓
          index.ts  (demo runner, not imported by others)
```

`Output.object({ schema: ReviewOutputSchema })` on the `ToolLoopAgent` constructor enforces structured output. `reviewCode` validates input with `ReviewInputSchema.parse()`, builds the prompt with `buildReviewPrompt()`, calls `agent.generate()`, and returns `result.output`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Extract Schemas | `schemas.ts` with input + output Zod schemas and types | Output schema shape may need tuning once the LLM is tested |
| 2. Extract Prompts | `prompts.ts` with system instructions + `buildReviewPrompt` | Prompt quality determines output quality — verify manually |
| 3. Build Agent Module | `agent.ts` + updated `index.ts`; `npm start` works end-to-end | `result.output` type assertion needs to hold; verify with typecheck |

**Prerequisites:** `OPENROUTER_API_KEY` in `.env`
**Estimated effort:** ~1 session, 3 phases

## Success Criteria (Summary)

- `npm run typecheck` passes across all four files
- `npm start` produces a JSON-shaped result with `summary` and `issues` fields
- `reviewCode` and `codeReviewerAgent` are importable from `src/agent.ts` by an external consumer
