import OpenAI from "openai/index.mjs";
import { ReadableStream } from "stream/web";
import { ProviderKeyService } from "./provider-key-service";
import { streamOllama } from "./streamers/ollama";
import { streamOpenRouter } from "./streamers/open-router";
import { streamXai } from "./streamers/xai";
import { streamGeminiMessage } from "./streamers/gemini";
import { streamOpenAiLike } from "./streamers/open-ai-like";
import { APIProviders, UnifiedModel } from "shared";
import { streamAnthropic } from "./streamers/anthropic";
import { StreamParams } from "./provider-types";
import { streamGroqMessage } from "./streamers/groq";
import { streamTogetherMessage } from "./streamers/together-ai";

type XAIModel = {
    id: string
    // created at unix timestamp
    created: number
    object: string,
    owned_by: string
}

// ollama and lmstudio should be adjustable eventually
export const OLLAMA_BASE_URL = "http://localhost:11434";
export const LMSTUDIO_BASE_URL = "http://localhost:1234/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const XAI_BASE_URL = "https://api.x.ai/v1";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const TOGETHER_BASE_URL = "https://api.together.xyz/v1";

/** For your SSE event chunk shape */
type OpenRouterStreamResponse = {
    choices: {
        delta?: { content?: string };
        content?: string;
    }[];
};

/** Example shape of OpenRouter model data */
type OpenRouterModelContext = {
    description: string;
    tokens: number;
    mode?: string;
    formats?: string[];
};

type OpenRouterModelPricing = {
    prompt: string;
    completion: string;
    rateLimit?: number;
};

