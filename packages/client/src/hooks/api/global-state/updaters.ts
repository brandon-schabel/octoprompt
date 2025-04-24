import { useActiveProjectTab } from "@/hooks/api/global-state/selectors";
import { buildTicketContent } from "@/components/tickets/utils/ticket-utils";
// Removed uuid - ID generation should happen server-side or within the create mutation if needed there
import { useQueryClient } from "@tanstack/react-query";
import { getApiStateQueryKey } from "@/hooks/generated/@tanstack/react-query.gen";

// Import the NEW specific mutation hooks and the state getter
import {
    useGetState,
    useUpdateSettingsMutation,
    useSetActiveChatMutation,
    useSetActiveProjectTabMutation,
    useCreateProjectTabMutation,
    useUpdateProjectTabMutation,
    useDeleteProjectTabMutation,
    UpdateProjectTabVariables, // Keep helper type
} from "@/hooks/api/use-state-api"; // Adjust path if needed

import { AppSettings, GetApiStateResponse, GlobalState, ProjectTabState, TicketWithTasks } from "@/hooks/generated"; // Keep types

// Helper type (Keep)
export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

// Helper function (Keep) - Needed for partial updates where current state is required
function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
    return typeof partialOrFn === "function" ? (partialOrFn as (prev: T) => Partial<T>)(prev) : partialOrFn;
}


// --- Simplified Core Updaters ---

/**
 * Hook returning a function to set the active chat ID via API.
 */
export function useSetActiveChat() {
    const { mutate: mutateActiveChat } = useSetActiveChatMutation();
    return (chatId: string | null) => {
        console.log(`Setting active chat via API: ${chatId}`);
        mutateActiveChat(chatId); // Delegate directly to the mutation
    };
}

/**
 * Hook returning a function to update application settings.
 * Accepts a partial settings object or a function to produce one.
 * NOTE: This assumes the API endpoint/service handles merging partial updates.
 * If `useUpdateSettingsMutation` strictly requires the *full* settings object,
 * this hook needs to read the current state first (as in the original).
 * Based on state-routes.ts (POST /api/state/settings expecting partial),
 * the mutation *should* ideally accept a partial. Let's assume it does for simplification.
 * If not, the original implementation retrieving state first is necessary.
 */
export function useUpdateSettings() {
    const { mutate: mutateSettings } = useUpdateSettingsMutation();
    // We need queryClient ONLY if applying a function-based update
    const queryClient = useQueryClient();

    return (partialOrFn: PartialOrFn<AppSettings>) => {
        let finalPartial: Partial<AppSettings>;

        if (typeof partialOrFn === 'function') {
            // Need current state to apply the function
            const currentState = queryClient.getQueryData<GetApiStateResponse>(getApiStateQueryKey())?.data?.settings;
            if (!currentState) {
                console.warn("Settings not found in cache for function update. Update might be based on stale data or fail.");
                // Optionally invalidate to refetch and retry, or just proceed cautiously.
                // queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
                // For now, proceed but warn. The mutation might fail if the backend relies on current state implicitly.
                finalPartial = (partialOrFn as (prev: AppSettings) => Partial<AppSettings>)(currentState ?? {} as AppSettings); // Pass empty obj if not found
            } else {
                finalPartial = (partialOrFn as (prev: AppSettings) => Partial<AppSettings>)(currentState);
            }
        } else {
            finalPartial = partialOrFn;
        }

        if (Object.keys(finalPartial).length === 0) {
            console.log("Skipping settings update: partial is empty.");
            return;
        }

        console.log("Updating settings via API with partial:", finalPartial);
        // Assumes useUpdateSettingsMutation takes the partial directly.
        // If it needs the full object, uncomment the queryClient logic and merge here.
        mutateSettings(finalPartial); // Call the mutation with the partial data
    };
}


/**
 * Hook returning a function to set the active project tab ID via API.
 */
