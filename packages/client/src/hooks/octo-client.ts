import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { createOctoPromptClient } from '@octoprompt/api-client'

export const apiClient = createOctoPromptClient({
  baseUrl: SERVER_HTTP_ENDPOINT,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})
