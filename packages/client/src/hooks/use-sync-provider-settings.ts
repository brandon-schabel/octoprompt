import { useEffect } from 'react'
import { useAppSettings } from './use-kv-local-storage'
import { usePromptlianoClient } from '@/context/promptliano-client-context'

/**
 * Hook to synchronize local provider settings (custom URLs) with the server
 * This ensures that when using services like summarization, they use the custom URLs
 * configured in the UI rather than the default localhost URLs
 */
export function useSyncProviderSettings() {
  const [appSettings] = useAppSettings()
  const { client } = usePromptlianoClient()

  useEffect(() => {
    // Only sync if there are custom URLs configured and client is connected
    const hasCustomUrls = appSettings.ollamaGlobalUrl || appSettings.lmStudioGlobalUrl

    if (hasCustomUrls && client && client.keys) {
      // Sync the provider settings with the server
      client.keys
        .updateProviderSettings({
          ollamaUrl: appSettings.ollamaGlobalUrl,
          lmstudioUrl: appSettings.lmStudioGlobalUrl
        })
        .then(() => {
          console.log('[ProviderSettings] Successfully synced custom provider URLs with server', {
            ollamaUrl: appSettings.ollamaGlobalUrl,
            lmstudioUrl: appSettings.lmStudioGlobalUrl
          })
        })
        .catch((error: any) => {
          // Only log error if it's not a connection issue (client might be disconnected)
          if (error?.message && !error.message.includes('not connected')) {
            console.error('[ProviderSettings] Failed to sync provider settings:', error)
          }
        })
    } else if (hasCustomUrls && client && !client.keys) {
      console.warn('[ProviderSettings] Keys service not available in modular API client. Provider settings sync disabled.')
    }
  }, [appSettings.ollamaGlobalUrl, appSettings.lmStudioGlobalUrl, client])
}
