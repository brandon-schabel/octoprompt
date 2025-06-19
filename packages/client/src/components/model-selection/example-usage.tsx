/**
 * Example usage of the model selection components
 * This file demonstrates different ways to use the reusable model selection components
 */

import { ProviderModelSelector, useModelSelection, ModelSettingsPopover } from '@/components/model-selection'
import { APIProviders, AiSdkOptions } from '@octoprompt/schemas'
import { Card, CardContent, CardHeader, CardTitle } from '@ui'
import { useState } from 'react'

// Example 1: Basic usage with useModelSelection hook
export function BasicModelSelectionExample() {
  const { provider, model, setProvider, setModel, isLoadingModels, availableModels } = useModelSelection({
    defaultProvider: 'openai',
    defaultModel: 'gpt-4',
    persistenceKey: 'example-model-selection' // Optional: persists selection to localStorage
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Model Selection</CardTitle>
      </CardHeader>
      <CardContent>
        <ProviderModelSelector
          provider={provider}
          currentModel={model}
          onProviderChange={setProvider}
          onModelChange={setModel}
        />
        <div className='mt-4 text-sm text-muted-foreground'>
          <p>Selected Provider: {provider}</p>
          <p>Selected Model: {model}</p>
          <p>Loading: {isLoadingModels ? 'Yes' : 'No'}</p>
          <p>Available Models: {availableModels.length}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Example 2: Vertical layout with labels
export function VerticalModelSelectionExample() {
  const { provider, model, setProvider, setModel } = useModelSelection()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vertical Layout with Labels</CardTitle>
      </CardHeader>
      <CardContent>
        <ProviderModelSelector
          provider={provider}
          currentModel={model}
          onProviderChange={setProvider}
          onModelChange={setModel}
          layout='vertical'
          showLabels
        />
      </CardContent>
    </Card>
  )
}

// Example 3: Filtered providers and models
export function FilteredModelSelectionExample() {
  const { provider, model, setProvider, setModel } = useModelSelection()

  // Only show specific providers
  const allowedProviders: APIProviders[] = ['openai', 'anthropic', 'google_gemini']

  // Filter models to only show specific ones
  const filterModels = (model: { id: string; name: string }) => {
    // Example: Only show GPT-4 variants and Claude models
    return model.id.includes('gpt-4') || model.id.includes('claude')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtered Selection</CardTitle>
      </CardHeader>
      <CardContent>
        <ProviderModelSelector
          provider={provider}
          currentModel={model}
          onProviderChange={setProvider}
          onModelChange={setModel}
          filterProviders={allowedProviders}
          filterModels={filterModels}
        />
      </CardContent>
    </Card>
  )
}

// Example 4: Model Settings Popover
export function ModelSettingsExample() {
  const { provider, model, setProvider, setModel } = useModelSelection({
    defaultProvider: 'openrouter'
  })

  const [settings, setSettings] = useState<Partial<AiSdkOptions>>({
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  })

  const handleSettingsChange = (newSettings: Partial<AiSdkOptions>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Settings Popover</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex items-center justify-between'>
          <div className='text-sm'>
            <p>Provider: {provider}</p>
            <p>Model: {model}</p>
            <p>Temperature: {settings.temperature}</p>
          </div>
          <ModelSettingsPopover
            provider={provider}
            model={model}
            settings={settings}
            onProviderChange={setProvider}
            onModelChange={setModel}
            onSettingsChange={handleSettingsChange}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// Example 5: Compact layout
export function CompactModelSelectionExample() {
  const { provider, model, setProvider, setModel } = useModelSelection()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compact Layout</CardTitle>
      </CardHeader>
      <CardContent>
        <ProviderModelSelector
          provider={provider}
          currentModel={model}
          onProviderChange={setProvider}
          onModelChange={setModel}
          layout='compact'
        />
      </CardContent>
    </Card>
  )
}

// Example 6: With callbacks
export function CallbackModelSelectionExample() {
  const [log, setLog] = useState<string[]>([])

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  const { provider, model, setProvider, setModel } = useModelSelection({
    onProviderChange: (provider) => addLog(`Provider changed to: ${provider}`),
    onModelChange: (model) => addLog(`Model changed to: ${model}`)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>With Change Callbacks</CardTitle>
      </CardHeader>
      <CardContent>
        <ProviderModelSelector
          provider={provider}
          currentModel={model}
          onProviderChange={setProvider}
          onModelChange={setModel}
        />
        <div className='mt-4 p-2 bg-muted rounded text-xs font-mono max-h-32 overflow-y-auto'>
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
