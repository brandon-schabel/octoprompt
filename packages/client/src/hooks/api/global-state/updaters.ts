import { useActiveProjectTab as useActiveProjectTabData, useProjectTabsState, useAppSettings, useActiveChatId } from "@/hooks/api/use-state-api"; // Use local state hooks
import { buildTicketContent } from "@/components/tickets/utils/ticket-utils";
import { AppSettings, GlobalState, ProjectTabState } from "shared/src/schemas/global-state-schema"; // Import from shared
import { Task, Ticket, TicketWithTasks } from "@/hooks/generated";

// Helper type (Keep)
export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

// Helper function (Keep) - Needed for partial updates where current state is required
function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
    return typeof partialOrFn === "function" ? (partialOrFn as (prev: T) => Partial<T>)(prev) : partialOrFn;
}

// --- Core Updaters ---

/**
 * Hook returning a function to set the active chat ID using Zustand store.
 */
export function useSetActiveChat() {
    const [, setActiveChatId] = useActiveChatId(); // Get the setter from the store hook
    return (chatId: string | null) => {
        console.log(`Setting active chat via Zustand: ${chatId}`);
        setActiveChatId(chatId); // Call the Zustand action
    };
}

/**
 * Hook returning a function to update application settings using Zustand store.
 */
export function useUpdateSettings() {
    const [currentSettings, updateSettings] = useAppSettings(); // Get state and setter

    return (partialOrFn: PartialOrFn<AppSettings>) => {
        const finalPartial = getPartial(currentSettings, partialOrFn); // Use helper with current state

        if (Object.keys(finalPartial).length === 0) {
            console.log("Skipping settings update: partial is empty.");
            return;
        }

        console.log("Updating settings via Zustand with partial:", finalPartial);
        updateSettings(finalPartial); // Call the Zustand action
    };
}

/**
 * Hook returning a function to set the active project tab ID using Zustand store.
 */
export function useSetActiveProjectTab() {
    const { setActiveTabId } = useProjectTabsState(); // Get the action from the store hook
    return (tabId: string | null) => {
        console.log(`Setting active project tab via Zustand: ${tabId}`);
        setActiveTabId(tabId); // Call the Zustand action
    };
}

/**
 * Hook returning a function to update a specific project tab using Zustand store.
 */
export function useUpdateProjectTab() {
    const { updateTab } = useProjectTabsState(); // Get the action from the store hook
    return (tabId: string, partial: Partial<ProjectTabState>) => {
        if (!tabId) {
            console.warn("Cannot update tab without a tabId.");
            return;
        }
        if (Object.keys(partial).length === 0) {
            console.log(`Skipping update for tab ${tabId}: partial is empty.`);
            return;
        }
        console.log(`Updating project tab ${tabId} via Zustand with partial:`, partial);
        updateTab(tabId, partial); // Call the Zustand action
    };
}

/**
 * Hook returning a function to delete a specific project tab using Zustand store.
 * Handles activating the next available tab if the deleted tab was active.
 */
export function useDeleteProjectTab() {
    // Get state and actions needed from the hook
    const { tabs, activeTabId, deleteTab, setActiveTabId } = useProjectTabsState();

    return (tabIdToDelete: string) => {
        if (!tabIdToDelete) {
            console.warn("Cannot delete tab without a tabId.");
            return;
        }

        console.log(`Attempting to delete project tab ${tabIdToDelete} via Zustand`);

        // Determine potential next active tab *before* deleting
        let nextActiveTabId: string | null = null;
        if (activeTabId === tabIdToDelete) {
            const remainingTabIds = Object.keys(tabs).filter(id => id !== tabIdToDelete);
            // Simple logic: activate the first remaining tab. Could be more sophisticated.
            nextActiveTabId = remainingTabIds[0] ?? null;
            console.log(`Deleted tab was active. Next active tab will be: ${nextActiveTabId}`);
        }

        // Call the delete action from the store
        deleteTab(tabIdToDelete);
        console.log(`Tab ${tabIdToDelete} deleted from Zustand.`);

        // Activate the next tab *after* successful deletion
        if (activeTabId === tabIdToDelete) {
            console.log(`Setting next active tab to ${nextActiveTabId} via Zustand`);
            setActiveTabId(nextActiveTabId); // Call the activation action
        }
    };
}

// --- Convenience Updaters ---

/**
 * Convenience hook to update the state of a *specific* project tab
 * identified by its ID. Accepts a partial update or a function.
 */
export function useUpdateProjectTabState(projectTabId: string) {
    const { tabs, updateTab } = useProjectTabsState(); // Get state and action
    const projectTab = tabs[projectTabId]; // Get current state directly

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!projectTabId) {
            console.warn("Cannot update tab state without a projectTabId.");
            return;
        }

        if (!projectTab) {
            console.warn(`Project tab ${projectTabId} data not found in state. Update might fail or do nothing.`);
            // Depending on desired behavior, you might return or attempt the update.
            // updateTab might handle non-existent IDs gracefully.
        }

        const finalPartial = getPartial(projectTab ?? {} as ProjectTabState, partialOrFn); // Use helper

        if (Object.keys(finalPartial).length === 0) {
            console.log(`Skipping update for tab ${projectTabId}: partial is empty.`);
            return;
        }

        console.log(`Updating specific project tab ${projectTabId} via Zustand with partial:`, finalPartial);
        updateTab(projectTabId, finalPartial); // Call the core Zustand action
    };
}

