# Model Selection Components

This module provides reusable components and hooks for implementing AI provider and model selection in your application.

## Components

### ProviderModelSelector

A compound component that displays both provider and model selection UI.

```tsx
import { ProviderModelSelector } from '@/components/model-selection'

;<ProviderModelSelector
  provider='openai'
  currentModel='gpt-4'
  onProviderChange={(provider) => console.log(provider)}
  onModelChange={(model) => console.log(model)}
  layout='horizontal' // or "vertical" or "compact"
  showLabels={true}
  disabled={false}
/>
```

#### Props

- `provider` (APIProviders): Current selected provider
- `currentModel` (string): Current selected model ID
- `onProviderChange` (function): Callback when provider changes
- `onModelChange` (function): Callback when model changes
- `layout` (optional): "horizontal" | "vertical" | "compact" (default: "horizontal")
- `showLabels` (optional): Show labels for inputs in vertical layout
- `disabled` (optional): Disable all inputs
- `filterProviders` (optional): Array of provider IDs to show
- `filterModels` (optional): Function to filter available models
- `className` (optional): Additional CSS classes
- `providerClassName` (optional): CSS classes for provider select
- `modelClassName` (optional): CSS classes for model combobox

### ModelSettingsPopover

A popover component that includes model selection and advanced settings like temperature, max tokens, etc.

```tsx
import { ModelSettingsPopover } from '@/components/model-selection'

;<ModelSettingsPopover
  provider='openai'
  model='gpt-4'
  settings={{
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  }}
  onProviderChange={(provider) => console.log(provider)}
  onModelChange={(model) => console.log(model)}
  onSettingsChange={(settings) => console.log(settings)}
  showAdvancedSettings={true}
/>
```

#### Props

- `provider` (APIProviders): Current provider
- `model` (string): Current model
- `settings` (Partial<AiSdkOptions>): Current AI settings
- `onProviderChange` (function): Provider change callback
- `onModelChange` (function): Model change callback
- `onSettingsChange` (function): Settings change callback
- `disabled` (optional): Disable the popover trigger
- `isTempDisabled` (optional): Disable temperature slider
- `showAdvancedSettings` (optional): Show/hide advanced settings (default: true)
- `className` (optional): CSS classes for the trigger button

## Hooks

### useModelSelection

A hook that manages provider and model selection state with optional persistence.

```tsx
import { useModelSelection } from '@/components/model-selection'

const { provider, model, setProvider, setModel, isLoadingModels, availableModels } = useModelSelection({
  defaultProvider: 'openai',
  defaultModel: 'gpt-4',
  persistenceKey: 'my-model-selection', // Optional: enables localStorage
  onProviderChange: (provider) => console.log('Provider changed:', provider),
  onModelChange: (model) => console.log('Model changed:', model)
})
```

#### Options

- `defaultProvider` (optional): Initial provider (default: "openrouter")
- `defaultModel` (optional): Initial model
- `persistenceKey` (optional): Key for localStorage persistence
- `onProviderChange` (optional): Callback when provider changes
- `onModelChange` (optional): Callback when model changes

#### Returns

- `provider`: Current provider
- `model`: Current model
- `setProvider`: Function to update provider
- `setModel`: Function to update model
- `isLoadingModels`: Loading state for models
- `availableModels`: Array of available models for current provider

## Usage Examples

### Basic Usage

```tsx
function MyComponent() {
  const { provider, model, setProvider, setModel } = useModelSelection()

  return (
    <ProviderModelSelector
      provider={provider}
      currentModel={model}
      onProviderChange={setProvider}
      onModelChange={setModel}
    />
  )
}
```

### With Persistence

```tsx
function MyComponent() {
  const { provider, model, setProvider, setModel } = useModelSelection({
    persistenceKey: 'chat-model-selection'
  })

  // Selection will persist across page reloads
  return (
    <ProviderModelSelector
      provider={provider}
      currentModel={model}
      onProviderChange={setProvider}
      onModelChange={setModel}
    />
  )
}
```

### Filtered Selection

```tsx
function MyComponent() {
  const { provider, model, setProvider, setModel } = useModelSelection()

  // Only show specific providers
  const allowedProviders = ['openai', 'anthropic']

  // Only show GPT-4 models
  const filterModels = (model) => model.id.includes('gpt-4')

  return (
    <ProviderModelSelector
      provider={provider}
      currentModel={model}
      onProviderChange={setProvider}
      onModelChange={setModel}
      filterProviders={allowedProviders}
      filterModels={filterModels}
    />
  )
}
```

### In a Settings Dialog

```tsx
function SettingsDialog() {
  const { provider, model, setProvider, setModel } = useModelSelection({
    persistenceKey: 'app-settings-model'
  })

  const [settings, setSettings] = useState({
    temperature: 0.7,
    maxTokens: 4096
  })

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <ProviderModelSelector
            provider={provider}
            currentModel={model}
            onProviderChange={setProvider}
            onModelChange={setModel}
            layout='vertical'
            showLabels
          />

          {/* Other settings UI */}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## Migration from chat.tsx

If you're migrating from the original implementation in chat.tsx:

1. Replace `ProviderModelSector` imports with `ProviderModelSelector` from this module
2. Use `useModelSelection` hook instead of managing state manually
3. Update prop names if needed (they're mostly the same)

```tsx
// Before
;<ProviderModelSector
  provider={provider}
  currentModel={model}
  onProviderChange={handleProviderChange}
  onModelChange={handleModelChange}
/>

// After
import { ProviderModelSelector } from '@/components/model-selection'

;<ProviderModelSelector
  provider={provider}
  currentModel={model}
  onProviderChange={handleProviderChange}
  onModelChange={handleModelChange}
/>
```
