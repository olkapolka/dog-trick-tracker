import { ToolLoopAgent, Output, InferAgentUIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ReviewInputSchema, ReviewOutputSchema } from "./schemas.js";
import { buildReviewPrompt, REVIEW_SYSTEM_INSTRUCTIONS } from "./prompts.js";
import type { ReviewInput, ReviewOutput } from "./schemas.js";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export const codeReviewerAgent = new ToolLoopAgent({
  model: openrouter("anthropic/claude-sonnet-4.5"),
  instructions: REVIEW_SYSTEM_INSTRUCTIONS,
  output: Output.object({ schema: ReviewOutputSchema }),
});

export type CodeReviewerUIMessage = InferAgentUIMessage<typeof codeReviewerAgent>;

export async function reviewCode(input: ReviewInput): Promise<ReviewOutput> {
  const validated = ReviewInputSchema.parse(input);
  const result = await codeReviewerAgent.generate({
    prompt: buildReviewPrompt(validated),
  });
  return result.output;
}
