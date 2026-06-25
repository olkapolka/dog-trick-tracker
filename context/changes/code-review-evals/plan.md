# Promptfoo Eval Configuration Implementation Plan

## Overview

Add a promptfoo-based eval suite to `packages/code-reviewer` that runs the existing code review prompt across three OpenRouter-hosted models simultaneously, asserts that a flawed PR diff is correctly flagged, and uses Claude Sonnet as a fixed LLM judge to verify qualitative flaw detection.

## Current State Analysis

Five source files, zero tests. The key exports are already in eval-ready shape:
- `REVIEW_SYSTEM_INSTRUCTIONS` (`src/prompts.ts:3`) — exported string constant, directly usable as a fixture file
- `buildReviewPrompt()` (`src/prompts.ts:35`) — pure function; its output format (`PR Title: …\n\nGit Diff:\n…`) is the user-turn template
- `reviewCode()` (`src/agent.ts:17`) — clean async entry point, but **not used in this plan** (Approach A bypasses it)
- `.env` already contains `OPENROUTER_API_KEY`; promptfoo auto-loads it from the working directory

Key constraint: `"type": "module"` in `package.json` makes custom TypeScript provider files friction-prone. Approach A (native `openrouter:` providers) avoids this entirely — no custom provider file is needed.

## Desired End State

`npm run eval` (from `packages/code-reviewer/`) runs a promptfoo evaluation that:
- Tests the inlined code review prompt against three models via native OpenRouter providers
- Runs one test case: a React 16→19 migration diff with three embedded breaking API flaws
- Applies three assertions per provider: JSON schema validity, `passed === false` (static), and an `llm-rubric` flaw-detection check with `anthropic/claude-sonnet-4.5` as the fixed judge
- Produces a side-by-side results table showing how each model performs

### Key Discoveries

- `src/prompts.ts:3–33` — `REVIEW_SYSTEM_INSTRUCTIONS` is verbatim-copyable to `evals/fixtures/system-prompt.txt`; loaded into config via `file://fixtures/system-prompt.txt`
- `package.json` `.env` already carries `OPENROUTER_API_KEY` — promptfoo picks it up automatically from the package working directory
- `promptfoo@0.121.17` is current stable (pinned exactly per lessons.md)
- promptfoo's `defaultTest.options.transform` accepts a JS expression applied to raw output before assertions run — used to strip markdown fences that weaker models may add despite the system prompt instruction

## What We're NOT Doing

- No custom provider file — Approach A uses native `openrouter:` providers, zero ESM friction
- No refactoring of `agent.ts` — `reviewCode()` and `ToolLoopAgent` are not involved
- No CI/GHA integration — this plan delivers a local `npm run eval` runner only
- No multi-test-case expansion — one fixture, three models is the full scope
- No promptfoo web UI setup — CLI output only

## Implementation Approach

Install promptfoo as a devDependency, scaffold `evals/` with two fixture files (`system-prompt.txt` and `react-migration.diff`) and the YAML config. Use native `openrouter:` providers for all three models. Load the system prompt from a separate text file via `file://` to keep the YAML readable. Template the user prompt inline as a JSON chat array. Define three assertions per test case: JSON schema validity, static `passed === false`, and an `llm-rubric` with a fixed judge.

## Critical Implementation Details