export function useSetActiveProjectTab() {
    const { mutate: mutateActiveTab } = useSetActiveProjectTabMutation();
    return (tabId: string | null) => {
        console.log(`Setting active project tab via API: ${tabId}`);
        mutateActiveTab(tabId); // Delegate directly to the mutation
    };
}

/**
 * Hook returning a function to update a specific project tab via API.
 */
export function useUpdateProjectTab() {
    // Use the specific mutation hook for updating a single tab
    const { mutate: mutateUpdateTab } = useUpdateProjectTabMutation();

    // This function now directly aligns with what useUpdateProjectTabMutation expects
    return (tabId: string, partial: Partial<ProjectTabState>) => {
        if (!tabId) {
            console.warn("Cannot update tab without a tabId.");
            return;
        }
        if (Object.keys(partial).length === 0) {
            console.log(`Skipping update for tab ${tabId}: partial is empty.`);
            return;
        }
        console.log(`Updating project tab ${tabId} via API with partial:`, partial);
        mutateUpdateTab({ tabId, partial }); // Delegate directly
    };
}

/**
 * Hook returning a function to delete a specific project tab via API.
 * Handles activating the next available tab if the deleted tab was active.
 */
export function useDeleteProjectTab() {
    const { mutate: mutateDeleteTab } = useDeleteProjectTabMutation();
    const setActiveTab = useSetActiveProjectTab(); // Uses simplified API call
    const queryClient = useQueryClient(); // Needed to read cache for next tab logic

    return (tabIdToDelete: string) => {
        if (!tabIdToDelete) {
            console.warn("Cannot delete tab without a tabId.");
            return;
        }

        // Read current state *from cache* just before deleting
        const currentQueryState = queryClient.getQueryData<GetApiStateResponse>(getApiStateQueryKey());
        const activeTabId = currentQueryState?.data?.projectActiveTabId;
        const projectTabs = currentQueryState?.data?.projectTabs ?? {};

        console.log(`Attempting to delete project tab ${tabIdToDelete} via API`);

        // Determine potential next active tab *before* mutation might change cache
        let nextActiveTabId: string | null = null;
        if (activeTabId === tabIdToDelete) {
            const remainingTabIds = Object.keys(projectTabs).filter(id => id !== tabIdToDelete);
            // Simple logic: activate the first remaining tab. Could be more sophisticated (e.g., based on sortOrder).
            nextActiveTabId = remainingTabIds[0] ?? null;
            console.log(`Deleted tab was active. Next active tab will be: ${nextActiveTabId}`);
        }

        // Call the mutation
        mutateDeleteTab(tabIdToDelete, {
            onSuccess: () => {
                // Cache invalidation/update is handled by useDeleteProjectTabMutation's default onSuccess/onError
                console.log(`Tab ${tabIdToDelete} delete mutation succeeded.`);
                // Activate the next tab *after* successful deletion confirmed by the mutation
                if (activeTabId === tabIdToDelete) {
                    console.log(`Setting next active tab to ${nextActiveTabId}`);
                    setActiveTab(nextActiveTabId); // This triggers its own mutation
                }
            },
            onError: (error) => {
                // Error logging/handling primarily done within useDeleteProjectTabMutation
                console.error(`Mutation to delete tab ${tabIdToDelete} failed:`, error);
            }
        });
    };
}


// --- Simplified Convenience Updaters ---
// These rely on the simplified core updaters above.

/**
 * Convenience hook to update the state of a *specific* project tab
 * identified by its ID. Accepts a partial update or a function.
 */
