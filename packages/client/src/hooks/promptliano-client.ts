import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { createPromptlianoClient } from '@promptliano/api-client'
import { customFetch } from '@/lib/tauri-fetch-fixed'

export const promptlianoClient = createPromptlianoClient({
  baseUrl: SERVER_HTTP_ENDPOINT,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  customFetch
})
