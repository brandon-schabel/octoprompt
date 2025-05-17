import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KVKey, KvSchemas, KVValue } from 'shared/src/schemas/kv-store.schemas'
import { commonErrorHandler } from './common-mutation-error-handler'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import {
  AppSettings,
  ProjectTabsStateRecord,
  ProjectTabState,
  ProjectTabStatePartial,
  Theme,
  ApiError
} from 'shared/index'
import { useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'

type KVResult<T> = {
  success: boolean
  key: string
  value?: T
}

export function useGetKvValue<K extends KVKey>(key: K) {
  return useQuery({
    queryKey: ['kv', key],
    queryFn: async () => {
      const resp = await fetch(`${SERVER_HTTP_ENDPOINT}/api/kv?key=${key}`)
      const data: KVResult<unknown> = await resp.json()

      // data.value is unknown; parse with the correct Zod schema to ensure type safety
      const validated = KvSchemas[key].parse(data.value)
      return validated as KVValue<K>
    },
    enabled: !!key
  })
}

type MutationContext<K extends KVKey> = {
  previousValue?: KVValue<K>
}

// Set does a REPLACE, whereas update does a PATCH/merge of the exist value(if it's an object)
export function useSetKvValue<K extends KVKey>(key: K) {
  const invalidateKv = useInvalidateKv(key)
  const queryClient = useQueryClient()
  // Get the specific value type from KvSchemas
  type SpecificValueType = KVValue<K>

  return useMutation<
    { success: boolean },
    Error,
    SpecificValueType, // Use the specific value type for the input variable
    MutationContext<K>
  >({
    mutationFn: async (payload: SpecificValueType) => {
      // Explicitly type payload
      // No need for the typeof check anymore
      const value = payload

      // We'll automatically validate newValue in our route again
      const resp = await fetch(`${SERVER_HTTP_ENDPOINT}/api/kv/${key}`, {
        method: 'POST',
        // Ensure the body is correctly stringified
        body: JSON.stringify({ value }),
        headers: {
          'Content-Type': 'application/json' // Add content-type header
        }
      })
      // Handle potential non-JSON responses or errors
      if (!resp.ok) {
        const errorText = await resp.text()
        throw new Error(`Failed to set KV value for key "${key}": ${resp.status} ${errorText}`)
      }
      return resp.json()
    },
    // optimistic update
    onMutate: async (payload) => {
      // cancel outgoing refetch, so they don't override the optimistic upate
      await queryClient.cancelQueries({ queryKey: ['kv', key] })

      const previousValue = queryClient.getQueryData<KVValue<K>>(['kv', key])

      queryClient.setQueryData(['kv', key], (old: KVValue<K> | undefined) => {
        if (typeof old === 'string') return payload

        if (Array.isArray(old)) return [...old, payload]

        if (typeof old === 'object') {
          return {
            ...old,
            // @ts-ignore
            ...payload
          }
        }

        return previousValue
      })

      return { previousValue }
    },
    // If the mutation fails,
    // use the context returned from onMutate to roll back
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['kv', key], context?.previousValue)
    },

    // Always refetch after error or success:
    onSuccess: () => {
      invalidateKv()
    }
  })
}

export function useDeleteKvValue() {
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean; key: string }, Error, { key: KVKey }>({
    mutationFn: async ({ key }) => {
      // TODO: optimistic update the query cache
      const resp = await fetch(`${SERVER_HTTP_ENDPOINT}/api/kv/${key}`, {
        method: 'DELETE'
      })
      return resp.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kv', data.key] })
    },
    onError: commonErrorHandler
  })
}

export const updateProjectTabs = () => {
  const { mutate: setProjectTabs } = useUpdateKvValue('projectTabs')

  return (projectTabs: ProjectTabsStateRecord) => {
    setProjectTabs(projectTabs)
  }
}

export const useUpdateProjectTabById = () => {
  const { data: projectTabs } = useGetProjectTabs()
  const { mutate: setProjectTabs, ...rest } = useSetKvValue('projectTabs')

  if (!projectTabs) {
    throw new Error('Project tabs not found')
  }

  const updateProjectTabById = (tabId: string, partialData: Partial<ProjectTabState>) => {
    const tabData = projectTabs[tabId]
    setProjectTabs({
      ...projectTabs,
      [tabId]: {
        ...tabData,
        ...partialData
      }
    })
  }

  return {
    ...rest,
    projectTabs,
    updateProjectTabById
  }
}

export const useGetProjectTabs = () => {
  return useGetKvValue('projectTabs')
}

