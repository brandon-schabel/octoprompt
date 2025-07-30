import { useEffect } from 'react'
import { useGetProjectTabs, useSetKvValue } from './use-kv-local-storage'
import { ProjectTabState } from '@promptliano/schemas'

/**
 * Hook to migrate old activeView values in project tabs to new structure
 * This handles the reorganization where stats, mcp-analytics, summarization, 
 * and settings are now sub-views under the Manage tab
 */
export function useMigrateTabViews() {
  const [projectTabs] = useGetProjectTabs()
  const { mutate: setProjectTabs } = useSetKvValue('projectTabs')

  useEffect(() => {
    if (!projectTabs) return

    // Check if migration has already been done
    const migrationKey = 'tabViewsMigrated_v1'
    if (localStorage.getItem(migrationKey) === 'true') {
      return
    }

    // Map of old activeView values to new structure
    const viewMigrationMap: Record<string, { activeView: string; manageView?: string }> = {
      'stats': { activeView: 'manage', manageView: 'statistics' },
      'statistics': { activeView: 'manage', manageView: 'statistics' },
      'mcp-analytics': { activeView: 'manage', manageView: 'mcp-analytics' },
      'summarization': { activeView: 'manage', manageView: 'summarization' },
      'settings': { activeView: 'manage', manageView: 'project-settings' },
      'project-settings': { activeView: 'manage', manageView: 'project-settings' },
    }

    let needsMigration = false
    const migratedTabs = { ...projectTabs }

    // Check each tab for old activeView values
    Object.entries(projectTabs).forEach(([tabId, tab]) => {
      if (typeof tab === 'object' && tab !== null && 'activeView' in tab) {
        const oldView = (tab as any).activeView
        const migration = viewMigrationMap[oldView]
        
        if (migration) {
          needsMigration = true
          console.log(`Migrating tab ${tabId} from activeView "${oldView}" to Manage sub-view`)
          
          // Remove old activeView and add new properties
          const { activeView, ...restTab } = tab as any
          migratedTabs[tabId] = {
            ...restTab,
            // Store the migration info in a special field
            viewMigration: {
              from: oldView,
              to: migration.activeView,
              subView: migration.manageView,
              migratedAt: new Date().toISOString()
            }
          } as ProjectTabState
        }
      }
    })

    if (needsMigration) {
      console.log('Migrating project tabs to new view structure')
      setProjectTabs(migratedTabs)
      
      // Mark migration as complete
      localStorage.setItem(migrationKey, 'true')
      
      // Store migration details for debugging
      localStorage.setItem('tabViewsMigrationDetails', JSON.stringify({
        migratedAt: new Date().toISOString(),
        tabsCount: Object.keys(migratedTabs).length
      }))
    }
  }, [projectTabs, setProjectTabs])
}