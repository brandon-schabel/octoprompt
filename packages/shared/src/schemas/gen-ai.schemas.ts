import { z } from '@hono/zod-openapi';
import { AI_API_PROVIDERS } from './provider-key.schemas'; // Keep provider list separate or move here if preferred

// --- Basic AI Interaction Schemas ---

// Re-exporting MessageRoleEnum might be useful here if it's truly generic AI,
// or keep it in chat.schemas if it's tightly coupled to chat messages.
// Let's keep it in chat.schemas for now as it's used there extensively.
import { MessageRoleEnum } from './common.schemas';

// --- Schema for individual messages (aligns with Vercel AI SDK CoreMessage) ---
export const AiMessageSchema = z.object({
    role: MessageRoleEnum,
    content: z.string(),
    // Keep optional fields if needed internally, but often not needed for basic requests
    // id: z.string().optional(),
    // name: z.string().optional(),
    // tool_call_id: z.string().optional(),
}).openapi('AiMessage');

// --- Schema for AI SDK Options ---
// Make sure this aligns with what Vercel/your provider actually accepts/uses
export const AiSdkOptionsSchema = z.object({
    model: z.string().optional().openapi({ example: 'gpt-4-turbo', description: 'Model ID to use' }),
    temperature: z.number().min(0).max(2).optional().openapi({ example: 0.7 }),
    maxTokens: z.number().int().positive().optional().openapi({ example: 100000 }), // Renamed from max_tokens for consistency
    topP: z.number().min(0).max(1).optional().openapi({ example: 1 }), // Renamed from top_p
    frequencyPenalty: z.number().optional().openapi({ example: 0 }), // Renamed from frequency_penalty
    presencePenalty: z.number().optional().openapi({ example: 0 }), // Renamed from presence_penalty
    topK: z.number().int().positive().optional().openapi({ example: -1 }), // Renamed from top_k
    stop: z.union([z.string(), z.array(z.string())]).optional(), // Added stop sequences
    response_format: z.any().optional().openapi({ description: 'Provider-specific response format options (e.g., { type: "json_object" })' }), // Use z.any() if structure varies greatly
    // Optional fields specific to Vercel AI SDK Structured Output (might be less relevant if using generateObject directly)
    // structuredOutputMode: z.enum(['auto', 'tool', 'json']).optional().openapi({ description: "Mode for structured output (if supported)" }),
    // schemaName: z.string().optional().openapi({ description: "Name for structured output schema" }),
    // schemaDescription: z.string().optional().openapi({ description: "Description for structured output schema" }),
    // outputStrategy: z.enum(['object', 'array', 'enum', 'no-schema']).optional().openapi({ description: "Strategy for structured output generation" }),
}).partial().openapi('AiSdkOptions'); // Made optional overall, as not all fields are always needed

// --- Schema for Available Models ---
const UnifiedModelSchema = z.object({
    id: z.string().openapi({ example: 'gpt-4-turbo', description: 'Model identifier' }),
    name: z.string().openapi({ example: 'GPT-4 Turbo', description: 'User-friendly model name' }),
    provider: z.string().openapi({ example: 'openai', description: 'Provider ID' }),
    context_length: z.number().optional().openapi({ example: 128000, description: 'Context window size' }),
    // Add other relevant fields like 'description', 'capabilities', etc.
}).openapi('UnifiedModel');

export { UnifiedModelSchema }; // Export the schema

export const ModelsListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(UnifiedModelSchema) // Use the newly defined model schema
}).openapi('ModelsListResponse'); // Register as component

