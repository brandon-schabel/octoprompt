import { useState } from 'react'
import { Settings2Icon } from 'lucide-react'
import { APIProviders, AiSdkOptions } from '@promptliano/schemas'
import { Button, Popover, PopoverContent, PopoverTrigger, Label, Slider } from '@ui'
import { ProviderModelSelector } from './provider-model-selector'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

export interface ModelSettingsPopoverProps {
  provider: APIProviders
  model: string
  settings: Partial<AiSdkOptions>
  onProviderChange: (provider: APIProviders) => void
  onModelChange: (model: string) => void
  onSettingsChange: (settings: Partial<AiSdkOptions>) => void
  disabled?: boolean
  isTempDisabled?: boolean
  showAdvancedSettings?: boolean
  className?: string
}

export function ModelSettingsPopover({
  provider,
  model,
  settings,
  onProviderChange,
  onModelChange,
  onSettingsChange,
  disabled = false,
  isTempDisabled = false,
  showAdvancedSettings = true,
  className
}: ModelSettingsPopoverProps) {
  const [open, setOpen] = useState(false)

  const temperature = settings.temperature ?? 0.7
  const maxTokens = settings.maxTokens ?? 100000
  const topP = settings.topP ?? 0.9
  const frequencyPenalty = settings.frequencyPenalty ?? 0
  const presencePenalty = settings.presencePenalty ?? 0

  const handleSettingChange = (key: keyof AiSdkOptions, value: number) => {
    onSettingsChange({
      ...settings,
      [key]: value
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='outline' size='icon' className={className || 'h-8 w-8'} disabled={disabled}>
          <Settings2Icon className='h-4 w-4' />
          <span className='sr-only'>Model Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-80'>
        <div className='space-y-4'>
          <h4 className='font-medium leading-none mb-3'>Model Settings</h4>

          <ErrorBoundary>
            <ProviderModelSelector
              provider={provider}
              currentModel={model}
              onProviderChange={onProviderChange}
              onModelChange={onModelChange}
              layout='vertical'
              showLabels
            />
          </ErrorBoundary>

          {showAdvancedSettings && (
            <>
              <hr />
              <div className='space-y-2'>
                <Label htmlFor='temperature'>Temperature: {temperature.toFixed(2)}</Label>
                <Slider
                  id='temperature'
                  disabled={isTempDisabled}
                  min={0}
                  max={1}
                  step={0.01}
                  value={[temperature]}
                  onValueChange={(temps) => handleSettingChange('temperature', temps[0])}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='maxTokens'>Max Tokens: {maxTokens}</Label>
                <Slider
                  id='maxTokens'
                  min={1000}
                  max={1000000}
                  step={1000}
                  value={[maxTokens]}
                  onValueChange={(tokens) => handleSettingChange('maxTokens', tokens[0])}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='topP'>Top P: {topP.toFixed(2)}</Label>
                <Slider
                  id='topP'
                  min={0}
                  max={1}
                  step={0.01}
                  value={[topP]}
                  onValueChange={(p) => handleSettingChange('topP', p[0])}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='frequencyPenalty'>Frequency Penalty: {frequencyPenalty.toFixed(2)}</Label>
                <Slider
                  id='frequencyPenalty'
                  min={-2}
                  max={2}
                  step={0.01}
                  value={[frequencyPenalty]}
                  onValueChange={(penalty) => handleSettingChange('frequencyPenalty', penalty[0])}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='presencePenalty'>Presence Penalty: {presencePenalty.toFixed(2)}</Label>
                <Slider
                  id='presencePenalty'
                  min={-2}
                  max={2}
                  step={0.01}
                  value={[presencePenalty]}
                  onValueChange={(penalty) => handleSettingChange('presencePenalty', penalty[0])}
                />
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
