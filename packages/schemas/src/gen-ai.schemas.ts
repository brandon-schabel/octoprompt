import { z } from '@hono/zod-openapi'
import { MessageRoleEnum } from './common.schemas'
import { LOW_MODEL_CONFIG } from './constants/model-default-configs'

import { ProjectFileSchema } from './project.schemas'
import { unixTSArraySchemaSpec } from './schema-utils'

// --- Schema for individual messages (aligns with Vercel AI SDK CoreMessage) ---
export const AiMessageSchema = z
  .object({
    role: MessageRoleEnum,
    content: z.string()
  })
  .openapi('AiMessage')

// --- Updated Schema for AI SDK Options ---
// This schema defines common parameters to control the behavior of AI models during generation.
// Not all parameters are supported by all models or providers.
export const AiSdkOptionsSchema = z
  .object({
    temperature: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .openapi({
        description:
          'Controls the randomness of the output. Lower values (e.g., 0.2) make the output more focused, deterministic, and suitable for factual tasks. Higher values (e.g., 0.8) increase randomness and creativity, useful for brainstorming or creative writing. A value of 0 typically means greedy decoding (always picking the most likely token).',
        example: LOW_MODEL_CONFIG.temperature ?? 0.7 // A common default balancing creativity and coherence
      }),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .openapi({
        description:
          'The maximum number of tokens (words or parts of words) the model is allowed to generate in the response. This limits the output length and can affect cost. Note: This limit usually applies only to the *generated* tokens, not the input prompt tokens.',
        example: LOW_MODEL_CONFIG.maxTokens ?? 100000 // Example: Limit response to roughly 1024 tokens
      }),
    topP: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .openapi({
        description:
          "Controls diversity via nucleus sampling. It defines a probability threshold (e.g., 0.9). The model considers only the smallest set of most probable tokens whose cumulative probability exceeds this threshold for the next token selection. Lower values (e.g., 0.5) restrict choices more, leading to less random outputs. A value of 1 considers all tokens. It's often recommended to alter *either* `temperature` *or* `topP`, not both.",
        example: LOW_MODEL_CONFIG.topP ?? 0.9 // Example: Consider top 90% probable tokens
      }),
    frequencyPenalty: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .openapi({
        // Added typical range
        description:
          'Applies a penalty to tokens based on how frequently they have already appeared in the generated text *and* the prompt. Positive values (e.g., 0.5) decrease the likelihood of the model repeating the same words or phrases verbatim, making the output less repetitive. Negative values encourage repetition.',
        example: LOW_MODEL_CONFIG.frequencyPenalty ?? 0.2 // Example: Slightly discourage repeating words
      }),
    presencePenalty: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .openapi({
        // Added typical range
        description:
          'Applies a penalty to tokens based on whether they have appeared *at all* in the generated text *and* the prompt so far (regardless of frequency). Positive values (e.g., 0.5) encourage the model to introduce new concepts and topics, reducing the likelihood of repeating *any* previously mentioned word. Negative values encourage staying on topic.',
        example: LOW_MODEL_CONFIG.presencePenalty ?? 0.1 // Example: Slightly encourage introducing new concepts
      }),
    topK: z
      .number()
      .int()
      .positive()
      .optional()
      .openapi({
        description:
          "Restricts the model's choices for the next token to the `k` most likely candidates. For example, if `topK` is 40, the model will only consider the top 40 most probable tokens at each step. A lower value restricts choices more. Setting `topK` to 1 is equivalent to greedy decoding (same as `temperature: 0`). Less commonly used than `topP`.",
        example: LOW_MODEL_CONFIG.topK ?? 40 // Example: Consider only the 40 most likely next tokens
      }),
    stop: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .openapi({
        description:
          "Specifies one or more sequences of text where the AI should stop generating. Once the model generates a stop sequence, it will halt output immediately, even if `maxTokens` hasn't been reached. Useful for structured output or controlling conversational turns.",
        example: ['\nHuman:', '\n---'] // Example: Stop if 'Human:' or '---' appears on a new line
      }),
    response_format: z
      .any()
      .optional()
      .openapi({
        // Kept as z.any due to variance
        description:
          "Specifies the desired format for the model's response. This is highly provider-specific. A common use case is enforcing JSON output, often requiring specific model versions.",
        example: { type: 'json_object' } // Example: Request JSON output (syntax varies by provider)
      }),
    // structuredOutputMode, schemaName, etc. are often handled by specific library functions
    // like `generateObject` rather than generic options, so keeping them commented out is reasonable
    // unless you have a specific use case for passing them this way.
    provider: z.string().optional().openapi({
      description: 'The provider to use for the AI request.',
      example: LOW_MODEL_CONFIG.provider
    }),
    model: z.string().optional().openapi({
      description: 'The model to use for the AI request.',
      example: LOW_MODEL_CONFIG.model
    })
  })
  .partial()
  .openapi('AiSdkOptions') // .partial() makes all fields optional implicitly

// --- Schema for Available Models ---
const UnifiedModelSchema = z
  .object({
    id: z.string().openapi({ example: LOW_MODEL_CONFIG.model ?? 'gpt-4o-mini', description: 'Model identifier' }),
    name: z.string().openapi({ example: 'GPT-4o Mini', description: 'User-friendly model name' }),
    provider: z.string().openapi({ example: LOW_MODEL_CONFIG.provider ?? 'openrouter', description: 'Provider ID' }),
    context_length: z.number().optional().openapi({ example: 128000, description: 'Context window size in tokens' })
    // Add other relevant fields like 'description', 'capabilities', etc.
  })
  .openapi('UnifiedModel')

