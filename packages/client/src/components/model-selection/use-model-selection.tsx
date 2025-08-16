import { useCallback, useState, useEffect } from 'react'
import { APIProviders } from '@promptliano/schemas'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { useGetModels } from '@/hooks/api/use-gen-ai-api'
import { useAppSettings } from '@/hooks/use-kv-local-storage'

export interface UseModelSelectionOptions {
  defaultProvider?: APIProviders
  defaultModel?: string
  persistenceKey?: string
  onProviderChange?: (provider: APIProviders) => void
  onModelChange?: (model: string) => void
}

export interface UseModelSelectionReturn {
  provider: APIProviders
  model: string
  setProvider: (provider: APIProviders) => void
  setModel: (model: string) => void
  isLoadingModels: boolean
  availableModels: Array<{ id: string; name: string }>
}

/**
 * Hook for managing provider and model selection with optional persistence
 */
export function useModelSelection(options: UseModelSelectionOptions = {}): UseModelSelectionReturn {
  const { defaultProvider = 'openrouter', defaultModel = '', persistenceKey, onProviderChange, onModelChange } = options

  // Use local storage if persistence key is provided, otherwise use state
  const [provider, setProviderInternal] = persistenceKey
    ? useLocalStorage<APIProviders>(`${persistenceKey}_provider`, defaultProvider)
    : useState<APIProviders>(defaultProvider)

  const [model, setModelInternal] = persistenceKey
    ? useLocalStorage<string>(`${persistenceKey}_model`, defaultModel)
    : useState<string>(defaultModel)

  // Get app settings for provider URLs
  const [appSettings] = useAppSettings()

  // Prepare URL options based on provider
  const urlOptions = {
    ...(provider === 'ollama' && appSettings.ollamaGlobalUrl ? { ollamaUrl: appSettings.ollamaGlobalUrl } : {}),
    ...(provider === 'lmstudio' && appSettings.lmStudioGlobalUrl ? { lmstudioUrl: appSettings.lmStudioGlobalUrl } : {})
  }

  // Fetch available models for the current provider
  const { data: modelsData, isLoading: isLoadingModels } = useGetModels(provider, urlOptions)

  const availableModels =
    modelsData?.data.map((m: any) => ({
      id: m.id,
      name: m.name
    })) ?? []

  // Auto-select first model when provider changes
  useEffect(() => {
    if (availableModels.length > 0) {
      const isCurrentModelValid = availableModels.some((m: any) => m.id === model)
      if (!model || !isCurrentModelValid) {
        const firstModelId = availableModels[0].id
        setModelInternal(firstModelId)
        onModelChange?.(firstModelId)
      }
    }
  }, [availableModels, model, setModelInternal, onModelChange])

  const setProvider = useCallback(
    (newProvider: APIProviders) => {
      setProviderInternal(newProvider)
      onProviderChange?.(newProvider)
      // Clear model when provider changes to trigger auto-selection
      setModelInternal('')
    },
    [setProviderInternal, setModelInternal, onProviderChange]
  )

  const setModel = useCallback(
    (newModel: string) => {
      setModelInternal(newModel)
      onModelChange?.(newModel)
    },
    [setModelInternal, onModelChange]
  )

  return {
    provider,
    model,
    setProvider,
    setModel,
    isLoadingModels,
    availableModels
  }
}
