import { reviewCode } from "./agent.js";

const exampleInput = {
  prTitle: "Add utility function",
  prDescription: "Adds a simple add() helper used by the calculator module.",
  gitDiff: `diff --git a/src/utils.ts b/src/utils.ts
+++ b/src/utils.ts
+export function add(a: number, b: number): number {
+  return a + b;
+}`,
};

reviewCode(exampleInput).then(console.log).catch(console.error);
