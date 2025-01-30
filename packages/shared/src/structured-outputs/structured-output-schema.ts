import { z } from "zod";

/**
 * This schema defines the input for an API call that requests
 * a structured output from OpenRouter.
 *
 * You can expand this with additional parameters if needed.
 */
export const structuredOutputRequestSchema = z.object({
    /**
     * The prompt we want to send to the AI model.
     */
    prompt: z.string().min(1, "Prompt cannot be empty."),

    /**
     * Arbitrary model name or config (depending on how you structure your OpenRouter calls).
     * This is optional and just an example field for demonstration.
     */
    model: z.string().optional(),

    /**
     * Example: you might allow the user to specify temperature, max_tokens, etc.
     * For brevity, these are omitted or typed loosely, but you can refine with Zod as needed.
     */
    temperature: z.number().min(0).max(2).default(0.7).optional(),
});
export type StructuredOutputRequest = z.infer<typeof structuredOutputRequestSchema>;

/**
 * This is an example of a “structured output” shape
 * that you expect from the AI. You might define many different shapes.
 *
 * For demonstration, let's assume we expect the AI to return:
 * - `title` (string)
 * - `tags` (array of strings)
 * - `score` (number, 0–100)
 */
export const exampleStructuredOutputSchema = z.object({
    title: z.string().min(1),
    tags: z.array(z.string()).default([]),
    score: z.number().min(0).max(100),
});

export type ExampleStructuredOutput = z.infer<typeof exampleStructuredOutputSchema>;