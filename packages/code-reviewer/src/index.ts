import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { z } from 'zod';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const ReviewInputSchema = z.object({
  code: z.string().min(1),
  language: z.string().optional(),
});

type ReviewInput = z.infer<typeof ReviewInputSchema>;

async function reviewCode(input: ReviewInput): Promise<string> {
  const { code, language } = ReviewInputSchema.parse(input);

  const { text } = await generateText({
    model: openrouter('anthropic/claude-sonnet-4'),
    prompt: `Review the following${language ? ` ${language}` : ''} code and provide concise feedback:\n\n${code}`,
  });

  return text;
}

const exampleInput: ReviewInput = {
  code: `function add(a, b) { return a + b; }`,
  language: 'JavaScript',
};

reviewCode(exampleInput).then(console.log).catch(console.error);