**Markdown-fence stripping**: `z-ai/glm-5.1` and `deepseek/deepseek-v4-flash` may wrap JSON output in ` ```json ``` ` code fences despite the "Return ONLY raw JSON" instruction. Set `defaultTest.options.transform` to:
```
output.replace(/^```json\s*/m, '').replace(/\s*```\s*$/m, '').trim()
```
This is a no-op for well-behaved models and a safety net for non-compliant ones.

**`file://` path resolution**: promptfoo resolves `file://` paths relative to the config file's directory (`evals/`). Both fixtures must be referenced as `file://fixtures/system-prompt.txt` and `file://fixtures/react-migration.diff` — not relative to the package root.

**`llm-rubric` provider override**: Without an explicit `provider` field, promptfoo uses the provider that generated the output as its own judge — circular and useless. Every `llm-rubric` assertion must specify `provider: openrouter:anthropic/claude-sonnet-4.5` explicitly.

**Chat format prompt**: All three providers are chat models. The promptfoo `prompts[].raw` must be a JSON array string (roles: `system`, `user`) so the system prompt is sent in the correct position. A plain string prompt would be treated as a single user message, bypassing the system role.

---

## Phase 1: Scaffold

### Overview

Install promptfoo, add the `eval` npm script, and create the `evals/` directory structure.

### Changes Required:

#### 1. Add promptfoo devDependency and eval script

**File**: `packages/code-reviewer/package.json`

**Intent**: Add promptfoo as a devDependency at exactly `0.121.17` (lessons.md: exact versions, no `^` or `~`) and a script that invokes the eval config.

**Contract**: Under `"devDependencies"`, add `"promptfoo": "0.121.17"`. Under `"scripts"`, add `"eval": "promptfoo eval --config evals/promptfooconfig.yaml"`. Run `npm install` after editing to generate the lock file entry.

#### 2. Create evals/ directory structure

**File**: `packages/code-reviewer/evals/` and `packages/code-reviewer/evals/fixtures/`

**Intent**: Scaffold the two directories that Phases 2 and 3 will populate. Both must exist before fixture files are written.

**Contract**: Create `evals/` and `evals/fixtures/` as empty directories. No files yet.

### Success Criteria:

#### Automated Verification:

- `npm install` completes without error inside `packages/code-reviewer/`
- `ls packages/code-reviewer/evals/fixtures` exits 0
- `npm run typecheck` still passes

#### Manual Verification:

- `cat packages/code-reviewer/package.json` shows `"promptfoo": "0.121.17"` under `devDependencies` and `"eval": "promptfoo eval --config evals/promptfooconfig.yaml"` under `scripts`
- `node_modules/.bin/promptfoo --version` (from `packages/code-reviewer/`) prints `0.121.17`

**Implementation Note**: Confirm typecheck + manual checks before moving to Phase 2.

---

## Phase 2: Fixture Files

### Overview

Write the two fixture files that the promptfoo config will load: `system-prompt.txt` (verbatim `REVIEW_SYSTEM_INSTRUCTIONS`) and `react-migration.diff` (the intentionally flawed PR).

### Changes Required:

#### 1. System prompt fixture

**File**: `packages/code-reviewer/evals/fixtures/system-prompt.txt`

**Intent**: Store the system prompt as a plain text file so `promptfooconfig.yaml` can reference it with `file://fixtures/system-prompt.txt` rather than inlining ~30 lines of YAML. Content is the exact string value of `REVIEW_SYSTEM_INSTRUCTIONS` from `src/prompts.ts:3–33`.

**Contract**: Plain text, no wrappers. Copy the string value verbatim, including the closing `IMPORTANT: Return ONLY raw JSON …` sentence. If `REVIEW_SYSTEM_INSTRUCTIONS` is ever updated in `src/prompts.ts`, this file must be synced manually.

#### 2. React 16→19 migration diff fixture

**File**: `packages/code-reviewer/evals/fixtures/react-migration.diff`

**Intent**: A realistic, 80–120 line unified diff for a PR titled "Migrate UserCard component from React 16 to React 19", containing exactly three breaking API flaws that a correct code review must identify and score down on.

**Contract**: Standard unified diff format (`diff --git`, `---`, `+++`, `@@` headers). Two files changed:

**`src/components/UserCard.tsx`** — a class component that gains badge display and click-handler features. The `+` lines must embed two flaws:
1. `ref="cardTitle"` as a JSX string literal ref on a heading element — string refs were removed in React 19
2. `badges.map((badge) => <li className="badge">…</li>)` without a `key` prop — omitting key causes incorrect reconciliation

The component should otherwise look competent: typed props/state interfaces, async `componentDidMount` with error handling, event handler method, conditional rendering.

**`src/index.tsx`** — touched by the PR (adds a `UserCard` import) but `ReactDOM.render()` is left in the context lines. The flaw embedded here:
3. `ReactDOM.render(<App />, document.getElementById('root'))` remains unchanged — `ReactDOM.render` was removed in React 19; the author should have migrated to `createRoot()` as part of this PR

The three flaws must each be individually identifiable from reading the diff alone, without runtime execution.

### Success Criteria:

#### Automated Verification:

- `wc -l packages/code-reviewer/evals/fixtures/react-migration.diff` prints between 80 and 120

#### Manual Verification:

- `cat evals/fixtures/system-prompt.txt` content matches `REVIEW_SYSTEM_INSTRUCTIONS` from `src/prompts.ts` verbatim (same opening and closing lines)
- Reading the diff: all three flaws are individually identifiable — string ref in UserCard, missing key in badge map, `ReactDOM.render` in index.tsx context
- The non-flawed portions of the diff read as competent, realistic code

**Implementation Note**: Verify both files manually before proceeding.

---

## Phase 3: promptfoo Configuration

### Overview

Author `evals/promptfooconfig.yaml` with three native OpenRouter providers, the chat-format prompt template, default vars, the markdown-fence transform, and the React migration test case with three assertions.

### Changes Required:

#### 1. promptfooconfig.yaml

**File**: `packages/code-reviewer/evals/promptfooconfig.yaml`

**Intent**: The complete eval configuration. Loads the system prompt from the fixture file, templates the user turn inline, runs all three providers against the single test case, and applies three assertions.

**Contract**:

**`description`**: `"Code reviewer: multi-model prompt evaluation"`

**`providers`** — three entries, native `openrouter:` prefix, no extra config needed:
```yaml
providers:
  - openrouter:anthropic/claude-sonnet-4.5
  - openrouter:z-ai/glm-5.1
  - openrouter:deepseek/deepseek-v4-flash
```

**`prompts`** — one entry in JSON chat-array format (YAML block scalar, JSON string value). This sends the system prompt in the `system` role, which native chat models handle correctly:
```yaml
prompts:
  - label: code-review
    raw: |
      [
        {"role": "system", "content": "{{systemPrompt}}"},
        {"role": "user", "content": "PR Title: {{prTitle}}\n\nGit Diff:\n{{gitDiff}}"}
      ]
```

**`defaultTest`**:
```yaml
defaultTest:
  vars:
    systemPrompt: "file://fixtures/system-prompt.txt"
  options:
    transform: "output.replace(/^```json\\s*/m, '').replace(/\\s*```\\s*$/m, '').trim()"
```

**`tests`** — one test case:
```yaml
tests:
  - description: "React 16→19 migration with three breaking API flaws"
    vars:
      prTitle: "Migrate UserCard component from React 16 to React 19"
      gitDiff: "file://fixtures/react-migration.diff"
    assert:
      - type: javascript
        description: "Output must be valid ReviewOutput JSON with all required keys"
        value: |
          (() => {
            try {
              const r = JSON.parse(output);
              const criteria = ['implementationCorrectness','idiomaticity','complexity',
                                'testRiskCoverage','documentation','securitySafety'];
              return criteria.every(k => k in r && typeof r[k].score === 'number')
                && typeof r.passed === 'boolean'
                && typeof r.overallSummary === 'string';
            } catch { return false; }
          })()
      - type: javascript
        description: "Review must fail — all three flaws are critical breaking changes"
        value: "JSON.parse(output).passed === false"
      - type: llm-rubric
        provider: openrouter:anthropic/claude-sonnet-4.5
        value: |
          The code review output must identify all three of the following React 19 migration issues:
          1. ReactDOM.render() is still used in the entry point instead of createRoot() — this API was removed in React 19
          2. A string ref literal (ref="someString" as a JSX string attribute) appears in the component — string refs were removed in React 19
          3. A .map() render call produces list elements without a key prop — omitting key causes incorrect React reconciliation
          Grade: PASS if the review text clearly identifies at least two of the three issues above.
```

### Success Criteria:

#### Automated Verification:

- `npx promptfoo eval --config evals/promptfooconfig.yaml --dry-run` exits 0 (config parses without error)
- `npm run typecheck` passes

#### Manual Verification:

- `cat evals/promptfooconfig.yaml` shows all three providers, the chat-format prompt with system/user roles, the transform expression, and three assertions including the `llm-rubric` with an explicit `provider` field

**Implementation Note**: Run the dry-run before proceeding to Phase 4. A config parse error here is cheaper to fix than a mid-run failure.

---

## Phase 4: Run and Verify

### Overview

Execute `npm run eval` and confirm the results are meaningful — all three providers return valid JSON, the static assertions behave as expected, and the `llm-rubric` judgment is interpretable.

### Changes Required:

No source changes. This phase is verification only.

### Success Criteria:

#### Automated Verification:

- `npm run eval` (from within `packages/code-reviewer/`) exits without crash
- promptfoo output table shows 3 providers × 1 test case = 3 result rows
- At least 1 of 3 providers passes all three assertions (Sonnet should catch all three flaws)

#### Manual Verification:

- All three providers return output that parses as valid ReviewOutput JSON (the JSON schema assertion confirms this automatically; inspect the raw output column if it fails)
- `passed === false` fires on all three providers
- The `llm-rubric` column shows which models' reviews correctly identified the three React 19 flaws
- Score differences across models are visible (non-trivial discrimination — Sonnet should score `idiomaticity` and `implementationCorrectness` more harshly on the string ref and `ReactDOM.render` flaws)

**If a provider consistently fails the JSON schema assertion**: inspect the raw output. If markdown fences are present, confirm the `transform` expression is correctly escaped in the YAML. If JSON is malformed (not just wrapped), the model may need a stronger closing instruction in the system prompt — this is out of scope for this plan but can be addressed as follow-up.

---

## Testing Strategy

### Automated:
- `npm run eval` is the eval runner — promptfoo outputs pass/fail per assertion per provider

### Manual Testing Steps:
1. Run `npm run eval` and confirm 3 rows appear in the results table
2. Verify the JSON schema assertion column shows ✓ for all three providers (or debug the transform if not)
3. Verify `passed === false` for all three providers
4. Inspect the `llm-rubric` column — does the judge agree that the review identified the flaws?
5. Optionally: open `promptfoo view` to browse detailed output per provider in the local web UI

## References

- Research doc: `context/changes/code-review-evals/research.md`
- System prompt source: `packages/code-reviewer/src/prompts.ts:3–33`
- User prompt builder: `packages/code-reviewer/src/prompts.ts:35–42`
- ReviewOutput schema: `packages/code-reviewer/src/schemas.ts:15–25`
- lessons.md: exact npm versions, no `^` or `~`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scaffold

#### Automated

- [x] 1.1 `npm install` completes without error after adding promptfoo devDependency — bd1a726
- [x] 1.2 `ls packages/code-reviewer/evals/fixtures` exits 0 — bd1a726
- [x] 1.3 `npm run typecheck` passes — bd1a726

#### Manual

- [ ] 1.4 package.json shows `"promptfoo": "0.121.17"` and `"eval"` script
- [ ] 1.5 `node_modules/.bin/promptfoo --version` prints `0.121.17`

### Phase 2: Fixture Files

#### Automated

- [x] 2.1 `wc -l react-migration.diff` prints between 80 and 120 — 98be049

#### Manual

- [ ] 2.2 All three flaws are individually identifiable in the diff
- [ ] 2.3 `system-prompt.txt` content matches `REVIEW_SYSTEM_INSTRUCTIONS` verbatim

### Phase 3: promptfoo Configuration

#### Automated

- [x] 3.1 `npx promptfoo eval --dry-run` exits 0
- [x] 3.2 `npm run typecheck` passes

#### Manual

- [x] 3.3 Config shows all three providers, chat-format prompt, transform expression, and three assertions with explicit `provider` on `llm-rubric`

### Phase 4: Run and Verify

#### Automated

- [ ] 4.1 `npm run eval` exits without crash
- [ ] 4.2 Results table shows 3 providers × 1 test case = 3 rows

#### Manual

- [ ] 4.3 All three providers return valid ReviewOutput JSON
- [ ] 4.4 `passed === false` on all three providers
- [ ] 4.5 `llm-rubric` column shows meaningful judgments per provider
