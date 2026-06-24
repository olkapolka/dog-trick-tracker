# Code Review Agent (ToolLoopAgent) Implementation Plan

## Overview

Refactor `packages/code-reviewer/src/index.ts` from a monolithic 33-line script into a modular, reusable code review agent built on AI SDK's `ToolLoopAgent`. Schemas, prompts, and agent definition are extracted into separate files. The agent and a thin wrapper function are exported so promptfoo evals can call the reviewer without touching internal SDK details.

## Current State Analysis

`src/index.ts` is a single flat file that:
- Inlines the Zod input schema and type
- Inlines the prompt string inside the function body
- Uses `generateText` directly (not `ToolLoopAgent`)
- Exports nothing — ends with a fire-and-forget example call
- Has no structured output; returns raw `string`

No other source files exist in `src/`. The package already has `ai@6.0.209`, `@openrouter/ai-sdk-provider@2.9.1`, and `zod@4.4.3` installed.

## Desired End State

Four files under `src/`:

```
src/
  schemas.ts    — Zod schemas + inferred TypeScript types
  prompts.ts    — typed prompt-builder functions
  agent.ts      — ToolLoopAgent definition, codeReviewerAgent export, reviewCode wrapper
  index.ts      — thin demo runner (imports reviewCode, fires one example call)
```

`agent.ts` is the primary public surface: it exports `codeReviewerAgent` (the agent instance) and `reviewCode(input): Promise<ReviewOutput>`. promptfoo providers import `reviewCode`; other callers import `codeReviewerAgent` directly for streaming.

### Key Discoveries

- `ToolLoopAgent` is imported from `ai` (verified in `node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx`)
- Structured output uses `output: Output.object({ schema })` in the constructor (`node_modules/ai/docs/03-agents/02-building-agents.mdx:162`)
- `generate({ prompt })` returns a `GenerateTextResult`; structured output is on `result.output` (verified in ToolLoopAgent reference doc)
- `InferAgentUIMessage<typeof agent>` infers the UI message type for future streaming integration (`type-safe-agents.md`)
- `Output` is a named export from `ai` (common-errors.md confirms `generateObject` is deprecated; use `Output.object`)

## What We're NOT Doing

- No tools on the agent in this phase
- No promptfoo eval configuration (environment, yaml, runner)
- No streaming endpoint or API route
- No changes to `package.json` scripts beyond what already exists
- No UI integration

## Implementation Approach

Three extracted modules feed into the agent. The agent module is the single entry-point for callers. `index.ts` becomes a thin demo that stays runnable via `npm start`.

## Phase 1: Extract Schemas

### Overview

Move all Zod schemas and their inferred TypeScript types out of `index.ts` into `src/schemas.ts`. This makes them independently importable by both the agent and promptfoo test harnesses.

### Changes Required

#### 1. Create `src/schemas.ts`

**File**: `packages/code-reviewer/src/schemas.ts`

**Intent**: Define and export the input schema (`ReviewInputSchema`) and the structured output schema (`ReviewOutputSchema`) as named exports. Colocate the inferred types (`ReviewInput`, `ReviewOutput`) so callers never need to re-infer them.

**Contract**:

```ts
// input
export const ReviewInputSchema = z.object({
  code: z.string().min(1),
  language: z.string().optional(),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

// output
export const IssueSchema = z.object({
  severity: z.enum(['error', 'warning', 'suggestion']),
  message: z.string(),
  line: z.number().optional(),
});
export const ReviewOutputSchema = z.object({
  summary: z.string(),
  issues: z.array(IssueSchema),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
```

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes with no errors

#### Manual Verification

- `schemas.ts` exports `ReviewInputSchema`, `ReviewOutputSchema`, `ReviewInput`, `ReviewOutput`, `IssueSchema` as named exports

**Implementation Note**: Pause after this phase for manual verification before proceeding.

---

## Phase 2: Extract Prompts

### Overview

Create `src/prompts.ts` with a typed function that builds the user-turn prompt string. The system instruction for the agent also lives here as a named export.

### Changes Required

#### 1. Create `src/prompts.ts`

**File**: `packages/code-reviewer/src/prompts.ts`

**Intent**: Centralise all prompt text so it can be iterated without touching agent or schema files. `buildReviewPrompt` accepts typed input and returns the user prompt string. `REVIEW_SYSTEM_INSTRUCTIONS` is the string passed to the agent's `instructions` field.

**Contract**:

