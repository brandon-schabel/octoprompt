import { useEffect } from 'react'
import { useAppSettings } from './use-kv-local-storage'
import { promptlianoClient } from './promptliano-client'

/**
 * Hook to synchronize local provider settings (custom URLs) with the server
 * This ensures that when using services like summarization, they use the custom URLs
 * configured in the UI rather than the default localhost URLs
 */
export function useSyncProviderSettings() {
  const [appSettings] = useAppSettings()

  useEffect(() => {
    // Only sync if there are custom URLs configured
    const hasCustomUrls = appSettings.ollamaGlobalUrl || appSettings.lmStudioGlobalUrl

    if (hasCustomUrls) {
      // Sync the provider settings with the server
      promptlianoClient.keys
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
        .catch((error) => {
          console.error('[ProviderSettings] Failed to sync provider settings:', error)
        })
    }
  }, [appSettings.ollamaGlobalUrl, appSettings.lmStudioGlobalUrl])
}
