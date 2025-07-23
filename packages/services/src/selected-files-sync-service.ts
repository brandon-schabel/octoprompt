import { ApiError } from '@octoprompt/shared'
import { type SelectedFiles, type SelectedFilesData, selectedFilesSchema } from '@octoprompt/schemas'
import { selectedFilesStorage } from '@octoprompt/storage'

/**
 * Get selected files for a project (and optionally a specific tab)
 */
export async function getSelectedFiles(projectId: number, tabId?: number): Promise<SelectedFiles | null> {
  try {
    // Ensure IDs are numbers for comparison
    const numericProjectId = Number(projectId)
    const numericTabId = tabId !== undefined ? Number(tabId) : undefined

    // Get all selected files and find the matching one
    const allSelectedFiles = await selectedFilesStorage.getAll()

    for (const selectedFile of allSelectedFiles) {
      // Compare with type conversion to handle string/number mismatches
      if (Number(selectedFile.data.projectId) === numericProjectId) {
        // If no tabId specified, return the first match for the project
        if (numericTabId === undefined) {
          return selectedFile
        }
        // If tabId specified, check for exact match
        if (Number(selectedFile.data.tabId) === numericTabId) {
          return selectedFile
        }
      }
    }

    return null
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get selected files: ${error instanceof Error ? error.message : String(error)}`,
      'GET_SELECTED_FILES_FAILED'
    )
  }
}

/**
 * Get all selected files for a project (across all tabs)
 */
export async function getAllSelectedFilesForProject(projectId: number): Promise<SelectedFiles[]> {
  try {
    const allSelectedFiles = await selectedFilesStorage.getAll()
    const projectSelectedFiles: SelectedFiles[] = []

    for (const selectedFile of allSelectedFiles) {
      if (Number(selectedFile.data.projectId) === Number(projectId)) {
        projectSelectedFiles.push(selectedFile)
      }
    }

    return projectSelectedFiles
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get all selected files for project: ${error instanceof Error ? error.message : String(error)}`,
      'GET_ALL_SELECTED_FILES_FAILED'
    )
  }
}

/**
 * Update selected files for a project tab
 */
export async function updateSelectedFiles(
  projectId: number,
  tabId: number,
  fileIds: number[],
  promptIds: number[] = [],
  userPrompt: string = ''
): Promise<SelectedFiles> {
  try {
    // Ensure all IDs are numbers
    const numericProjectId = Number(projectId)
    const numericTabId = Number(tabId)
    const numericFileIds = fileIds.map((id) => Number(id))
    const numericPromptIds = promptIds.map((id) => Number(id))

    const existing = await getSelectedFiles(numericProjectId, numericTabId)
    const now = Date.now()

    const selectedFilesData: SelectedFilesData = {
      projectId: numericProjectId,
      tabId: numericTabId,
      fileIds: numericFileIds,
      promptIds: numericPromptIds,
      userPrompt,
      updatedAt: now
    }

    if (existing) {
      // Update existing record
      const updates = {
        data: selectedFilesData,
        updated: now
      }
      const updated = await selectedFilesStorage.update(existing.id, updates)
      if (!updated) {
        throw new ApiError(404, 'Selected files not found', 'SELECTED_FILES_NOT_FOUND')
      }
      return updated
    } else {
      // Create new record - pass only the data without id/created/updated
      const newSelectedFiles = await selectedFilesStorage.create({
        data: selectedFilesData
      })
      return newSelectedFiles
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to update selected files: ${error instanceof Error ? error.message : String(error)}`,
      'UPDATE_SELECTED_FILES_FAILED'
    )
  }
}

/**
 * Clear selected files for a project (and optionally a specific tab)
 */
export async function clearSelectedFiles(projectId: number, tabId?: number): Promise<void> {
  try {
    const numericProjectId = Number(projectId)
    const numericTabId = tabId !== undefined ? Number(tabId) : undefined

    const allSelectedFiles = await selectedFilesStorage.getAll()
    const idsToDelete: (string | number)[] = []

    for (const selectedFile of allSelectedFiles) {
      if (Number(selectedFile.data.projectId) === numericProjectId) {
        if (numericTabId === undefined || Number(selectedFile.data.tabId) === numericTabId) {
          idsToDelete.push(selectedFile.id)
        }
      }
    }

    // Delete all matching records
    for (const id of idsToDelete) {
      await selectedFilesStorage.delete(id)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to clear selected files: ${error instanceof Error ? error.message : String(error)}`,
      'CLEAR_SELECTED_FILES_FAILED'
    )
  }
}

/**
 * Get the current selection context for MCP tools
 */
export async function getSelectionContext(
  projectId: number,
  tabId?: number
): Promise<{
  fileIds: number[]
  promptIds: number[]
  userPrompt: string
  lastUpdated: number
} | null> {
  try {
    const selectedFiles = await getSelectedFiles(projectId, tabId)
    if (!selectedFiles) {
      return null
    }

    return {
      fileIds: selectedFiles.data.fileIds,
      promptIds: selectedFiles.data.promptIds,
      userPrompt: selectedFiles.data.userPrompt,
      lastUpdated: selectedFiles.data.updatedAt
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get selection context: ${error instanceof Error ? error.message : String(error)}`,
      'GET_SELECTION_CONTEXT_FAILED'
    )
  }
}

/**
 * Removes deleted file IDs from all selected files entries for a project.
 * This should be called after files are deleted from a project to maintain referential integrity.
 */
export async function removeDeletedFileIdsFromSelectedFiles(
  projectId: number,
  deletedFileIds: number[]
): Promise<{ updatedEntries: number }> {
  try {
    const allSelectedFiles = await getAllSelectedFilesForProject(projectId)
    let updatedCount = 0

    for (const selectedFile of allSelectedFiles) {
      if (selectedFile.data.fileIds && selectedFile.data.fileIds.length > 0) {
        const originalLength = selectedFile.data.fileIds.length
        const updatedFileIds = selectedFile.data.fileIds.filter(
          (fileId) => !deletedFileIds.includes(fileId)
        )

        if (updatedFileIds.length < originalLength) {
          await updateSelectedFiles(
            selectedFile.data.projectId,
            selectedFile.data.tabId || 0,
            updatedFileIds,
            selectedFile.data.promptIds || [],
            selectedFile.data.userPrompt || ''
          )
          updatedCount++
        }
      }
    }

    return { updatedEntries: updatedCount }
  } catch (error) {
    console.error(
      `Failed to remove deleted file IDs from selected files in project ${projectId}:`,
      error
    )
    // Don't throw - this is a cleanup operation that shouldn't fail the main operation
    return { updatedEntries: 0 }
  }
}
