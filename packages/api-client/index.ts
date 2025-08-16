// Export the new modular API client structure
export * from './src/index'

// Note: The old monolithic client is still available as api-client.ts
// but we don't re-export it here to avoid naming conflicts.
// Users can import directly from './api-client' if needed during transition.
