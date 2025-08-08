export { ApiError } from './src/error/api-error'
export * from './src/error/domain-error'
export { matchesAnyPattern, filterByPatterns } from './src/utils/pattern-matcher'
export * from './src/utils/merge-deep'

// Constants
export * from './src/constants/file-limits'

// Structured outputs
export * from './src/structured-outputs/structured-output-schema'
export * from './src/structured-outputs/structured-output-utils'

// export utils
export * from './src/utils/projects-utils'
export * from './src/utils/file-tree-utils/file-node-tree-utils'
export * from './src/utils/file-tree-utils/import-resolver'
export * from './src/utils/project-summary-formatter'
export * from './src/utils/summary-formatters'
export * from './src/utils/zod-utils'
export * from './src/utils/merge-deep'
export * from './src/utils/pattern-matcher'
export * from './src/utils/parse-timestamp'
export * from './src/utils/prompts-map'

// service utilities
export * from './src/utils/service-utils'

// security utilities
export * from './src/utils/secure-path-validator'

// Claude hook templates
export * from './src/claude-hook-templates'