export function useUpdateProjectTabState(projectTabId: string) {
    const updateTab = useUpdateProjectTab(); // Uses the simplified core updater
    const queryClient = useQueryClient(); // Needed only for function-based updates

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!projectTabId) {
            console.warn("Cannot update tab state without a projectTabId.");
            return;
        }

        let finalPartial: Partial<ProjectTabState>;

        if (typeof partialOrFn === 'function') {
            // Need current state of the specific tab for the function
            const currentQueryState = queryClient.getQueryData<GetApiStateResponse>(getApiStateQueryKey());
            const projectTab = currentQueryState?.data?.projectTabs?.[projectTabId];

            if (!projectTab) {
                console.warn(`Project tab ${projectTabId} data not found in cache for function update. Update might be based on stale data or fail.`);
                // Update might still work if backend merges correctly, but it's risky.
                // Proceeding cautiously.
                finalPartial = (partialOrFn as (prev: ProjectTabState) => Partial<ProjectTabState>)(projectTab ?? {} as ProjectTabState);
            } else {
                finalPartial = getPartial(projectTab, partialOrFn); // Use helper safely
            }
        } else {
            finalPartial = partialOrFn;
        }

        if (Object.keys(finalPartial).length === 0) {
            console.log(`Skipping update for tab ${projectTabId}: partial is empty.`);
            return;
        }

        updateTab(projectTabId, finalPartial); // Call the core API updater
    };
}

/**
 * Convenience hook to update the state of the *currently active* project tab.
 * Accepts a partial update or a function.
 */
export function useUpdateActiveProjectTab() {
    // Selector reads from cache, which is updated by the mutations
    const { id: activeProjectTabId } = useActiveProjectTab();
    // Get the specific updater function for the active tab ID (if any)
    const updateTabFn = useUpdateProjectTabState(activeProjectTabId ?? '');

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!activeProjectTabId) {
            console.warn("No active project tab to update");
            return;
        }
        // Delegate to the specific tab updater
        updateTabFn(partialOrFn);
    };
}

/**
 * Convenience hook to update a single key within the *currently active* project tab's state.
 */
export function useUpdateActiveProjectTabStateKey() {
    const updateActiveProjectTab = useUpdateActiveProjectTab(); // Uses the simplified convenience hook

    return <K extends keyof ProjectTabState>(
        key: K,
        // Value or a function that receives the *previous value* of the key
        valueOrFn: ProjectTabState[K] | ((prevValue: ProjectTabState[K] | undefined) => ProjectTabState[K])
    ) => {
        // Delegate to the active tab updater, constructing the partial object using its function form
        updateActiveProjectTab((prevState) => {
            // Important: prevState here comes from the cache via useUpdateProjectTabState's logic
            if (!prevState) {
                console.warn(`Cannot update key '${key}' on non-existent active project tab state (cache inconsistency?). Update aborted.`);
                return {}; // Return empty partial to prevent update
            }
            const prevValue = prevState[key];
            const newValue = typeof valueOrFn === "function"
                ? (valueOrFn as (prevValue: ProjectTabState[K] | undefined) => ProjectTabState[K])(prevValue)
                : valueOrFn;

            return { [key]: newValue } as Partial<ProjectTabState>; // Return the single key-value partial
        });
    };
}


// --- Simplified Creation Hooks ---

/**
 * Hook returning the async mutation function to create a new project tab.
 * Relies on the backend to generate the ID and return the full state.
 * The caller should use the returned function's promise/callbacks (`onSuccess`)
 * to get the new tab ID and handle activation if needed.
 */
