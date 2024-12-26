import { useLocalStorage } from "@/hooks/use-local-storage"
import { APIProviders } from "shared"


type ProviderModels = {
    openai: string    
    openrouter: string | null
    lmstudio: string | null
    ollama: string | null
    xai: string | null
    gemini: string | null
}

const DEFAULT_PROVIDER_MODELS: ProviderModels = {
    openai: 'gpt-4o',
    openrouter: null,
    lmstudio: null,
    ollama: 'llama3',
    xai: 'grok-beta',
    gemini: 'gemini-1.5-pro',
}

export const useChatModelControl = () => {
    const [provider, setProvider] = useLocalStorage<APIProviders>(
        'provider',
        'openai'
    )

    const [providerModels, setProviderModels] = useLocalStorage<ProviderModels>(
        'provider-models',
        DEFAULT_PROVIDER_MODELS
    )

    const currentModel = providerModels[provider]

    function setCurrentModel(modelId: string) {
        setProviderModels(prev => ({
            ...prev,
            [provider]: modelId,
        }))
    }

    return {
        provider,
        setProvider,
        providerModels,
        setProviderModels,
        currentModel,
        setCurrentModel,
    }
}