import { z } from 'zod';

export const ReviewInputSchema = z.object({
  prTitle: z.string().min(1),
  prDescription: z.string().optional(),
  gitDiff: z.string().min(1),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const CriterionSchema = z.object({
  score: z.number(),
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
  passed: z.boolean(),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
