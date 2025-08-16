/**
 * Git Routes Index
 * Consolidates all git-related routes from split files
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { gitStatusRoutes } from './git-status-routes'
import { gitCommitRoutes } from './git-commit-routes'
import { gitBranchRoutes } from './git-branch-routes'
import { gitStashRoutes } from './git-stash-routes'
import { gitWorktreeRoutes } from './git-worktree-routes'

// Create consolidated git routes
export const gitRoutes = new OpenAPIHono()

// Mount all route groups
gitRoutes.route('/', gitStatusRoutes)
gitRoutes.route('/', gitCommitRoutes)
gitRoutes.route('/', gitBranchRoutes)
gitRoutes.route('/', gitStashRoutes)
gitRoutes.route('/', gitWorktreeRoutes)

// Export individual route groups for testing
export { gitStatusRoutes } from './git-status-routes'
export { gitCommitRoutes } from './git-commit-routes'
export { gitBranchRoutes } from './git-branch-routes'
export { gitStashRoutes } from './git-stash-routes'
export { gitWorktreeRoutes } from './git-worktree-routes'

// Export types
export type { GitStatusRouteTypes } from './git-status-routes'
export type { GitCommitRouteTypes } from './git-commit-routes'
export type { GitBranchRouteTypes } from './git-branch-routes'
export type { GitStashRouteTypes } from './git-stash-routes'
export type { GitWorktreeRouteTypes } from './git-worktree-routes'

export type GitRouteTypes = typeof gitRoutes