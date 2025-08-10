// Minimal shims to satisfy typecheck in services without pulling storage types
declare module '@promptliano/storage' {
  export const claudeCommandStorage: any
  export type CleanupOptions = { dryRun?: boolean; verbose?: boolean; continueOnError?: boolean }
  export function createCleanupScheduler(...args: any[]): { start(): void; stop(): void }
}
