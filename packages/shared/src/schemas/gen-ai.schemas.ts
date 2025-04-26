import { z } from '@hono/zod-openapi';
import { AI_API_PROVIDERS } from './provider-key.schemas'; // Keep provider list separate or move here if preferred

// --- Basic AI Interaction Schemas ---

// Re-exporting MessageRoleEnum might be useful here if it's truly generic AI,
// or keep it in chat.schemas if it's tightly coupled to chat messages.
// Let's keep it in chat.schemas for now as it's used there extensively.
import { MessageRoleEnum } from './common.schemas';
import { LOW_MODEL_CONFIG } from '../constants/model-default-configs';

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
    temperature: z.number().min(0).max(2).optional().openapi({
        description: "Controls the randomness of the output. Lower values (e.g., 0.2) make the output more focused, deterministic, and suitable for factual tasks. Higher values (e.g., 0.8) increase randomness and creativity, useful for brainstorming or creative writing. A value of 0 typically means greedy decoding (always picking the most likely token).",
        example: LOW_MODEL_CONFIG.temperature ?? 0.7 // A common default balancing creativity and coherence
    }),
    maxTokens: z.number().int().positive().optional().openapi({
        description: "The maximum number of tokens (words or parts of words) the model is allowed to generate in the response. This limits the output length and can affect cost. Note: This limit usually applies only to the *generated* tokens, not the input prompt tokens.",
        example: LOW_MODEL_CONFIG.max_tokens ?? 1024 // Example: Limit response to roughly 1024 tokens
    }),
    topP: z.number().min(0).max(1).optional().openapi({
        description: "Controls diversity via nucleus sampling. It defines a probability threshold (e.g., 0.9). The model considers only the smallest set of most probable tokens whose cumulative probability exceeds this threshold for the next token selection. Lower values (e.g., 0.5) restrict choices more, leading to less random outputs. A value of 1 considers all tokens. It's often recommended to alter *either* `temperature` *or* `topP`, not both.",
        example: LOW_MODEL_CONFIG.top_p ?? 0.9 // Example: Consider top 90% probable tokens
    }),
    frequencyPenalty: z.number().min(-2).max(2).optional().openapi({ // Added typical range
        description: "Applies a penalty to tokens based on how frequently they have already appeared in the generated text *and* the prompt. Positive values (e.g., 0.5) decrease the likelihood of the model repeating the same words or phrases verbatim, making the output less repetitive. Negative values encourage repetition.",
        example: LOW_MODEL_CONFIG.frequency_penalty ?? 0.2 // Example: Slightly discourage repeating words
    }),
    presencePenalty: z.number().min(-2).max(2).optional().openapi({ // Added typical range
        description: "Applies a penalty to tokens based on whether they have appeared *at all* in the generated text *and* the prompt so far (regardless of frequency). Positive values (e.g., 0.5) encourage the model to introduce new concepts and topics, reducing the likelihood of repeating *any* previously mentioned word. Negative values encourage staying on topic.",
        example: LOW_MODEL_CONFIG.presence_penalty ?? 0.1 // Example: Slightly encourage introducing new concepts
    }),
    topK: z.number().int().positive().optional().openapi({
        description: "Restricts the model's choices for the next token to the `k` most likely candidates. For example, if `topK` is 40, the model will only consider the top 40 most probable tokens at each step. A lower value restricts choices more. Setting `topK` to 1 is equivalent to greedy decoding (same as `temperature: 0`). Less commonly used than `topP`.",
        example: LOW_MODEL_CONFIG.top_k ?? 40 // Example: Consider only the 40 most likely next tokens
    }),
    stop: z.union([z.string(), z.array(z.string())]).optional().openapi({
        description: "Specifies one or more sequences of text where the AI should stop generating. Once the model generates a stop sequence, it will halt output immediately, even if `maxTokens` hasn't been reached. Useful for structured output or controlling conversational turns.",
        example: ['\nHuman:', '\n---'] // Example: Stop if 'Human:' or '---' appears on a new line
    }),
    response_format: z.any().optional().openapi({ // Kept as z.any due to variance
        description: "Specifies the desired format for the model's response. This is highly provider-specific. A common use case is enforcing JSON output, often requiring specific model versions.",
        example: { type: 'json_object' } // Example: Request JSON output (syntax varies by provider)
    }),
    // structuredOutputMode, schemaName, etc. are often handled by specific library functions
    // like `generateObject` rather than generic options, so keeping them commented out is reasonable
    // unless you have a specific use case for passing them this way.
    provider: z.string().optional().openapi({
        description: "The provider to use for the AI request.",
        example: LOW_MODEL_CONFIG.provider
    }),
    model: z.string().optional().openapi({
        description: "The model to use for the AI request.",
        example: LOW_MODEL_CONFIG.model
    }),

}).partial().openapi('AiSdkOptions'); // .partial() makes all fields optional implicitly

// --- Schema for Available Models ---
const UnifiedModelSchema = z.object({
    id: z.string().openapi({ example: LOW_MODEL_CONFIG.model ?? 'gpt-4o-mini', description: 'Model identifier' }),
    name: z.string().openapi({ example: 'GPT-4o Mini', description: 'User-friendly model name' }),
    provider: z.string().openapi({ example: LOW_MODEL_CONFIG.provider ?? 'openrouter', description: 'Provider ID' }),
    context_length: z.number().optional().openapi({ example: 128000, description: 'Context window size in tokens' }),
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
    options: AiSdkOptionsSchema.optional().openapi({ // Options are optional
        description: 'Optional parameters to override default model behavior (temperature, maxTokens, etc.).'
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
