import type { ModelOptions } from "../schemas/chat.schemas"
import type { APIProviders } from "../schemas/provider-key.schemas"

export type ModelOptionsWithProvider = ModelOptions & {
    provider: APIProviders
}

export const LOW_MODEL_CONFIG: ModelOptionsWithProvider = {
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 10000,
    temperature: 0.7,
    top_p: 1,
    provider: "openrouter",
    model: "google/gemini-2.5-flash-preview",
    top_k: 1,

}

export const MEDIUM_MODEL_CONFIG: ModelOptionsWithProvider = {
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 100000,
    temperature: 0.7,
    top_p: 1,
    provider: "openrouter",
    model: "google/gemini-2.5-flash-preview",
    top_k: 1,
}

export const HIGH_MODEL_CONFIG: ModelOptionsWithProvider = {
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 100000,
    temperature: 0.7,
    top_p: 1,
    provider: "openrouter",
    model: "google/gemini-2.5-flash-preview",
    top_k: 1,
}

