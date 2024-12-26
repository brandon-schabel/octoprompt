import { z } from "zod";

// -------------------------------------
// BASE MODEL OPTION SCHEMAS
// -------------------------------------
const baseModelOptionsSchema = z.object({
    model: z.string().optional(),
    max_tokens: z.number().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    frequency_penalty: z.number().optional(),
    presence_penalty: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
});

// -------------------------------------
// PROVIDER-SPECIFIC OPTION SCHEMAS
// -------------------------------------
// OpenAI
const openAIOptionsSchema = baseModelOptionsSchema.extend({
    response_format: z.object({ type: z.enum(["text", "json_object"]) }).optional(),
    seed: z.number().optional(),
    tools: z
        .array(
            z.object({
                type: z.literal("function"),
                function: z.object({
                    name: z.string(),
                    description: z.string().optional(),
                    parameters: z.record(z.unknown()),
                }),
            })
        )
        .optional(),
    tool_choice: z
        .union([
            z.literal("none"),
            z.literal("auto"),
            z.object({
                type: z.literal("function"),
                function: z.object({ name: z.string() }),
            }),
        ])
        .optional(),
});

// OpenRouter
const openRouterOptionsSchema = baseModelOptionsSchema.extend({
    provider_preferences: z
        .object({
            allow_fallbacks: z.boolean().optional(),
            require_parameters: z.boolean().optional(),
            data_collection: z.enum(["deny", "allow"]).optional(),
            order: z.array(z.string()).optional(),
            ignore: z.array(z.string()).optional(),
            quantizations: z.array(z.string()).optional(),
        })
        .optional(),
    response_format: z
        .object({
            type: z.enum(["json_object", "json_schema"]),
            schema: z.record(z.unknown()).optional(),
        })
        .optional(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
    seed: z.number().optional(),
    top_k: z.number().optional(),
    repetition_penalty: z.number().optional(),
    logit_bias: z.record(z.number()).optional(),
    top_logprobs: z.number().optional(),
    min_p: z.number().optional(),
    top_a: z.number().optional(),
    transforms: z.array(z.string()).optional(),
    models: z.array(z.string()).optional(),
    route: z.literal("fallback").optional(),
});

// LM Studio
const lmStudioOptionsSchema = baseModelOptionsSchema.extend({
    response_format: z.object({ type: z.enum(["text", "json_object"]) }).optional(),
    seed: z.number().optional(),
    top_k: z.number().optional(),
    repeat_penalty: z.number().optional(),
    // presence_penalty & frequency_penalty already in base, but you can override if needed
    logit_bias: z.record(z.number()).optional(),
});

// Ollama
const ollamaOptionsSchema = baseModelOptionsSchema.extend({
    format: z
        .object({
            type: z.enum(["json_object", "json_schema"]),
            schema: z.record(z.unknown()).optional(),
        })
        .optional(),
    options: z
        .object({
            num_keep: z.number().optional(),
            seed: z.number().optional(),
            num_predict: z.number().optional(),
            top_k: z.number().optional(),
            top_p: z.number().optional(),
            min_p: z.number().optional(),
            typical_p: z.number().optional(),
            repeat_last_n: z.number().optional(),
            temperature: z.number().optional(),
            repeat_penalty: z.number().optional(),
            presence_penalty: z.number().optional(),
            frequency_penalty: z.number().optional(),
            mirostat: z.number().optional(),
            mirostat_tau: z.number().optional(),
            mirostat_eta: z.number().optional(),
            penalize_newline: z.boolean().optional(),
            stop: z.array(z.string()).optional(),
            numa: z.boolean().optional(),
            num_ctx: z.number().optional(),
            num_batch: z.number().optional(),
            num_gpu: z.number().optional(),
            main_gpu: z.number().optional(),
            low_vram: z.boolean().optional(),
            vocab_only: z.boolean().optional(),
            use_mmap: z.boolean().optional(),
            use_mlock: z.boolean().optional(),
            num_thread: z.number().optional(),
        })
        .optional(),
});

// XAI & Gemini (if you’re not sure, you could simply do a pass-through or define as needed)
const xaiOptionsSchema = baseModelOptionsSchema; // customize as needed
const geminiOptionsSchema = baseModelOptionsSchema; // customize as needed

// -------------------------------------
// CREATE BODY SCHEMA (DISCRIMINATED)
// -------------------------------------
// We keep the rest of the fields (message, chatId, etc.) the same,
// but refine `provider` and `options` with the union approach.
export const createBodySchema = z.discriminatedUnion("provider", [
    z.object({
        provider: z.literal("openai"),
        options: openAIOptionsSchema.optional(),
        message: z.string().min(1),
        chatId: z.string(),
        excludedMessageIds: z.array(z.string()).optional(),
        tempId: z.string().optional(),
    }),
    z.object({
        provider: z.literal("openrouter"),
        options: openRouterOptionsSchema.optional(),
        message: z.string().min(1),
        chatId: z.string(),
        excludedMessageIds: z.array(z.string()).optional(),
        tempId: z.string().optional(),
    }),
    z.object({
        provider: z.literal("lmstudio"),
        options: lmStudioOptionsSchema.optional(),
        message: z.string().min(1),
        chatId: z.string(),
        excludedMessageIds: z.array(z.string()).optional(),
        tempId: z.string().optional(),
    }),
    z.object({
        provider: z.literal("ollama"),
        options: ollamaOptionsSchema.optional(),
        message: z.string().min(1),
        chatId: z.string(),
        excludedMessageIds: z.array(z.string()).optional(),
        tempId: z.string().optional(),
    }),
    // If you want to keep xai/gemini as pass-through for now:
    z.object({
        provider: z.literal("xai"),
        options: xaiOptionsSchema.optional(),
        message: z.string().min(1),
        chatId: z.string(),
        excludedMessageIds: z.array(z.string()).optional(),
        tempId: z.string().optional(),
    }),
    z.object({
        provider: z.literal("gemini"),
        options: geminiOptionsSchema.optional(),
        message: z.string().min(1),
        chatId: z.string(),
        excludedMessageIds: z.array(z.string()).optional(),
        tempId: z.string().optional(),
    }),
]).default({
    provider: "openai",
    message: "",
    chatId: "",
});

export type OpenAIOptions = z.infer<typeof openAIOptionsSchema>;
export type OpenRouterOptions = z.infer<typeof openRouterOptionsSchema>;
export type LMStudioOptions = z.infer<typeof lmStudioOptionsSchema>;
export type OllamaOptions = z.infer<typeof ollamaOptionsSchema>;

// -------------------------------------
// EXAMPLE: Generically typed interface if you do not want to maintain
// separate Zod schemas for each provider
// -------------------------------------

export interface ModelOptions<TProvider extends string> {
    provider: TProvider;
    options?: TProvider extends 'openai'
    ? OpenAIOptions
    : TProvider extends 'openrouter'
    ? OpenRouterOptions
    : TProvider extends 'lmstudio'
    ? LMStudioOptions
    : TProvider extends 'ollama'
    ? OllamaOptions
    : Record<string, unknown>;
}
/*
// Then define a generic body type:
type CreateMessageBodyGeneric<TProvider extends string> = {
  message: string;
  chatId: string;
  excludedMessageIds?: string[];
  tempId?: string;
} & ModelOptions<TProvider>;
*/