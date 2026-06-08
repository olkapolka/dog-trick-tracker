---
change_id: testing-critical-access-failure-floor
title: Testing critical access failure floor
status: implemented
created: 2026-06-03
updated: 2026-06-08
archived_at: null
---

## Notes

Risks covered: #1, #3, #5. Test types planned: integration + focused unit.
Risk response intent:

#1: prove authenticated users consistently reach protected screens through session transitions.
#3: prove failure states show explicit and correct fallback behavior, not silent success.
#5: prove unauthorized ownership/action attempts are denied consistently.
After creating the folder, follow the downstream continuation rule.

Planning decisions (2026-06-08):
- Use a hybrid integration harness (in-process integration + runtime-backed smoke path for session transitions).
- Require explicit fallback/error distinction for SSR failure states (not empty-state fallback on failure).
- Define distinct helper error contracts for score/admin helpers (do not collapse into valid zero/false outcomes).
- Cover ownership denial with endpoint scoping assertions plus RLS backstop checks.

