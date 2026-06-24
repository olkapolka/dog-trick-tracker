import { z } from 'zod';

export const ReviewInputSchema = z.object({
  code: z.string().min(1),
  language: z.string().optional(),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

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
