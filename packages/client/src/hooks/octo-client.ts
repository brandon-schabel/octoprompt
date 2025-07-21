import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { createOctoPromptClient } from '@octoprompt/api-client'
import { customFetch } from '@/lib/tauri-fetch-fixed'

export const octoClient = createOctoPromptClient({
  baseUrl: SERVER_HTTP_ENDPOINT,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  customFetch
})
