import { z } from "zod";

/**
 * For "generateName", we expect an object like:
 * { generatedName: string }
 */
export const generateNameSchema = z.object({
    generatedName: z.string().min(1),
});

/**
 * For "suggestedFiles", we expect an array of objects:
 * [{ fileName: string, relevance: number }, ...]
 */
export const suggestedFilesSchema = z.array(
    z.object({
        fileName: z.string(),
        relevance: z.number().min(0).max(1),
    })
);

/**
 * Put them in a typed map. The keys here become our `StructuredOutputType`s.
 */
export const structuredOutputSchemas = {
    generateName: generateNameSchema,
    suggestedFiles: suggestedFilesSchema,
} as const;

/** 
 * Union of string keys: "generateName" | "suggestedFiles"
 */
export type StructuredOutputType = keyof typeof structuredOutputSchemas;

/**
 * This generic infers the final TypeScript shape for each schema.
 * If you do `InferStructuredOutput<"generateName">`,
 * you get `{ generatedName: string }`.
 * If you do `InferStructuredOutput<"suggestedFiles">`,
 * you get `{ fileName: string; relevance: number; }[]`.
 */
export type InferStructuredOutput<T extends StructuredOutputType> = z.infer<
    typeof structuredOutputSchemas[T]
>;