export function useCreateProjectTab() {
    const { mutateAsync: createTabMutateAsync, ...rest } = useCreateProjectTabMutation();
    const setActiveTab = useSetActiveProjectTab(); // Keep for potential activation in caller

    // Return the async mutation function and potentially the status flags
    // Let the caller handle onSuccess, onError, and activation logic.
    return {
        createProjectTab: async (
            // Based on CreateProjectTabBodySchema in state-routes.ts
            initialData: Partial<ProjectTabState> & { projectId: string; displayName?: string },
            options?: { activate?: boolean } // Option to activate after creation
        ): Promise<{ newTabId: string, newState: GlobalState } | undefined> => { // Return structure depends on mutation response
            console.log("[CreateProjectTab] Creating tab with initial data:", initialData);

            if (!initialData.projectId) {
                console.error("[CreateProjectTab] projectId is required.");
                throw new Error("projectId is required to create a project tab.");
            }

            // The backend is expected to merge this partial data with defaults
            // and generate the ID.
            try {
                // Response type from useCreateProjectTabMutation might differ, adjust as needed.
                // Assuming it returns { success: boolean, tabId: string, data: GlobalState } based on CreateProjectTabResponseSchema
                const response = await createTabMutateAsync(initialData);

                if (response?.success && response.tabId && response.data) {
                    console.log(`[CreateProjectTab] Tab created successfully via API. New Tab ID: ${response.tabId}.`);
                    if (options?.activate) {
                        console.log(`[CreateProjectTab] Activating new tab: ${response.tabId}`);
                        setActiveTab(response.tabId); // Fire and forget activation
                    }
                    // Return data needed by caller (e.g., the ID and the new state)
                    return { newTabId: response.tabId, newState: response.data };
                } else {
                    console.error("[CreateProjectTab] Creation mutation succeeded but response format was unexpected:", response);
                    throw new Error("Failed to create tab or received invalid response.");
                }
            } catch (error) {
                console.error("[CreateProjectTab] Failed to create tab via mutation:", error);
                // Error should be handled by the mutation hook's onError as well,
                // but re-throwing allows caller to catch it too.
                throw error;
            }
        },
        ...rest // Expose isPending, isError, etc. from the mutation hook
    };
}

/**
 * Hook returning an async function to create and potentially update a project tab based on ticket data.
 * Simplified to use the updated `useCreateProjectTab`.
 */
export function useCreateProjectTabFromTicket() {
    const { createProjectTab } = useCreateProjectTab(); // Gets the async function
    // useUpdateProjectTab might not be needed if creation accepts all necessary fields.
    // const updateProjectTab = useUpdateProjectTab();

    return async (data: TicketWithTasks): Promise<string | undefined> => { // Return the new tab ID
        const userPrompt = buildTicketContent(data);
        // Ensure suggestedFileIds is parsed correctly, default to empty array if null/undefined/invalid
        let suggestedFileIds: string[] = [];
        try {
            if (data.ticket.suggestedFileIds) {
                suggestedFileIds = JSON.parse(data.ticket.suggestedFileIds);
                if (!Array.isArray(suggestedFileIds)) {
                    console.warn(`Parsed suggestedFileIds for ticket ${data.ticket.id} is not an array, defaulting to empty.`);
                    suggestedFileIds = [];
                }
            }
        } catch (e) {
            console.error(`Failed to parse suggestedFileIds for ticket ${data.ticket.id}:`, e);
            suggestedFileIds = [];
        }


        // Prepare initial data for creation
        // Align with CreateProjectTabBodySchema + potential ProjectTabState fields
        const initialTabData: Partial<ProjectTabState> & { projectId: string; displayName?: string } = {
            projectId: data.ticket.projectId,
            userPrompt: userPrompt,
            selectedFiles: suggestedFileIds, // Initial files can be the suggested ones
            displayName: data.ticket.title || `Ticket ${data.ticket.id}`,
            ticketId: data.ticket.id, // Pass ticket ID if schema/backend supports it on creation
            suggestedFileIds: suggestedFileIds, // Also store the suggestions
            // Add other relevant fields if the creation endpoint accepts them
        };

        try {
            // Call the creation function, request activation
            const result = await createProjectTab(initialTabData, { activate: true });

            if (result?.newTabId) {
                console.log(`Ticket tab ${result.newTabId} created and activation requested.`);

                // If there are fields that *cannot* be set during creation and *must* be updated after:
                // const ticketSpecificUpdates: Partial<ProjectTabState> = {
                //     // e.g., someFieldOnlySettableAfterCreation: value
                // };
                // if (Object.keys(ticketSpecificUpdates).length > 0) {
                //     console.log(`Applying specific post-creation updates to tab ${result.newTabId}`);
                //     updateProjectTab(result.newTabId, ticketSpecificUpdates);
                // }

                return result.newTabId; // Return the ID
            } else {
                console.error("Failed to create project tab from ticket: No ID returned.");
                return undefined;
            }
        } catch (error) {
            console.error("Error creating project tab from ticket:", error);
            // Handle or re-throw the error if needed
            return undefined;
        }
    };
}