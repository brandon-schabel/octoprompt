import { ApiError } from '@octoprompt/shared'
import { type ActiveTab, type ActiveTabData, type UpdateActiveTabBody, activeTabSchema } from '@octoprompt/schemas'
import { activeTabStorage } from '@octoprompt/storage'
import { getProjectById } from './project-service'

/**
 * Get the active tab for a project
 */
export async function getActiveTab(projectId: number, clientId?: string): Promise<ActiveTab | null> {
  try {
    // Validate project exists
    await getProjectById(projectId)

    // Get all active tabs
    const allActiveTabs = await activeTabStorage.getAll()

    // Find active tab for this project (and optionally client)
    for (const activeTab of allActiveTabs.values()) {
      if (activeTab.data.projectId === projectId) {
        // If clientId specified, must match
        if (clientId && activeTab.data.clientId !== clientId) {
          continue
        }
        return activeTab
      }
    }

    return null
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get active tab: ${error instanceof Error ? error.message : String(error)}`,
      'GET_ACTIVE_TAB_FAILED'
    )
  }
}

/**
 * Set the active tab for a project
 */
export async function setActiveTab(
  projectId: number,
  tabId: number,
  clientId?: string,
  tabMetadata?: ActiveTabData['tabMetadata']
): Promise<ActiveTab> {
  try {
    // Validate project exists
    await getProjectById(projectId)

    // Check if we already have an active tab entry for this project
    const existingActiveTab = await getActiveTab(projectId, clientId)

    const now = Date.now()
    const activeTabData: ActiveTabData = {
      projectId,
      activeTabId: tabId,
      clientId,
      lastUpdated: now,
      tabMetadata
    }

    if (existingActiveTab) {
      // Update existing entry
      const updated: ActiveTab = {
        ...existingActiveTab,
        data: activeTabData,
        updated: now
      }

      await activeTabStorage.update(existingActiveTab.id, updated)
      return updated
    } else {
      // Create new entry
      const id = Date.now()
      const newActiveTab: ActiveTab = {
        id,
        data: activeTabData,
        created: now,
        updated: now
      }

      const validated = activeTabSchema.parse(newActiveTab)
      await activeTabStorage.create(validated)
      return validated
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to set active tab: ${error instanceof Error ? error.message : String(error)}`,
      'SET_ACTIVE_TAB_FAILED'
    )
  }
}

/**
 * Get active tab or create default (tab 0)
 */
export async function getOrCreateDefaultActiveTab(projectId: number, clientId?: string): Promise<number> {
  try {
    const activeTab = await getActiveTab(projectId, clientId)
    if (activeTab) {
      return activeTab.data.activeTabId
    }

    // No active tab, create default tab 0
    const created = await setActiveTab(projectId, 0, clientId)
    return created.data.activeTabId
  } catch (error) {
    // If all else fails, return 0
    console.warn(`Failed to get/create active tab for project ${projectId}, defaulting to 0:`, error)
    return 0
  }
}

/**
 * Clear active tab for a project
 */
export async function clearActiveTab(projectId: number, clientId?: string): Promise<boolean> {
  try {
    const activeTab = await getActiveTab(projectId, clientId)
    if (!activeTab) {
      return false
    }

    return await activeTabStorage.delete(activeTab.id)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to clear active tab: ${error instanceof Error ? error.message : String(error)}`,
      'CLEAR_ACTIVE_TAB_FAILED'
    )
  }
}

/**
 * Update active tab from request body
 */
export async function updateActiveTab(projectId: number, body: UpdateActiveTabBody): Promise<ActiveTab> {
  return setActiveTab(projectId, body.tabId, body.clientId, body.tabMetadata)
}
