/**
 * Git Service - Backwards Compatibility Layer
 * 
 * This file maintains backwards compatibility by re-exporting all functions
 * from the modularized git services. The actual implementation has been
 * split into specialized services for better organization and maintainability.
 * 
 * @deprecated Use the specialized services directly from './git-services' for new code
 */

// Re-export everything from the modularized services
export * from './git-services'

// This file now serves as a compatibility layer that delegates to the new modular structure
// All the original functionality is preserved but organized into focused service modules:
//
// - git-status-service.ts: Status, staging, diff operations (~300 lines)
// - git-commit-service.ts: Commits, logs, history (~500 lines)
// - git-branch-service.ts: Branch management (~300 lines)
// - git-stash-service.ts: Stash operations (~150 lines)
// - git-remote-service.ts: Remote, push, pull, tags (~250 lines)
// - git-worktree-service.ts: Worktree management (~250 lines)
// - git-config-service.ts: Git configuration (~150 lines)
// - base-git-service.ts: Shared base functionality (~75 lines)