export { UnifiedModelSchema }

export const ModelsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(UnifiedModelSchema)
  })
  .openapi('ModelsListResponse')

// --- Schema for Quick, One-Off Text Generation Request ---
export const AiGenerateTextRequestSchema = z
  .object({
    prompt: z.string().min(1, { message: 'Prompt cannot be empty.' }).openapi({
      description: 'The text prompt for the AI.',
      example:
        'Suggest 5 suitable filenames for a typescript utility file containing helper functions for string manipulation.'
    }),
    options: AiSdkOptionsSchema.optional().openapi({
      // Options are optional
      description: 'Optional parameters to override default model behavior (temperature, maxTokens, etc.).'
    }),
    systemMessage: z.string().optional().openapi({
      example: 'You are an expert programmer. Provide concise and relevant suggestions.',
      description: 'Optional system message to guide the AI behavior and persona.'
    })
  })
  .openapi('AiGenerateTextRequest')

// --- Schema for Quick, One-Off Text Generation Response ---
export const AiGenerateTextResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      text: z.string().openapi({ description: 'The generated text response from the AI.' })
    })
  })
  .openapi('AiGenerateTextResponse')

// --- Base Schema for Structured Data Configuration ---
export const BaseStructuredDataConfigSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    modelSettings: AiSdkOptionsSchema.optional(), // Use the updated AiSdkOptionsSchema
    systemPrompt: z.string().optional(),
    promptTemplate: z
      .string()
      .min(1)
      .optional()
      .refine((s) => s?.includes('{userInput}'), {
        message: "promptTemplate must include the placeholder '{userInput}'"
      })
  })
  .openapi('BaseStructuredDataConfig')

// --- Schemas for Structured Data Generation ---
export type BaseStructuredDataConfig = z.infer<typeof BaseStructuredDataConfigSchema>

export interface StructuredDataSchemaConfig<T extends z.ZodTypeAny> extends BaseStructuredDataConfig {
  schema: T
}

export const AiGenerateStructuredRequestSchema = z
  .object({
    schemaKey: z.string().min(1).openapi({
      description: 'The key identifying the predefined structured task configuration.',
      example: 'filenameSuggestion'
    }),
    userInput: z.string().min(1).openapi({
      description: "The user's input or context for the structured generation task.",
      example: 'A react component for displaying user profiles'
    }),
    options: AiSdkOptionsSchema.optional().openapi({
      description: 'Optional: Override default model options (temperature, etc.) defined in the task configuration.'
    })
  })
  .openapi('AiGenerateStructuredRequest')

export const AiGenerateStructuredResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      output: z.any().openapi({
        description: "The generated structured data, validated against the schema defined by the 'schemaKey'."
      })
      // Consider adding metadata: model used, tokens, latency, etc.
    })
  })
  .openapi('AiGenerateStructuredResponse')

// Define the Zod schema for filename suggestions
export const FilenameSuggestionSchema = z
  .object({
    suggestions: z
      .array(z.number())
      .length(5)
      .openapi({
        description: 'An array of exactly 5 suggested file ids (unix timestamp in milliseconds)',
        example: [1, 2, 3, 4, 5]
      }),
    reasoning: z.string().optional().openapi({
      description: 'Brief reasoning for the suggestions.',
      example: 'Suggestions focus on clarity and common naming conventions for utility files.'
    })
  })
  .openapi('FilenameSuggestionOutput')


// Export internal schemas needed by routes
export const FileSuggestionsZodSchema = z.object({
  fileIds: z.array(z.number())
})

// Define other schemas as needed...
// const CodeReviewSchema = z.object({ ... });

// Central object mapping keys to structured task configurations
// Place this here or in a separate config file (e.g., gen-ai-config.ts) and import it
export const structuredDataSchemas = {
  filenameSuggestion: {
    // These fields match BaseStructuredDataConfigSchema
    name: 'Filename Suggestion',
    description: "Suggests 5 suitable filenames based on a description of the file's content.",
    // promptTemplate can be included to help with the prompt, but it's not required
    promptTemplate:
      'Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {userInput}',
    systemPrompt:
      'You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.',
    // modelSettings: {
    //     model: LOW_MODEL_CONFIG.model,
    //     temperature: LOW_MODEL_CONFIG.temperature,
    // },
    // This field is part of the interface, but not the base Zod schema
    schema: FilenameSuggestionSchema // The actual Zod schema instance
  },
  // Example of another entry
  basicSummary: {
    name: 'Basic Summary',
    description: 'Generates a short summary of the input text.',
    promptTemplate: 'Summarize the following text concisely: {userInput}',
    systemPrompt: 'You are a summarization expert.',
    // modelSettings: { model: LOW_MODEL_CONFIG.model, temperature: LOW_MODEL_CONFIG.temperature, maxTokens: LOW_MODEL_CONFIG.max_tokens },
    schema: z
      .object({
        // Define the schema directly here
        summary: z.string().openapi({ description: 'The generated summary.' })
      })
      .openapi('BasicSummaryOutput')
  }
  // Add more structured tasks here...
} satisfies Record<string, StructuredDataSchemaConfig<any>>

// --- Type Exports ---
export type AiSdkOptions = z.infer<typeof AiSdkOptionsSchema>
export type AiGenerateTextRequest = z.infer<typeof AiGenerateTextRequestSchema>
export type AiGenerateStructuredRequest = z.infer<typeof AiGenerateStructuredRequestSchema>
export type UnifiedModel = z.infer<typeof UnifiedModelSchema>
export type AiMessage = z.infer<typeof AiMessageSchema>
