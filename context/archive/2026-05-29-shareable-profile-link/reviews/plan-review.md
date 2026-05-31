<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Shareable Profile Link Enhancement

- **Plan**: [context/changes/shareable-profile-link/plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: REVISE
- **Findings**: [0 critical] [4 warnings] [1 observation]

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | WARNING |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

5/5 paths ✓, 5/5 symbols ✓, brief↔plan ✓

## Findings

### F1 — URL construction approach inconsistent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Integrate into ProfileDisplay
- **Detail**: Phase 3 shows passing profileUrl constructed server-side with `Astro.url.origin`, then adds a confusing note: "client-side re-construction inside ShareModal also works with window.location.origin". This implies ShareModal might reconstruct the URL despite receiving it as a prop, which would be wasteful. Phase 2's ShareModal contract shows it accepting `profileUrl` prop but doesn't specify whether it uses that prop or reconstructs the URL. Current implementation uses `window.location.origin` (line 182 of ProfileDisplay.astro). Implementer needs clarity on which approach to follow.
- **Fix A ⭐ Recommended**: Server-side construction only — pass full URL, ShareModal uses it directly
  - Strength: Clean separation — Astro handles URL construction, ShareModal is a pure presentation component. Aligns with "no server-side URL construction changes" scope item.
  - Tradeoff: ShareModal always depends on correct prop — can't be used standalone with just username.
  - Confidence: HIGH — matches React props-down pattern; server knows origin.
  - Blind spot: None significant.
- **Fix B**: Client-side construction only — pass username, ShareModal builds URL
  - Strength: ShareModal is self-sufficient; works anywhere with just username.
  - Tradeoff: Props interface changes from what Phase 3 shows; duplicates window.location.origin logic.
  - Confidence: HIGH — matches current clipboard script pattern at line 182.
  - Blind spot: None significant.
- **Decision**: FIXED (via Fix A)

### F2 — Line numbers don't match current code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Integrate into ProfileDisplay
- **Detail**: Plan references "lines 158-165" for button and "lines 173-187" for script, but current ProfileDisplay.astro shows button conditional at lines 158-172 and script block at lines 176-195. Not a major blocker but will confuse implementer looking for exact replacement points.
- **Fix**: Update plan to reference "the entire conditional block at lines 158-172 and the script block at lines 176-195" or "starting at line 158".
- **Decision**: FIXED

### F3 — No clipboard fallback specified in success criteria

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Create ShareModal Component
- **Detail**: Plan mentions "Clipboard API failure" only in Testing Strategy edge cases, not as an explicit success criterion. Phase 2 contract doesn't specify what ShareModal does when `navigator.clipboard.writeText()` fails (older browsers, non-HTTPS context). Open Risks mentions HTTPS requirement but no error handling UX is defined. Research shows sonner toast is available and already used for errors in StatusToggle and PhotoUpload components.
- **Fix**: Add automated success criterion to Phase 2: "Copy button shows error toast when clipboard API fails or is unavailable" and specify in ShareModal contract: wrap clipboard call in try/catch, call `toast.error("Failed to copy link")` on failure.
  - Strength: Consistent error UX with existing components; handles real browser compatibility issue.
  - Tradeoff: Minor — adds 7-8 lines of error handling code.
  - Confidence: HIGH — matches PhotoUpload pattern at lines 67,76.
  - Blind spot: None significant.
- **Decision**: FIXED

### F4 — Touch target sizes not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Create ShareModal Component
- **Detail**: Phase 4 success criterion 4.7 says "Touch targets are adequately sized" but Phase 2's ShareModal implementation contract doesn't specify actual button dimensions or padding. WCAG 2.1 AAA requires minimum 44×44px touch targets. Current copy button in ProfileDisplay.astro uses `px-4 py-2` which is ~32px height — below the 44px minimum.
- **Fix**: Specify in Phase 2 ShareModal contract that all interactive elements (Copy button, Email button, close X) use minimum h-11 (44px) and adequate horizontal padding for 44px tap area. Reference WCAG 2.1 guideline 2.5.5.
  - Strength: Ensures accessibility compliance; prevents Phase 4 rework.
  - Tradeoff: Minor — might need larger modal or tighter spacing; still fits in max-w-md on mobile.
  - Confidence: HIGH — 44px is industry standard; existing Button component sizes support it (default h-9, lg h-10, custom h-11 works).
  - Blind spot: None significant.
- **Decision**: FIXED

### F5 — Enhancement scope beyond PRD must-have

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Lean Execution
- **Location**: Overall scope
- **Detail**: PRD FR-005 requires "User can generate and copy their own profile link to share with others" (must-have priority). Research.md confirms this is already fully implemented via copy-to-clipboard button in ProfileDisplay. Research recommendation (Option A): "Mark S-02 complete immediately — FR-005 is fully implemented. Any enhancements should be considered future features, not MVP blockers." This plan adds QR code generation and email sharing as enhancements beyond the PRD must-have. While valuable, this increases scope from "done" to "~2-3 focused sessions across 4 phases" plus two new dependencies (~60KB gzipped total). Plan acknowledges this in title ("Enhancement") but doesn't reference the research recommendation or justify why QR + email are worth adding now vs. later.
- **Fix**: Confirm enhancement scope is intentional and valuable enough to justify the effort. If yes, proceed as planned. If uncertain, consider shipping the improved toast-based copy flow first (addressing archived impl-review drift), then adding QR + email in a follow-up change.
  - Strength: Respects research-backed planning chain; surfaces the tradeoff explicitly for product decision.
  - Tradeoff: Might delay nice-to-have features if decision is "defer".
  - Confidence: MEDIUM — depends on product priorities not visible in plan.
  - Blind spot: User roadmap context (is there pressure to ship other features first? Is shareable profile a differentiator that justifies polish now?).
- **Decision**: FIXED