```ts
import type { ReviewInput } from './schemas.js';

export const REVIEW_SYSTEM_INSTRUCTIONS = `You are an expert software engineer conducting code reviews. ...`;

export function buildReviewPrompt(input: ReviewInput): string {
  const { code, language } = input;
  return `Review the following${language ? ` ${language}` : ''} code:\n\n${code}`;
}
```

The system instructions string should direct the agent to produce its output in the exact shape of `ReviewOutputSchema` (summary + flat issues list with severity, message, optional line number).

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes

#### Manual Verification

- `buildReviewPrompt({ code: 'x', language: 'JS' })` returns a string containing `'JavaScript'`
- `REVIEW_SYSTEM_INSTRUCTIONS` is a non-empty string exported from the module

---

## Phase 3: Build the Agent Module

### Overview

Create `src/agent.ts` with the `ToolLoopAgent` definition and two exports: the raw agent instance and the `reviewCode` wrapper function. Replace `src/index.ts` with a thin demo runner.

### Changes Required

#### 1. Create `src/agent.ts`

**File**: `packages/code-reviewer/src/agent.ts`

**Intent**: Instantiate `ToolLoopAgent` with the OpenRouter model, system instructions from `prompts.ts`, and structured output schema from `schemas.ts`. Export `codeReviewerAgent` (the instance) and `reviewCode` (the async wrapper that validates input, builds the prompt, calls `agent.generate()`, and returns typed output).

**Contract**:

```ts
import { ToolLoopAgent, Output, InferAgentUIMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ReviewInputSchema, ReviewOutputSchema } from './schemas.js';
import { buildReviewPrompt, REVIEW_SYSTEM_INSTRUCTIONS } from './prompts.js';
import type { ReviewInput, ReviewOutput } from './schemas.js';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export const codeReviewerAgent = new ToolLoopAgent({
  model: openrouter('anthropic/claude-sonnet-4'),
  instructions: REVIEW_SYSTEM_INSTRUCTIONS,
  output: Output.object({ schema: ReviewOutputSchema }),
});

export type CodeReviewerUIMessage = InferAgentUIMessage<typeof codeReviewerAgent>;

export async function reviewCode(input: ReviewInput): Promise<ReviewOutput> {
  const validated = ReviewInputSchema.parse(input);
  const result = await codeReviewerAgent.generate({
    prompt: buildReviewPrompt(validated),
  });
  return result.output as ReviewOutput;
}
```

#### 2. Replace `src/index.ts`

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Keep `index.ts` as a runnable demo that exercises `reviewCode`. Remove the inline schema, inline prompt, and `generateText` call. It should import `reviewCode` from `./agent.js` and fire one example.

**Contract**: File re-exports nothing; it's only a CLI runner. The demo call stays so `npm start` still works.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes with no errors across all four files

#### Manual Verification

- `npm start` runs and prints a valid review result (JSON-shaped or text containing `summary` and `issues`)
- `codeReviewerAgent`, `reviewCode`, `CodeReviewerUIMessage`, `ReviewInput`, `ReviewOutput` are all importable from `agent.ts` and `schemas.ts` by an external consumer

---

## Testing Strategy

### Manual Testing Steps

1. `npm run typecheck` — zero errors
2. `npm start` — agent runs, OpenRouter responds, structured output is logged
3. Manually verify the logged output has `summary: string` and `issues: Array<{severity, message}>`

## References

- AI SDK `ToolLoopAgent` reference: `packages/code-reviewer/node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx`
- Agent building guide: `packages/code-reviewer/node_modules/ai/docs/03-agents/02-building-agents.mdx`
- Type-safe agents: `packages/code-reviewer/.claude/skills/ai-sdk/references/type-safe-agents.md`
- Common errors (deprecated APIs): `packages/code-reviewer/.claude/skills/ai-sdk/references/common-errors.md`
- Current entry point: `packages/code-reviewer/src/index.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Extract Schemas

#### Automated

- [x] 1.1 `npm run typecheck` passes after creating `schemas.ts` — 706a7cc

#### Manual

- [x] 1.2 All five schema exports are present and importable — 706a7cc

### Phase 2: Extract Prompts

#### Automated

- [x] 2.1 `npm run typecheck` passes after creating `prompts.ts`

#### Manual

- [x] 2.2 `buildReviewPrompt` and `REVIEW_SYSTEM_INSTRUCTIONS` exist and work as described

### Phase 3: Build the Agent Module

#### Automated

- [ ] 3.1 `npm run typecheck` passes across all four files

#### Manual

- [ ] 3.2 `npm start` produces output with `summary` and `issues` fields
- [ ] 3.3 `codeReviewerAgent`, `reviewCode`, and `CodeReviewerUIMessage` are importable from `agent.ts`
