import { ProjectsSearch } from './search-schemas'

// Old tab structure to new Manage sub-view mapping
const TAB_MIGRATION_MAP: Record<string, { activeView: string; manageView?: string }> = {
  // Old standalone tabs that are now under Manage
  stats: { activeView: 'manage', manageView: 'statistics' },
  statistics: { activeView: 'manage', manageView: 'statistics' },
  'mcp-analytics': { activeView: 'manage', manageView: 'mcp-analytics' },
  summarization: { activeView: 'manage', manageView: 'summarization' },
  settings: { activeView: 'manage', manageView: 'project-settings' },
  'project-settings': { activeView: 'manage', manageView: 'project-settings' }
}

/**
 * Migrates old URL parameters to new structure
 * @param search Current search parameters
 * @returns Migrated search parameters or null if no migration needed
 */
export function migrateUrlParams(search: ProjectsSearch): ProjectsSearch | null {
  if (!search.activeView) return null

  const migration = TAB_MIGRATION_MAP[search.activeView]
  if (!migration) return null

  // Create migrated params
  const migratedParams: ProjectsSearch = {
    ...search,
    activeView: migration.activeView as any
  }

  if (migration.manageView) {
    migratedParams.manageView = migration.manageView as any
  }

  return migratedParams
}

/**
 * Check if current URL needs migration
 */
export function needsUrlMigration(search: ProjectsSearch): boolean {
  return !!search.activeView && !!TAB_MIGRATION_MAP[search.activeView]
}

/**
 * Get user-friendly message about what changed
 */
export function getMigrationMessage(oldView: string): string {
  const migration = TAB_MIGRATION_MAP[oldView]
  if (!migration) return ''

  const viewNames: Record<string, string> = {
    stats: 'Statistics',
    statistics: 'Statistics',
    'mcp-analytics': 'MCP Analytics',
    summarization: 'Summarization',
    settings: 'Project Settings',
    'project-settings': 'Project Settings'
  }

  const oldName = viewNames[oldView] || oldView
  return `${oldName} has been moved under the Manage tab for better organization.`
}