type OpenRouterModel = {
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

type OpenRouterModelsResponse = {
    data: OpenRouterModel[];
};

/** Gemini API model types */
type GeminiAPIModel = {
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

type ListModelsResponse = {
    models: GeminiAPIModel[];
};

type AnthropicModel = {
    type: string;
    id: string;
    display_name: string;
    created_at: string;
};

type AnthropicModelsResponse = {
    data: AnthropicModel[];
    has_more: boolean;
    first_id: string | null;
    last_id: string | null;
};

type OpenAIModelObject = {
    id: string;
    object: string;
    created: number;
    owned_by: string;
};

type OpenAIModelsListResponse = {
    object: string;
    data: OpenAIModelObject[];
};

type TogetherModelConfig = {
    chat_template: string;
    stop: string[];
    bos_token: string;
    eos_token: string;
};

type TogetherModelPricing = {
    hourly: number;
    input: number;
    output: number;
    base: number;
    finetune: number;
};

type TogetherModel = {
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

export class UnifiedProviderService {
    private openRouter: OpenAI | null = null;
    private openAI: OpenAI | null = null;
    private lmStudio: OpenAI;
    private ollama: OpenAI;
    private xai: OpenAI | null = null;

    private providerKeyService: ProviderKeyService;
    private geminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";

    constructor() {
        this.providerKeyService = new ProviderKeyService();

        // LM Studio doesn't require a real API key
        this.lmStudio = new OpenAI({
            baseURL: LMSTUDIO_BASE_URL,
            apiKey: "lm-studio",
        });

        // Ollama doesn't require an API key
        this.ollama = new OpenAI({
            baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            apiKey: "ollama",
        });
    }

    /** ------------------ Basic initializers ------------------ */
    private async initializeOpenRouter(): Promise<OpenAI> {
        if (this.openRouter) return this.openRouter;
        const keys = await this.providerKeyService.listKeys();
        const openRouterKey = keys.find((k) => k.provider === "openrouter")?.key;
        if (!openRouterKey) throw new Error("OpenRouter API key not found");
        this.openRouter = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: openRouterKey,
            defaultHeaders: {
                "HTTP-Referer": "http://localhost:3579",
                "X-Title": "OctoPrompt",
            },
        });
        return this.openRouter;
    }

    private async initializeOpenAI(): Promise<OpenAI> {
        if (this.openAI) return this.openAI;
        const keys = await this.providerKeyService.listKeys();
        const openAIKey = keys.find((k) => k.provider === "openai")?.key;
        if (!openAIKey) throw new Error("OpenAI API key not found");
        this.openAI = new OpenAI({ apiKey: openAIKey });
        return this.openAI;
    }

    private async initializeXAI(): Promise<OpenAI> {
        if (this.xai) return this.xai;
        const keys = await this.providerKeyService.listKeys();
        const xaiKey = keys.find((k) => k.provider === "xai")?.key;
        if (!xaiKey) throw new Error("XAI API key not found");
        this.xai = new OpenAI({
            baseURL: "https://api.x.ai/v1",
            apiKey: xaiKey,
        });
        return this.xai;
    }

    private async getGroqApiKey(): Promise<string> {
        const keys = await this.providerKeyService.listKeys();
        const groqKey = keys.find((k) => k.provider === "groq")?.key;
        if (!groqKey) throw new Error("Groq API key not found");
        return groqKey;
    }

    private async getTogetherApiKey(): Promise<string> {
        const keys = await this.providerKeyService.listKeys();
        const tKey = keys.find((k) => k.provider === "together")?.key;
        if (!tKey) throw new Error("Together API key not found");
        return tKey;
    }

    /** ------------------ Gemini-specific methods ------------------ */

    /** Retrieve Gemini API key */
    private async getGeminiApiKey(): Promise<string> {
        const keys = await this.providerKeyService.listKeys();
        const googleKey = keys.find((k) => k.provider === "google_gemini")?.key;
        if (!googleKey) {
            throw new Error("Google Gemini API key not found in provider keys");
        }
        return googleKey;
    }

    /** List all Gemini models */
    async listGeminiModels(): Promise<GeminiAPIModel[]> {
        const apiKey = await this.getGeminiApiKey();
        const response = await fetch(`${this.geminiBaseUrl}/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch Gemini models: ${response.statusText}`);
        }
        const data: ListModelsResponse = await response.json();
        return data.models;
    }


    /** Upload a file to Gemini for multimodal input */
    async uploadFileForGemini(file: File, mime_type: string): Promise<string> {
        const apiKey = await this.getGeminiApiKey();
        const baseUrl = this.geminiBaseUrl.replace("/v1beta", "");
        const startRes = await fetch(`${baseUrl}/upload/v1beta/files?key=${apiKey}`, {
            method: "POST",
            headers: {
                "X-Goog-Upload-Protocol": "resumable",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Header-Content-Length": file.size.toString(),
                "X-Goog-Upload-Header-Content-Type": mime_type,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ file: { display_name: "UPLOAD_FILE" } }),
        });

        if (!startRes.ok) {
            throw new Error("Failed to start Gemini file upload");
        }

        const upload_url = startRes.headers.get("X-Goog-Upload-URL");
        if (!upload_url) {
            throw new Error("No upload URL returned");
        }

        const finalize = await fetch(upload_url, {
            method: "POST",
            headers: {
                "X-Goog-Upload-Command": "upload, finalize",
                "X-Goog-Upload-Offset": "0",
                "Content-Length": file.size.toString(),
            },
            body: new Uint8Array(await file.arrayBuffer()),
        });

        if (!finalize.ok) {
            throw new Error("Failed to finalize Gemini file upload");
        }

        const info = await finalize.json();
        return info.file.uri;
    }

    /** ------------------ Streaming Methods ------------------ */

    async streamMessage(
        streamConfig: StreamParams & {
            provider: APIProviders,
            systemMessage?: string;
        }
    ): Promise<ReadableStream<Uint8Array>> {
        // Initialize the required client based on provider
        switch (streamConfig.provider) {
            case "ollama":
                return streamOllama({ ...streamConfig, ollamaBaseUrl: OLLAMA_BASE_URL });

            case "openrouter":
                await this.initializeOpenRouter();
                return streamOpenRouter({ ...streamConfig, openRouterApiKey: this.openRouter?.apiKey ?? '' });

            case "xai":
                await this.initializeXAI();

                if (!this.xai) throw new Error("XAI client not initialized");

                // @ts-ignore
                return streamXai({ ...streamConfig, xaiClient: this.xai });

            case "google_gemini": {
                const apiKey = await this.getGeminiApiKey();
                const modelId = streamConfig.options?.model || "models/gemini-1.5-pro";
                return streamGeminiMessage({
                    ...streamConfig,
                    geminiApiKey: apiKey,
                    geminiBaseUrl: this.geminiBaseUrl,
                    modelId,
                });
            }

            case "lmstudio":
                return streamOpenAiLike({
                    ...streamConfig,
                    provider: "lmstudio",
                    client: this.lmStudio,
                });
            case "anthropic": {
                // 1. Retrieve Anthropic API key from your db or environment
                const keys = await this.providerKeyService.listKeys();
                const anthropicKey = keys.find((k) => k.provider === "anthropic")?.key;
                if (!anthropicKey) {
                    throw new Error("Anthropic API key not found");
                }

                // 2. Optionally check if you want any specific version or beta
                const anthropicVersion = "2023-10-01"; // or "2023-06-01"
                const anthropicBeta = "claude-3.5,another-beta"; // optionally set

                // 3. Return your stream from the new function
                return streamAnthropic({
                    ...streamConfig,
                    anthropicApiKey: anthropicKey,
                    anthropicVersion,
                    anthropicBeta, // optional
                });
            }

            case "groq": {
                const apiKey = await this.getGroqApiKey();
                return streamGroqMessage({
                    ...streamConfig,
                    groqApiKey: apiKey,
                    groqBaseUrl: GROQ_BASE_URL,
                    debug: streamConfig.options.debug ?? false,
                });
            }

            case "together": {
                const apiKey = await this.getTogetherApiKey();
                return streamTogetherMessage({
                    ...streamConfig,
                    togetherApiKey: apiKey,
                    togetherBaseUrl: TOGETHER_BASE_URL,
                    debug: streamConfig.options.debug ?? false,
                });
            }


            case "openai":
            default:
                const client = await this.initializeOpenAI();
                return streamOpenAiLike({
                    ...streamConfig,
                    provider: "openai",
                    client,
                });
        }
    }

    /** ------------------ Other Providers ------------------ */

    /** Example: fetch available models from OpenRouter */
    async getOpenRouterModels(): Promise<OpenRouterModelsResponse> {
        const openRouter = await this.initializeOpenRouter();
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${openRouter.apiKey}`,
                "HTTP-Referer": "http://localhost:3579",
                "X-Title": "OctoPrompt",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${errorText}`);
        }
        return response.json();
    }

    /** Example: fetch available models from XAI */
    async getXAIModels() {
        const keys = await this.providerKeyService.listKeys();
        const xaiKey = keys.find((k) => k.provider === "xai")?.key;

        const response = await fetch("https://api.x.ai/v1/models", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${xaiKey}`,
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`XAI API error: ${errorText}`);
        }
        return response.json();
    }

    /** Example: transcribe a file via OpenAI/Whisper */
    async transcribeAudioFile(file: File, prompt?: string): Promise<string> {
        const openai = await this.initializeOpenAI();
        const transcriptionFile = new File([await file.arrayBuffer()], "audio.webm", {
            type: "audio/webm",
        });
        return openai.audio.transcriptions.create({
            file: transcriptionFile,
            model: "whisper-1",
            prompt: prompt ?? undefined,
            response_format: "text",
        });
    }

    /** Example: translate an audio file via OpenAI/Whisper */
    async translateAudioFile(file: File, prompt?: string): Promise<string> {
        const openai = await this.initializeOpenAI();
        const translationFile = new File([await file.arrayBuffer()], "audio.webm", {
            type: "audio/webm",
        });
        return openai.audio.translations.create({
            file: translationFile,
            model: "whisper-1",
            prompt: prompt ?? undefined,
            response_format: "text",
        });
    }

    /**
 * Fetch Groq models from https://api.groq.com/openai/v1/models
 */
    private async listGroqModels(): Promise<UnifiedModel[]> {
        // 1. Get your Groq API key
        const groqApiKey = await this.getGroqApiKey();

        // 2. Call GET /models
        const response = await fetch(`${GROQ_BASE_URL}/models`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${groqApiKey}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq models API error: ${response.status} - ${errorText}`);
        }

        /**
         * Typical Groq response shape:
         * {
         *   "object": "list",
         *   "data": [
         *     {
         *       "id": "llama3-groq-70b-8192-tool-use-preview",
         *       "object": "model",
         *       "created": 1693721698,
         *       "owned_by": "Groq",
         *       "active": true,
         *       "context_window": 8192,
         *       ...
         *     },
         *     ...
         *   ]
         * }
         */
        const data = await response.json() as {
            object: string;
            data: Array<{
                id: string;
                object: string;
                created: number;
                owned_by: string;
                active: boolean;
                context_window: number;
            }>;
        };

        // 3. Map to your “UnifiedModel” structure
        return data.data.map((m) => ({
            id: m.id,
            name: m.id,
            description: `Groq model owned by ${m.owned_by}`,
        }));
    }

    /**
     * Fetch Together models from https://api.together.xyz/v1/models
     */
    private async listTogetherModels(): Promise<UnifiedModel[]> {
        // 1. Get your Together API key
        const togetherApiKey = await this.getTogetherApiKey();

        // 2. Call GET /models
        const response = await fetch(`${TOGETHER_BASE_URL}/models`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${togetherApiKey}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Together models API error: ${response.status} - ${errorText}`);
        }

        /**
         * Typical Together response shape:
         * {
         *   "data": [
         *     {
         *       "id": "Qwen/Qwen2.5-72B-Instruct-Turbo",
         *       ...
         *     },
         *     ...
         *   ]
         * }
         */
        const data = await response.json() as TogetherModel[];
        

        // 3. Map to your “UnifiedModel” structure
        return data.map((m) => ({
            id: m.id,
            name: m.display_name || m.id,
            description: `${m.organization} model - ${m.display_name || m.id} | Context: ${m.context_length} tokens | License: ${m.license}`,
        }));
    }

    /**
 * A unified method to list models for a given provider
 */
    async listModels(provider: APIProviders): Promise<UnifiedModel[]> {
        switch (provider) {
            case "openrouter": {
                // existing getOpenRouterModels() => { data: OpenRouterModel[] }
                const raw = await this.getOpenRouterModels();
                return raw.data.map((m) => ({
                    id: m.id,
                    name: m.name,
                    description: m.description,
                }));
            }

            case "lmstudio": {
                // Example: { data: LMStudioModel[] }
                const res = await fetch(`${LMSTUDIO_BASE_URL}/models`);
                if (!res.ok) throw new Error(`LM Studio error: ${res.statusText}`);
                const json = await res.json();
                // Adjust as needed based on LM Studio’s actual response shape
                return json.data.map((m: any) => ({
                    id: m.id,
                    name: m.id,
                    description: `LM Studio model: ${m.id}`, // or any relevant field
                }));
            }

            case "ollama": {
                // Suppose the existing /api/tags returns ["llama2", "llama2-7b", ...]
                // or an array of objects. Adjust accordingly.
                const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
                if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
                const data = await res.json();
                return data.map((modelName: string) => ({
                    id: modelName,
                    name: modelName,
                    description: `Ollama model: ${modelName}`,
                }));
            }

            case "xai": {
                // existing getXAIModels() => { data: XAIModel[] }
                const raw = await this.getXAIModels();
                return raw.data.map((m: XAIModel) => ({
                    id: m.id,
                    name: m.id,
                    description: `XAI model: ${m.id}`, // adjust as needed
                }));
            }

            case "google_gemini": {
                // existing listGeminiModels() => GeminiAPIModel[]
                const raw = await this.listGeminiModels();
                return raw.map((m) => ({
                    id: m.name,
                    name: m.displayName,
                    description: m.description,
                }));
            }

            case "anthropic": {
                const models = await this.listAnthropicModels();
                return models.map(m => ({
                    id: m.id,
                    name: m.display_name,
                    description: `Anthropic model: ${m.id}`,
                }));
            }

            case "groq": {
                const models = await this.listGroqModels();
                return models.map(m => ({
                    id: m.id,
                    name: m.name,
                    description: `Groq model: ${m.id}`,
                }));
            }

            case "together": {
                const models = await this.listTogetherModels();
                return models.map(m => ({
                    id: m.id,
                    name: m.id,
                    description: `Together model: ${m.id}`,
                }));
            }


            case "openai":
            default: {
                try {
                    const models = await this.listOpenAiModels();
                    return models.map(m => ({
                        id: m.id,
                        name: m.id,
                        description: `OpenAI model owned by ${m.owned_by}`,
                    }));
                } catch (error) {
                    console.warn("Failed to fetch OpenAI models", error);
                    return [];
                }
            }


        }
    }

    private async listAnthropicModels(): Promise<AnthropicModel[]> {
        const keys = await this.providerKeyService.listKeys();
        const anthropicKey = keys.find((k) => k.provider === "anthropic")?.key;
        if (!anthropicKey) {
            throw new Error("Anthropic API key not found");
        }

        const response = await fetch("https://api.anthropic.com/v1/models", {
            method: "GET",
            headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic Models API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as AnthropicModelsResponse;
        return data.data;
    }

    private async listOpenAiModels(): Promise<OpenAIModelObject[]> {
        const openai = await this.initializeOpenAI();

        const response = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${openai.apiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI list models error: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as OpenAIModelsListResponse;
        return data.data;
    }

    async retrieveOpenAiModel(modelId: string): Promise<OpenAIModelObject> {
        const openai = await this.initializeOpenAI();

        const response = await fetch(`https://api.openai.com/v1/models/${modelId}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${openai.apiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI retrieve model error: ${response.status} - ${errorText}`);
        }

        return response.json() as Promise<OpenAIModelObject>;
    }

    async deleteOpenAiModel(modelId: string): Promise<{ id: string; object: string; deleted: boolean }> {
        const openai = await this.initializeOpenAI();

        const response = await fetch(`https://api.openai.com/v1/models/${modelId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${openai.apiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI delete model error: ${response.status} - ${errorText}`);
        }

        return response.json();
    }
}