// --- Schema for Quick, One-Off Text Generation Request ---
export const AiGenerateTextRequestSchema = z.object({
    prompt: z.string().min(1, { message: "Prompt cannot be empty." }).openapi({
        description: 'The text prompt for the AI.',
        example: 'Suggest 5 suitable filenames for a typescript utility file containing helper functions for string manipulation.'
    }),
    provider: z.enum(AI_API_PROVIDERS).or(z.string()).openapi({
        example: 'openai',
        description: 'The AI provider to use (e.g., openai, openrouter, groq).'
    }),
    model: z.string().min(1).openapi({ // Model is required here as there's no chat context default
        example: 'gpt-4o',
        description: 'The specific model identifier to use.'
    }),
    options: AiSdkOptionsSchema.optional().openapi({ // Make options optional
        description: 'Optional parameters for the AI model (temperature, maxTokens, etc.).'
    }),
    systemMessage: z.string().optional().openapi({
        example: 'You are an expert programmer. Provide concise and relevant suggestions.',
        description: 'Optional system message to guide the AI.'
    }),
    // Add optional messages field if few-shot is desired for this endpoint
    // messages: z.array(messageSchema).optional().openapi({
    //  description: 'Optional few-shot examples or preceding context.'
    // }),
}).openapi('AiGenerateTextRequest');

// --- Schema for Quick, One-Off Text Generation Response ---
export const AiGenerateTextResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        text: z.string().openapi({ description: "The generated text response from the AI." })
    })
}).openapi('AiGenerateTextResponse');



// --- Base Schema for Structured Data Configuration (for validation of static parts) ---
export const BaseStructuredDataConfigSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    // We cannot include 'schema: z.ZodSchema' here in a type-safe generic way.
    // The actual schema instance is stored separately in the runtime configuration object.
    modelSettings: AiSdkOptionsSchema.optional(), // Use the existing AiSdkOptionsSchema
    systemPrompt: z.string().optional(),
    promptTemplate: z.string().min(1).refine(s => s.includes('{userInput}'), {
        message: "promptTemplate must include the placeholder '{userInput}'"
    }),
}).openapi('BaseStructuredDataConfig');


// --- Schemas for Structured Data Generation ---

// Define the structure for the configuration of each structured task
export type BaseStructuredDataConfig = z.infer<typeof BaseStructuredDataConfigSchema>;


// --- Keep the TypeScript Interface for Runtime Use ---
// This interface correctly types the complete structure including the specific schema
export interface StructuredDataSchemaConfig<T extends z.ZodTypeAny> extends BaseStructuredDataConfig {
    schema: T; // The actual Zod schema for the output
}

// Input schema for the structured data endpoint
export const AiGenerateStructuredRequestSchema = z.object({
    schemaKey: z.string().min(1).openapi({
        description: "The key identifying the predefined structured task to perform.",
        example: "filenameSuggestion"
    }),
    userInput: z.string().min(1).openapi({
        description: "The user's input or context for the task.",
        example: "A react component for displaying user profiles"
    }),
    provider: z.enum(AI_API_PROVIDERS).or(z.string()).optional().openapi({
        description: "Optional: Override the default AI provider for this task."
    }),
    options: AiSdkOptionsSchema.optional().openapi({
        description: "Optional: Override default model options (temperature, etc.) for this task."
    }),
}).openapi('AiGenerateStructuredRequest');

// Generic response schema for the structured data endpoint
// The actual 'data.output' structure depends on the specific 'schemaKey' used
export const AiGenerateStructuredResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        output: z.any().openapi({ description: "The generated structured data, matching the schema defined by the 'schemaKey'." })
        // You could add metadata here if needed, like model used, tokens, etc.
    })
}).openapi('AiGenerateStructuredResponse');


// --- Type Exports ---
export type AiSdkOptions = z.infer<typeof AiSdkOptionsSchema>;
export type AiGenerateTextRequest = z.infer<typeof AiGenerateTextRequestSchema>;
export type AiGenerateStructuredRequest = z.infer<typeof AiGenerateStructuredRequestSchema>;
export type UnifiedModel = z.infer<typeof UnifiedModelSchema>;
export type AiMessage = z.infer<typeof AiMessageSchema>;