export const useGetProjectTab = (tabId: string) => {
  const { data: projectTabs, ...rest } = useGetProjectTabs()

  const projectTab = useMemo(() => {
    return projectTabs?.[tabId]
  }, [projectTabs, tabId])

  return { ...rest, projectTab }
}

export const useGetAppSettings = () => {
  return useGetKvValue('appSettings')
}

export const useAppSettingsKvApi = () => {
  const { data: appSettings } = useGetAppSettings()
  const { mutate: setAppSettings } = useUpdateKvValue('appSettings')

  return [appSettings, setAppSettings]
}

export const useInvalidateKv = (key: KVKey) => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['kv', key] })
}

export const useGetProjectTabById = (tabId: string) => {
  const { data: projectTabs, ...rest } = useGetProjectTabs()

  const projectTab = useMemo(() => {
    return projectTabs?.[tabId]
  }, [projectTabs, tabId])

  return { ...rest, projectTab }
}

export const useDeleteProjectTabById = () => {
  const { data: projectTabs, isLoading } = useGetProjectTabs()
  const { mutate: setProjectTabs, isPending: isDeleting } = useSetKvValue('projectTabs')

  const deleteTab = (tabIdToDelete: string) => {
    if (isLoading || !projectTabs) {
      console.error('Cannot delete tab: project tabs data not available.')
      // Optionally throw an error or return a status
      return
    }

    // Create a new object without the deleted tab
    const { [tabIdToDelete]: _, ...remainingTabs } = projectTabs

    // Update the KV store with the remaining tabs
    setProjectTabs(remainingTabs)
  }

  return { deleteTab, isDeleting } // Return the delete function and loading state
}

export const useSetActiveProjectTabId = () => {
  const { mutate: setActiveProjectTabId, ...rest } = useSetKvValue('activeProjectTabId')

  const setActiveProjectTab = (tabId: string) => {
    setActiveProjectTab(tabId)
  }

  return {
    ...rest,
    setActiveProjectTabId: setActiveProjectTabId
  }
}

export const useGetActiveProjectTabId = () => {
  const { data: activeProjectTabId, ...rest } = useGetKvValue('activeProjectTabId')

  return { ...rest, activeProjectTabId }
}

export const useCreateProjectTab = () => {
  const { mutate: updateProjectTabs, ...rest } = useSetKvValue('projectTabs')
  const { data: projectTabs } = useGetProjectTabs()
  const { activeProjectTabId = '' } = useGetActiveProjectTabId()
  const currentSelectedProjectId = useProjectTabById(activeProjectTabId ?? '')?.selectedProjectId

  const createProjectTab = (payload: ProjectTabStatePartial) => {
    const newTabId = uuidv4()
    // @ts-ignore
    const projectTab: ProjectTabState = {
      // id: newTabId,
      // ...currentProjectTabData,
      ...payload,
      selectedProjectId: currentSelectedProjectId ?? null,
      editProjectId: null,
      promptDialogOpen: false,
      editPromptId: null,
      fileSearch: '',
      selectedFiles: [],
      selectedPrompts: [],
      userPrompt: '',
      sortOrder: 0,
      displayName: `Tab ${Date.now()}`,
      searchByContent: false,
      ticketId: null,
      contextLimit: 64000
    }

    updateProjectTabs({
      ...projectTabs,
      [newTabId]: projectTab
    })

    return newTabId
  }
  return { ...rest, createProjectTab }
}

export const useProjectTabById = (tabId: string) => {
  const { data: projectTabs } = useGetProjectTabs()

  return useMemo(() => {
    return projectTabs?.[tabId]
  }, [projectTabs, tabId])
}

