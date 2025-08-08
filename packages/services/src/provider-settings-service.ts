/**
 * Provider Settings Service
 *
 * This service manages custom settings for AI providers, particularly custom URLs
 * for local providers like LMStudio and Ollama. These settings are stored in memory
 * and can be updated at runtime.
 */

import type { APIProviders } from '@promptliano/schemas'

interface ProviderSettings {
  ollamaUrl?: string
  lmstudioUrl?: string
  lastUpdated?: number
}

// In-memory storage for provider settings
// In a production environment, this could be stored in the database
let providerSettings: ProviderSettings = {}

/**
 * Get all provider settings
 */
export function getProviderSettings(): ProviderSettings {
  return { ...providerSettings }
}

/**
 * Update provider settings
 */
export function updateProviderSettings(settings: Partial<ProviderSettings>): ProviderSettings {
  providerSettings = {
    ...providerSettings,
    ...settings,
    lastUpdated: Date.now()
  }

  // Log when custom URLs are detected
  if (settings.ollamaUrl) {
    console.log(`[ProviderSettings] Custom Ollama URL configured: ${settings.ollamaUrl}`)
  }
  if (settings.lmstudioUrl) {
    console.log(`[ProviderSettings] Custom LMStudio URL configured: ${settings.lmstudioUrl}`)
  }

  return providerSettings
}

/**
 * Get URL for a specific provider
 */
export function getProviderUrl(provider: APIProviders): string | undefined {
  switch (provider) {
    case 'ollama':
      return providerSettings.ollamaUrl
    case 'lmstudio':
      return providerSettings.lmstudioUrl
    default:
      return undefined
  }
}

/**
 * Clear all provider settings
 */
export function clearProviderSettings(): void {
  providerSettings = {}
  console.log('[ProviderSettings] Provider settings cleared')
}

/**
 * Create provider settings service
 */
export function createProviderSettingsService() {
  return {
    getSettings: getProviderSettings,
    updateSettings: updateProviderSettings,
    getProviderUrl,
    clearSettings: clearProviderSettings
  }
}
