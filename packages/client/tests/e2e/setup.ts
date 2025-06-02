import { test as setup } from '@playwright/test'
import { server } from './mocks/server'

// This will be imported by test files that need MSW
export async function setupMSW() {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'warn',
  })
}

export async function teardownMSW() {
  // Stop MSW server
  server.close()
}

export async function resetMSW() {
  // Reset handlers
  server.resetHandlers()
}