export function useProjectTabField<K extends keyof ProjectTabState>(
  fieldKey: K,
  projectTabId?: string // Optional specific tab ID
) {
  const { activeProjectTabId: activeTabId } = useGetActiveProjectTabId()
  const targetTabId = projectTabId ?? activeTabId

  const { data: projectTabs } = useGetProjectTabs()

  const tabData = targetTabId ? projectTabs?.[targetTabId] : undefined
  const data = tabData ? tabData[fieldKey] : undefined

  const isLoading = false || !tabData

  const { updateProjectTabById: updateTab } = useUpdateProjectTabById() // Assumes this uses useUpdateStatePartial internally

  const mutate = useCallback(
    (valueOrFn: ProjectTabState[K] | ((prevVal: ProjectTabState[K] | null | undefined) => ProjectTabState[K])) => {
      if (!targetTabId) {
        console.warn('Cannot mutate project tab field: No target tab ID.')
        return
      }
      if (!tabData) {
        // This case should ideally be handled by disabling the control calling mutate
        // but we add a check just in case.
        console.warn(`Cannot mutate project tab field: Target tab data (${targetTabId}) not found.`)
        return
      }

      const oldVal = tabData[fieldKey]
      const newVal =
        typeof valueOrFn === 'function'
          ? // @ts-ignore
            (valueOrFn as (prev: ProjectTabState[K] | null | undefined) => ProjectTabState[K])(oldVal)
          : valueOrFn

      // Call the refactored updateTab hook, which handles the API call
      // It expects the tabId and a *partial* update object for that specific tab
      updateTab(targetTabId, { [fieldKey]: newVal } as Partial<ProjectTabState>)

      // No direct KV update or WebSocket message needed here
    },
    [targetTabId, tabData, fieldKey, updateTab] // Include tabData in deps to get latest oldVal
  )

  return {
    data,
    isLoading,
    mutate
  }
}

export const useSelectSetting = <K extends keyof AppSettings>(key: K) => {
  const [settings] = useAppSettings()
  return settings?.[key] as AppSettings[K]
}

export function useAppSettings(): [AppSettings, (partialSettings: PartialOrFn<AppSettings>) => void] {
  const [appSettings, setAppSettings] = useAppSettingsKvApi()

  return [appSettings as AppSettings, setAppSettings as (partialSettings: PartialOrFn<AppSettings>) => void]
}

export function useActiveProjectTab(): [
  ProjectTabState,
  (partialData: Partial<ProjectTabState>) => void,
  string | null
] {
  const { activeProjectTabId } = useGetActiveProjectTabId()
  const { projectTab: activeProjectTabData } = useGetProjectTab(activeProjectTabId ?? '')
  const { updateProjectTabById } = useUpdateProjectTabById()

  const updateActiveProjectTab = (partialData: Partial<ProjectTabState>) => {
    if (activeProjectTabId) {
      updateProjectTabById(activeProjectTabId, partialData)
    }
  }

  return [activeProjectTabData as ProjectTabState, updateActiveProjectTab, activeProjectTabId as string | null]
}

export function useActiveChatId(): [string | null, (chatId: string | null) => void] {
  const { data: activeChatId } = useGetKvValue('activeChatId')
  const { mutate: setActiveChatIdKvFn } = useSetKvValue('activeChatId')

  const setActiveChatId = (chatId: string | null) => {
    if (!chatId) {
      console.error('Cannot set active chat id to null')
    }
    setActiveChatIdKvFn(chatId ?? '')
  }
  return [activeChatId as string | null, setActiveChatId]
}

export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>)

function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
  return typeof partialOrFn === 'function' ? (partialOrFn as (prev: T) => Partial<T>)(prev) : partialOrFn
}

export function useDeleteProjectTab() {
  // Get state and actions needed from the hook
  const { data: tabs } = useGetProjectTabs()
  const { activeProjectTabId: activeTabId } = useGetActiveProjectTabId()
  const { deleteTab } = useDeleteProjectTabById()
  const { setActiveProjectTabId } = useSetActiveProjectTabId()

  return (tabIdToDelete: string) => {
    if (!tabIdToDelete) {
      console.warn('Cannot delete tab without a tabId.')
      return
    }

    // Determine potential next active tab *before* deleting
    let nextActiveTabId: string | null = null
    if (activeTabId === tabIdToDelete) {
      const remainingTabIds = Object.keys(tabs ?? {}).filter((id) => id !== tabIdToDelete)
      // Simple logic: activate the first remaining tab. Could be more sophisticated.
      nextActiveTabId = remainingTabIds[0] ?? null
    }

    // Call the delete action from the store
    deleteTab(tabIdToDelete)

    // Activate the next tab *after* successful deletion
    if (activeTabId === tabIdToDelete) {
      setActiveProjectTabId(nextActiveTabId ?? '') // Call the activation action
    }
  }
}

// --- Convenience Updaters ---

/**
 * Convenience hook to update the state of a *specific* project tab
 * identified by its ID. Accepts a partial update or a function.
 */
