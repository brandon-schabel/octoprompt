import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { AiSdkOptions } from '@octoprompt/schemas'
import { useCallback, useMemo } from 'react'
import { APIProviders, modelsTempNotAllowed } from '@octoprompt/schemas'

type ModelParamMutationFn = (value: number) => void

export function useChatModelParams() {
  const [settings, updateSettings] = useAppSettings()

  const { temperature, maxTokens, topP, frequencyPenalty, presencePenalty, model, provider } = settings

  const isTempDisabled = useMemo(() => {
    if (!model) return false
    return modelsTempNotAllowed.some((m) => model.includes(m))
  }, [model])

  const setTemperature: ModelParamMutationFn = useCallback(
    (value) => {
      if (isTempDisabled) return
      updateSettings({ temperature: value })
    },
    [isTempDisabled, updateSettings]
  )

  const setMaxTokens: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ maxTokens: value })
    },
    [updateSettings]
  )

  const setTopP: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ topP: value })
    },
    [updateSettings]
  )

  const setFreqPenalty: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ frequencyPenalty: value })
    },
    [updateSettings]
  )

  const setPresPenalty: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ presencePenalty: value })
    },
    [updateSettings]
  )

  const setModel = useCallback(
    (value: string) => {
      updateSettings({ model: value })
    },
    [updateSettings]
  )

  const setProvider = useCallback(
    (value: APIProviders) => {
      updateSettings({ provider: value })
    },
    [updateSettings]
  )

  const modelSettings: AiSdkOptions = useMemo(
    () => ({
      temperature,
      topP,
      frequencyPenalty,
      presencePenalty,
      maxTokens,
      model,
      provider
    }),
    [temperature, topP, frequencyPenalty, presencePenalty, maxTokens, model, provider]
  )

  return {
    settings: modelSettings as AiSdkOptions & {
      provider: string
    },
    setTemperature,
    setMaxTokens,
    setTopP,
    setFreqPenalty,
    setPresPenalty,
    isTempDisabled,
    setModel,
    setProvider
  }
}
