export const DEFAULT_MODEL_CONFIGS = {
    // global default:
    "default": {
        model: "qwen/qwen-plus",
        temperature: 0.7,
        provider: "openrouter",
        max_tokens: 100000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: true,
    },
    // suggest-files-routes.ts
    'suggest-code-files': {
        model: "qwen/qwen-plus",
        temperature: 0.7,
        provider: "openrouter",
    },
    // ticket-routes.ts
    'suggest-code-files-ticket': {
        model: "qwen/qwen-plus",
        temperature: 0.7,
        provider: "openrouter",
    },
    // ai-file-change-service.ts
    'generate-file-change': {
        model: "mistralai/codestral-2501",
        temperature: 0.7,
        provider: "openrouter",
    },
    // structured-output-service.ts
    "generate-structured-output": {
        model: "qwen/qwen-plus",
        temperature: 0.7,
        provider: "openrouter",
    },
    // promptimizer-service.ts
    "optimize-prompt": {
        model: "qwen/qwen-plus",
        temperature: 0.7,
        provider: "openrouter",
    },
    // structured-output-fetcher.ts
    "fetch-structured-output": {
        model: "qwen/qwen-plus",
        temperature: 0.7,
        provider: "openrouter",
    },
    // ticket-service.ts
    "suggest-ticket-tasks": {
        model: "qwen/qwen-plus",
        temperature: 0.7,
        provider: "openrouter",
    },
    // file-summary-service.ts
    "summarize-file": {
        model: "mistralai/codestral-2501",
        temperature: 0.7,
        provider: "openrouter",
        max_tokens: 1024,
    },




    // **************
    // PROVIDER DEFAULTS
    // **************
    "openai": {
        model: "gpt-4o",
        // temperature: 0.7,
        provider: "openai",
    },
    "openrouter": {
        model: "mistralai/codestral-2501",
        // temperature: 0.7,
        provider: "openrouter",
    },
    "lmstudio": {
        model: "llama3",
        // temperature: 0.7,
        provider: "lmstudio",
    },
    "ollama": {
        model: "llama3",
        // temperature: 0.7,
        provider: "ollama",
    },
    "xai": {
        model: "grok-beta",
        // temperature: 0.7,
        provider: "xai",
    },
    "google_gemini": {
        model: "gemini-1.5-pro",
        // temperature: 0.7,
        provider: "google_gemini",
    },
    "anthropic": {
        model: "claude-3-5-sonnet",
        // temperature: 0.7,
        provider: "anthropic",
    },
    "groq": {
        model: "llama3",
        // temperature: 0.7,
        provider: "groq",
    },
    "together": {
        model: "llama3",
        // temperature: 0.7,
        provider: "together",
    },
    "gemini": {
        model: "gemini-1.5-flash",
        // temperature: 0.7,
        provider: "google_gemini",
    },
}


