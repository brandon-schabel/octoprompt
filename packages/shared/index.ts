export { ApiError } from './src/error/api-error'
export { matchesAnyPattern, filterByPatterns } from './src/utils/pattern-matcher'
export * from './src/utils/merge-deep'

// Global state management
export * from './src/schemas/global-state-schema'

// Structured outputs
export * from './src/structured-outputs/structured-output-schema'
export * from './src/structured-outputs/structured-output-utils'

// Constants
export * from './src/constants/model-default-configs'
export * from './src/constants/models-temp-not-allowed'

// Legacy export - consider migrating or deprecating
