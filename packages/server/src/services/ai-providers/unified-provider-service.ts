import OpenAI from "openai/index.mjs";
import { ReadableStream } from "stream/web";
import type { APIProviders, StreamParams } from "./unified-chat-provider-service";
import { ProviderKeyService } from "./provider-key-service";
import { streamOllama } from "./streamers/ollama";
import { streamOpenRouter } from "./streamers/open-router";
import { streamXai } from "./streamers/xai";
import { streamGeminiMessage } from "./streamers/gemini";
import { streamOpenAiLike } from "./streamers/open-ai-like";
import { UnifiedModel } from "shared";

type XAIModel = {
    id: string
    // created at unix timestamp
    created: number
    object: string,
    owned_by: string
}

export type OpenAIModel = {
    id: string
    name: string
    description: string
    contextWindow: number
    category: 'GPT-4o' | 'GPT-4o mini' | 'o1' | 'GPT-4' | 'GPT-3.5' | 'Base'
}

export const openAIModels: OpenAIModel[] = [
    // GPT-4o Models
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Our high-intelligence flagship model for complex, multi-step tasks',
        contextWindow: 128000,
        category: 'GPT-4o'
    },
    {
        id: 'gpt-4o-2024-11-20',
        name: 'GPT-4o (Nov 20, 2024)',
        description: 'Latest gpt-4o snapshot from November 20th, 2024',
        contextWindow: 128000,
        category: 'GPT-4o'
    },
    {
        id: 'chatgpt-4o-latest',
        name: 'ChatGPT-4o Latest',
        description: 'The version of GPT-4o used in ChatGPT, updated frequently',
        contextWindow: 128000,
        category: 'GPT-4o'
    },
    // GPT-4o mini Models
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Our affordable and intelligent small model for fast, lightweight tasks',
        contextWindow: 128000,
        category: 'GPT-4o mini'
    },
    // o1 Models
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        description: 'Reasoning model designed to solve hard problems across domains',
        contextWindow: 128000,
        category: 'o1'
    },
    {
        id: 'o1-mini',
        name: 'o1 Mini',
        description: 'Faster and cheaper reasoning model for coding, math, and science',
        contextWindow: 128000,
        category: 'o1'
    },
    // GPT-4 Models
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Latest GPT-4 Turbo model with vision capabilities',
        contextWindow: 128000,
        category: 'GPT-4'
    },
    {
        id: 'gpt-4-0125-preview',
        name: 'GPT-4 Turbo Preview',
        description: 'Preview model intended to reduce cases of laziness',
        contextWindow: 128000,
        category: 'GPT-4'
    },
    // GPT-3.5 Models
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective model for simpler tasks',
        contextWindow: 16385,
        category: 'GPT-3.5'
    },
    {
        id: 'gpt-3.5-turbo-0125',
        name: 'GPT-3.5 Turbo (Jan 25)',
        description: 'Latest GPT-3.5 Turbo model with improved formatting',
        contextWindow: 16385,
        category: 'GPT-3.5'
    },
    // Base Models
    {
        id: 'babbage-002',
        name: 'Babbage-002',
        description: 'Replacement for GPT-3 ada and babbage base models',
        contextWindow: 16384,
        category: 'Base'
    },
    {
        id: 'davinci-002',
        name: 'Davinci-002',
        description: 'Replacement for GPT-3 curie and davinci base models',
        contextWindow: 16384,
        category: 'Base'
    }
]


// ollama and lmstudio should be adjustable eventually
export const OLLAMA_BASE_URL = "http://localhost:11434";
export const LMSTUDIO_BASE_URL = "http://localhost:1234/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const XAI_BASE_URL = "https://api.x.ai/v1";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

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
            provider: APIProviders
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

            case "gemini": {
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

            case "gemini": {
                // existing listGeminiModels() => GeminiAPIModel[]
                const raw = await this.listGeminiModels();
                return raw.map((m) => ({
                    id: m.name,
                    name: m.displayName,
                    description: m.description,
                }));
            }

            case "openai":
            default: {

                return openAIModels;
            }
        }
    }
}