export function useUpdateProjectTabState(projectTabId: string) {
  const { data: tabs } = useGetProjectTabs()
  const { updateProjectTabById } = useUpdateProjectTabById()
  const projectTab = tabs?.[projectTabId] // Get current state directly

  return (partialOrFn: PartialOrFn<ProjectTabState>) => {
    if (!projectTabId) {
      console.warn('Cannot update tab state without a projectTabId.')
      return
    }

    if (!projectTab) {
      console.warn(`Project tab ${projectTabId} data not found in state. Update might fail or do nothing.`)
      // Depending on desired behavior, you might return or attempt the update.
      // updateTab might handle non-existent IDs gracefully.
    }

    const finalPartial = getPartial(projectTab ?? ({} as ProjectTabState), partialOrFn) // Use helper

    if (Object.keys(finalPartial).length === 0) {
      return
    }

    updateProjectTabById(projectTabId, finalPartial) // Call the core KV action
  }
}

/**
 * Convenience hook to update the state of the *currently active* project tab.
 * Accepts a partial update or a function.
 */
export function useUpdateActiveProjectTab() {
  // Use the specific hook for active tab data and updater
  const [activeTabData, updateActiveTabData] = useActiveProjectTab()

  return (partialOrFn: PartialOrFn<ProjectTabState>) => {
    if (!activeTabData) {
      console.warn('No active project tab to update')
      return
    }
    // Use the helper function to resolve the partial
    const finalPartial = getPartial(activeTabData, partialOrFn)

    if (Object.keys(finalPartial).length === 0) {
      console.log(`Skipping update for active tab: partial is empty.`)
      return
    }

    // Call the updater function returned by useActiveProjectTabData
    updateActiveTabData(finalPartial)
  }
}

// New hook for PATCH /api/kv/:key for partial updates
export function useUpdateKvValue<K extends KVKey>(key: K) {
  const invalidateKv = useInvalidateKv(key)
  const queryClient = useQueryClient()

  // For partial updates, the input payload will be Partial<KVValue<K>>
  // However, the body sent to the API is { value: Partial<KVValue<K>> }
  type PartialSpecificValueType = Partial<KVValue<K>>

  return useMutation<
    { success: boolean; key: K; value: KVValue<K> }, // API response type
    Error, // Error type
    PartialSpecificValueType, // Input variable to the mutation function
    MutationContext<K> // Context type, can be reused or adapted
  >({
    mutationFn: async (partialPayload: PartialSpecificValueType) => {
      const resp = await fetch(`${SERVER_HTTP_ENDPOINT}/api/kv/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: partialPayload }), // Wrap partial payload in { value: ... }
        headers: {
          'Content-Type': 'application/json'
        }
      })
      if (!resp.ok) {
        const errorText = await resp.text()
        // Attempt to parse errorText as ApiError if possible for richer error info
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message && errorJson.code) {
            throw new ApiError(resp.status, errorJson.message, errorJson.code, errorJson.details)
          }
        } catch (e) {
          // Fallback if errorText is not JSON or not an ApiError structure
        }
        throw new Error(`Failed to update KV value for key "${key}": ${resp.status} ${errorText}`)
      }
      return resp.json()
    },
    onMutate: async (partialPayload) => {
      await queryClient.cancelQueries({ queryKey: ['kv', key] })
      const previousValue = queryClient.getQueryData<KVValue<K>>(['kv', key])

      // Optimistically update to the new value (merged)
      queryClient.setQueryData<KVValue<K>>(['kv', key], (old) => {
        if (!old) return previousValue // Should not happen if data is loaded
        // Simple merge for objects, arrays might need more specific logic
        // depending on use case (e.g., replace, append, merge items by ID)
        if (
          typeof old === 'object' &&
          old !== null &&
          !Array.isArray(old) &&
          typeof partialPayload === 'object' &&
          partialPayload !== null &&
          !Array.isArray(partialPayload)
        ) {
          return { ...old, ...partialPayload } as KVValue<K>
        }
        // For non-objects or arrays, or if more complex merge is needed,
        // this optimistic update might be too simple or incorrect.
        // Consider if a full replacement is safer for non-object types here,
        // or if specific merge logic is required based on K.
        // For now, returning partialPayload if old is not an object to be merged with.
        // This part might need refinement based on the actual types in KVValue<K>
        return { ...(old as object), ...(partialPayload as object) } as KVValue<K>
      })

      return { previousValue }
    },
    onError: (err, partialPayload, context) => {
      if (context?.previousValue) {
        queryClient.setQueryData(['kv', key], context.previousValue)
      }
      // Consider calling commonErrorHandler or a more specific one
      commonErrorHandler(err)
    },
    onSuccess: (data) => {
      // data from PATCH should be the full new value
      queryClient.setQueryData(['kv', key], data.value)
      invalidateKv() // Could also use queryClient.invalidateQueries({ queryKey: ['kv', key] });
    }
  })
}
