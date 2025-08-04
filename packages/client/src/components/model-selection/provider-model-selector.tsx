import { useCallback, useEffect, useMemo } from 'react'
import { APIProviders } from '@promptliano/schemas'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { PromptlianoCombobox } from '@/components/promptliano/promptliano-combobox'
import { useGetModels } from '@/hooks/api/use-gen-ai-api'
import { PROVIDER_SELECT_OPTIONS } from '@/constants/providers-constants'

export interface ProviderModelSelectorProps {
  provider: APIProviders
  currentModel: string
  onProviderChange: (provider: APIProviders) => void
  onModelChange: (modelId: string) => void
  className?: string
  layout?: 'horizontal' | 'vertical' | 'compact'
  disabled?: boolean
  showLabels?: boolean
  providerClassName?: string
  modelClassName?: string
  filterProviders?: APIProviders[]
  filterModels?: (model: { id: string; name: string }) => boolean
}

export function ProviderModelSelector({
  provider,
  currentModel,
  onProviderChange,
  onModelChange,
  className,
  layout = 'horizontal',
  disabled = false,
  showLabels = false,
  providerClassName,
  modelClassName,
  filterProviders,
  filterModels
}: ProviderModelSelectorProps) {
  const { data: modelsData, isLoading: isLoadingModels } = useGetModels(provider)

  // Filter providers if specified
  const availableProviders = useMemo(() => {
    if (!filterProviders || filterProviders.length === 0) {
      return PROVIDER_SELECT_OPTIONS
    }
    return PROVIDER_SELECT_OPTIONS.filter((option) => filterProviders.includes(option.value as APIProviders))
  }, [filterProviders])

  // Prepare model options with optional filtering
  const comboboxOptions = useMemo(() => {
    let filteredModels = modelsData?.data ?? []

    if (filterModels) {
      filteredModels = filteredModels.filter(filterModels)
    }

    return filteredModels.map((m) => ({
      value: m.id,
      label: m.name
    }))
  }, [modelsData, filterModels])

  // Auto-select first model when provider changes or current model is invalid
  useEffect(() => {
    const isCurrentModelValid = comboboxOptions.some((model) => model.value === currentModel)
    if ((!currentModel || !isCurrentModelValid) && comboboxOptions.length > 0) {
      onModelChange(comboboxOptions[0].value)
    }
  }, [comboboxOptions, currentModel, onModelChange])

  const handleModelChange = useCallback(
    (value: string | null) => {
      if (value !== null) {
        onModelChange(value)
      }
    },
    [onModelChange]
  )

  const containerClassName = cn(
    'flex gap-4',
    layout === 'vertical' && 'flex-col',
    layout === 'compact' && 'gap-2',
    className
  )

  const providerSelectClassName = cn('w-full', layout === 'compact' && 'min-w-[120px]', providerClassName)

  const modelComboboxClassName = cn('w-full min-w-[150px]', layout === 'compact' && 'min-w-[120px]', modelClassName)

  return (
    <div className={containerClassName}>
      {showLabels && layout === 'vertical' && <label className='text-sm font-medium'>Provider</label>}
      <Select value={provider} onValueChange={(val) => onProviderChange(val as APIProviders)} disabled={disabled}>
        <SelectTrigger className={providerSelectClassName}>
          <SelectValue placeholder='Select provider' />
        </SelectTrigger>
        <SelectContent>
          {availableProviders.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showLabels && layout === 'vertical' && <label className='text-sm font-medium'>Model</label>}
      <PromptlianoCombobox
        options={comboboxOptions}
        value={currentModel}
        onValueChange={handleModelChange}
        placeholder={isLoadingModels ? 'Loading...' : comboboxOptions.length === 0 ? 'No models' : 'Select model'}
        searchPlaceholder='Search models...'
        className={modelComboboxClassName}
        popoverClassName='w-[300px]'
        disabled={disabled || isLoadingModels || comboboxOptions.length === 0}
      />
    </div>
  )
}
