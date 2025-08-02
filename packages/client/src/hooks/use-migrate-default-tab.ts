import { useEffect } from 'react'
import { useGetProjectTabs, useSetKvValue } from './use-kv-local-storage'

/**
 * Hook to migrate old "defaultTab" entry to numeric ID system
 * This runs once on app load to clean up legacy tab data
 */
export function useMigrateDefaultTab() {
  const [projectTabs] = useGetProjectTabs()
  const { mutate: setProjectTabs } = useSetKvValue('projectTabs')

  useEffect(() => {
    if (!projectTabs) return

    // Check if there's a defaultTab entry (legacy string key)
    if ('defaultTab' in projectTabs) {
      console.log('Migrating legacy defaultTab to numeric ID system')

      // Create a copy without the defaultTab
      const { defaultTab, ...validTabs } = projectTabs

      // If there are no other tabs, we'll let the user create their first tab
      // Otherwise, just remove the defaultTab
      setProjectTabs(validTabs)

      // Store that we've done the migration
      localStorage.setItem('defaultTabMigrated', 'true')
    }
  }, [projectTabs, setProjectTabs])
}