/**
 * Convenience hook to update the state of the *currently active* project tab.
 * Accepts a partial update or a function.
 */
export function useUpdateActiveProjectTab() {
    // Use the specific hook for active tab data and updater
    const [activeTabData, updateActiveTabData] = useActiveProjectTabData();

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!activeTabData) {
            console.warn("No active project tab to update");
            return;
        }
        // Use the helper function to resolve the partial
        const finalPartial = getPartial(activeTabData, partialOrFn);

        if (Object.keys(finalPartial).length === 0) {
            console.log(`Skipping update for active tab: partial is empty.`);
            return;
        }

        console.log("Updating active project tab via Zustand with partial:", finalPartial);
        // Call the updater function returned by useActiveProjectTabData
        updateActiveTabData(finalPartial);
    };
}


/**
 * Convenience hook to update a single key within the *currently active* project tab's state.
 */
export function useUpdateActiveProjectTabStateKey() {
    const [activeTabData, updateActiveTabData] = useActiveProjectTabData(); // Get active tab data and updater

    return <K extends keyof ProjectTabState>(
        key: K,
        valueOrFn: ProjectTabState[K] | ((prevValue: ProjectTabState[K] | undefined) => ProjectTabState[K])
    ) => {
        if (!activeTabData) {
            console.warn(`Cannot update key '${String(key)}': No active project tab.`);
            return;
        }

        const prevValue = activeTabData[key];
        const newValue = typeof valueOrFn === "function"
            ? (valueOrFn as (prevValue: ProjectTabState[K] | undefined) => ProjectTabState[K])(prevValue)
            : valueOrFn;

        console.log(`Updating key '${String(key)}' on active project tab via Zustand. New value:`, newValue);
        // Call the active tab updater with the single key-value partial
        updateActiveTabData({ [key]: newValue } as Partial<ProjectTabState>);
    };
}

// --- Creation Hooks ---

/**
 * Hook returning a function to create a new project tab using Zustand store.
 * ID generation and state update are handled synchronously by the store action.
 * Returns the ID of the newly created tab.
 */
export function useCreateProjectTab() {
    const { createTab, setActiveTabId } = useProjectTabsState(); // Get actions from store hook

    return (
        initialData: Partial<ProjectTabState> & { projectId: string; displayName?: string },
        options?: { activate?: boolean }
    ): string | undefined => { // Returns the new tab ID or undefined on error
        console.log("[CreateProjectTab] Creating tab via Zustand with initial data:", initialData);

        if (!initialData.projectId) {
            console.error("[CreateProjectTab] projectId is required.");
            // Optionally throw an error or just return undefined
            return undefined;
            // throw new Error("projectId is required to create a project tab.");
        }

        try {
            // Call the Zustand action, which handles ID generation and state update
            const newTabId = createTab(initialData);

            if (newTabId) {
                console.log(`[CreateProjectTab] Tab created successfully via Zustand. New Tab ID: ${newTabId}.`);
                if (options?.activate) {
                    console.log(`[CreateProjectTab] Activating new tab: ${newTabId}`);
                    setActiveTabId(newTabId); // Activate the new tab
                }
                return newTabId; // Return the generated ID
            } else {
                // This case might indicate an issue within the createTab action itself
                console.error("[CreateProjectTab] Zustand createTab action did not return a new tab ID.");
                return undefined;
            }
        } catch (error) {
            console.error("[CreateProjectTab] Failed to create tab via Zustand action:", error);
            // Handle error appropriately, maybe return undefined
            return undefined;
        }
    };
}

/**
 * Hook returning a function to create and potentially activate a project tab based on ticket data.
 * Simplified to use the Zustand-based `useCreateProjectTab`.
 */
export function useCreateProjectTabFromTicket() {
    const createProjectTab = useCreateProjectTab(); // Gets the Zustand-based creator function
    // updateProjectTab is generally not needed post-creation with Zustand unless there's complex logic

    return (data: TicketWithTasks): string | undefined => { // Returns the new tab ID or undefined
        const userPrompt = buildTicketContent(data.ticket, data.tasks);
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

        const initialTabData: Partial<ProjectTabState> & { projectId: string; displayName?: string } = {
            projectId: data.ticket.projectId,
            userPrompt: userPrompt,
            selectedFiles: suggestedFileIds,
            displayName: data.ticket.title || `Ticket ${data.ticket.id}`,
            ticketId: data.ticket.id,
            suggestedFileIds: suggestedFileIds,
        };

        try {
            // Call the creation function, request activation
            const newTabId = createProjectTab(initialTabData, { activate: true });

            if (newTabId) {
                console.log(`Ticket tab ${newTabId} created and activation requested via Zustand.`);
                // Post-creation updates are less common with Zustand unless absolutely necessary
                return newTabId; // Return the ID
            } else {
                console.error("Failed to create project tab from ticket using Zustand action.");
                return undefined;
            }
        } catch (error) {
            console.error("Error creating project tab from ticket via Zustand:", error);
            return undefined;
        }
    };
}