export type APIProviders = 'openai' |
    'openrouter' |
    'lmstudio' |
    'ollama' |
    'xai' |
    'google_gemini' |
    'anthropic' |
    'groq' |
    'together'

export type UnifiedModel = {
    id: string;
    name: string;
    description: string;
    // context: number;
    // pricing: number;
    // top_provider?: string;
    // architecture?: string;
};

/** For your SSE event chunk shape */
export type OpenRouterStreamResponse = {
    choices: {
        delta?: { content?: string };
        content?: string;
    }[];
};

/** Example shape of OpenRouter model data */
export type OpenRouterModelContext = {
    description: string;
    tokens: number;
    mode?: string;
    formats?: string[];
};

export type OpenRouterModelPricing = {
    prompt: string;
    completion: string;
    rateLimit?: number;
};

export type OpenRouterModel = {
    id: string;
    name: string;
    description: string;
    context: OpenRouterModelContext;
    pricing: OpenRouterModelPricing;
    top_provider?: string;
    architecture?: string;
    per_request_limits?: {
        prompt_tokens?: number;
        completion_tokens?: number;
    };
};

export type OpenRouterModelsResponse = {
    data: OpenRouterModel[];
};

/** Gemini API model types */
export type GeminiAPIModel = {
    name: string;
    baseModelId: string;
    version: string;
    displayName: string;
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportedGenerationMethods: string[];
    temperature: number;
    maxTemperature: number;
    topP: number;
    topK: number;
};

export type ListModelsResponse = {
    models: GeminiAPIModel[];
};

export type AnthropicModel = {
    type: string;
    id: string;
    display_name: string;
    created_at: string;
};

export type AnthropicModelsResponse = {
    data: AnthropicModel[];
    has_more: boolean;
    first_id: string | null;
    last_id: string | null;
};

export type OpenAIModelObject = {
    id: string;
    object: string;
    created: number;
    owned_by: string;
};

export type OpenAIModelsListResponse = {
    object: string;
    data: OpenAIModelObject[];
};

export type TogetherModelConfig = {
    chat_template: string;
    stop: string[];
    bos_token: string;
    eos_token: string;
};

export type TogetherModelPricing = {
    hourly: number;
    input: number;
    output: number;
    base: number;
    finetune: number;
};

export type TogetherModel = {
    id: string;
    object: string;
    created: number;
    type: string;
    running: boolean;
    display_name: string;
    organization: string;
    link: string;
    license: string;
    context_length: number;
    config: TogetherModelConfig;
    pricing: TogetherModelPricing;
};

export type XAIModel = {
    id: string
    // created at unix timestamp
    created: number
    object: string,
    owned_by: string
}

export type OllamaModel = {
    name: string,
    model: string,
    modified_at: string,
    size: number,
    digest: string,
    details: {
        parent_model: string,
        format: string,
        family: string,
        families: string[],
        parameter_size: string,
        quantization_level: string,
    }
}