import { useGlobalStateStore } from "./global-state-store"
import type {
    InboundMessage,
} from "shared"

/**
 * Helper function to compare values for deep equality
 */
function isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    // Handle primitive types
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
        return a === b;
    }
    
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((val, idx) => isEqual(val, b[idx]));
    }
    
    // Handle objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => 
        Object.prototype.hasOwnProperty.call(b, key) && 
        isEqual(a[key], b[key])
    );
}

/**
 * Compares two objects and returns only the changed fields
 * This helps reduce unnecessary updates
 */
function getChangedFields<T extends Record<string, any>>(
    current: T, 
    incoming: Partial<T>
): Partial<T> | null {
    if (!current) return incoming;
    
    const changes: Partial<T> = {};
    let hasChanges = false;
    
    for (const key in incoming) {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) {
            if (!isEqual(current[key], incoming[key])) {
                changes[key] = incoming[key];
                hasChanges = true;
            }
        }
    }
    
    return hasChanges ? changes : null;
}

// Optimized message handler to reduce unnecessary state updates
export function handleIncomingWebsocketMessage(msg: InboundMessage) {
    const zustandStore = useGlobalStateStore.getState()

    switch (msg.type) {
        case "initial_state": {
            // For initial state, we always apply the full update
            zustandStore.mergeFullGlobalState(msg.data)
            break
        }
            
        case "state_update": {
            // For state updates, we can be more selective and only update what changed
            // This is especially important for frequent updates
            
            // Compare incoming project tabs with current ones
            const projectTabsToUpdate: Record<string, any> = {};
            let hasProjectTabChanges = false;
            
            Object.entries(msg.data.projectTabs || {}).forEach(([tabId, tabData]) => {
                const currentTab = zustandStore.projectTabs[tabId];
                const changes = getChangedFields(currentTab, tabData);
                
                if (changes) {
                    projectTabsToUpdate[tabId] = {
                        ...currentTab,
                        ...changes
                    };
                    hasProjectTabChanges = true;
                }
            });
            
            // Compare incoming chat tabs with current ones
            const chatTabsToUpdate: Record<string, any> = {};
            let hasChatTabChanges = false;
            
            Object.entries(msg.data.chatTabs || {}).forEach(([tabId, tabData]) => {
                const currentTab = zustandStore.chatTabs[tabId];
                const changes = getChangedFields(currentTab, tabData);
                
                if (changes) {
                    chatTabsToUpdate[tabId] = {
                        ...currentTab,
                        ...changes
                    };
                    hasChatTabChanges = true;
                }
            });
            
            // Check for settings changes
            const settingsChanges = getChangedFields(zustandStore.settings, msg.data.settings || {});
            
            // Check for active tab changes
            const projectActiveTabChanged = 
                msg.data.projectActiveTabId !== undefined && 
                msg.data.projectActiveTabId !== zustandStore.projectActiveTabId;
                
            const chatActiveTabChanged = 
                msg.data.chatActiveTabId !== undefined && 
                msg.data.chatActiveTabId !== zustandStore.chatActiveTabId;
            
            // Batch all updates into a single setState call to prevent cascading renders
            if (hasProjectTabChanges || hasChatTabChanges || settingsChanges || 
                projectActiveTabChanged || chatActiveTabChanged) {
                
                useGlobalStateStore.setState((state) => {
                    const updates: Partial<typeof state> = {};
                    
                    if (hasProjectTabChanges) {
                        updates.projectTabs = {
                            ...state.projectTabs,
                            ...projectTabsToUpdate
                        };
                    }
                    
                    if (hasChatTabChanges) {
                        updates.chatTabs = {
                            ...state.chatTabs,
                            ...chatTabsToUpdate
                        };
                    }
                    
                    if (settingsChanges) {
                        updates.settings = {
                            ...state.settings,
                            ...settingsChanges
                        };
                    }
                    
                    if (projectActiveTabChanged) {
                        updates.projectActiveTabId = msg.data.projectActiveTabId;
                    }
                    
                    if (chatActiveTabChanged) {
                        updates.chatActiveTabId = msg.data.chatActiveTabId;
                    }
                    
                    return updates;
                });
            }
            break;
        }

        case "create_project_tab": {
            const { tabId, data } = msg
            useGlobalStateStore.setState((state) => ({
                projectTabs: { ...state.projectTabs, [tabId]: data },
                projectActiveTabId: tabId
            }))
            break
        }

        case "update_project_tab":
        case "update_project_tab_partial": {
            const { tabId } = msg
            useGlobalStateStore.setState((state) => {
                const existing = state.projectTabs[tabId]
                if (!existing) return {}
                
                const updates = msg.type === "update_project_tab" ? msg.data : msg.partial;
                // Only update if changes are detected
                const changes = getChangedFields(existing, updates);
                if (!changes) return {};
                
                return {
                    projectTabs: {
                        ...state.projectTabs,
                        [tabId]: {
                            ...existing,
                            ...changes,
                        }
                    }
                }
            })
            break
        }

        case "delete_project_tab": {
            const { tabId } = msg
            useGlobalStateStore.setState((state) => {
                if (!state.projectTabs[tabId]) return {}; // No change if tab doesn't exist
                
                const newTabs = { ...state.projectTabs }
                delete newTabs[tabId]
                const remaining = Object.keys(newTabs)
                return {
                    projectTabs: newTabs,
                    projectActiveTabId: state.projectActiveTabId === tabId
                        ? (remaining.length > 0 ? remaining[0] : null)
                        : state.projectActiveTabId
                }
            })
            break
        }

        case "set_active_project_tab": {
            // Only update if it's actually different
            if (zustandStore.projectActiveTabId !== msg.tabId) {
                useGlobalStateStore.setState({ projectActiveTabId: msg.tabId })
            }
            break
        }

        case "create_chat_tab": {
            const { tabId, data } = msg
            useGlobalStateStore.setState((state) => ({
                chatTabs: { ...state.chatTabs, [tabId]: data },
                chatActiveTabId: tabId
            }))
            break
        }

        case "update_chat_tab":
        case "update_chat_tab_partial": {
            const { tabId } = msg
            useGlobalStateStore.setState((state) => {
                const existing = state.chatTabs[tabId]
                if (!existing) return {}
                
                const updates = msg.type === "update_chat_tab" ? msg.data : msg.partial;
                // Only update if changes are detected
                const changes = getChangedFields(existing, updates);
                if (!changes) return {};
                
                return {
                    chatTabs: {
                        ...state.chatTabs,
                        [tabId]: {
                            ...existing,
                            ...changes,
                        }
                    }
                }
            })
            break
        }

        case "delete_chat_tab": {
            const { tabId } = msg
            useGlobalStateStore.setState((state) => {
                if (!state.chatTabs[tabId]) return {}; // No change if tab doesn't exist
                
                const newTabs = { ...state.chatTabs }
                delete newTabs[tabId]
                const remaining = Object.keys(newTabs)
                return {
                    chatTabs: newTabs,
                    chatActiveTabId: state.chatActiveTabId === tabId
                        ? (remaining.length > 0 ? remaining[0] : null)
                        : state.chatActiveTabId
                }
            })
            break
        }

        case "set_active_chat_tab": {
            // Only update if it's actually different
            if (zustandStore.chatActiveTabId !== msg.tabId) {
                useGlobalStateStore.setState({ chatActiveTabId: msg.tabId })
            }
            break
        }

        case "update_settings":
        case "update_settings_partial": {
            useGlobalStateStore.setState((state) => {
                const updates = msg.type === "update_settings" ? msg.data : msg.partial;
                // Only update if changes are detected
                const changes = getChangedFields(state.settings, updates);
                if (!changes) return {};
                
                return {
                    settings: {
                        ...state.settings,
                        ...changes,
                    }
                }
            })
            break
        }

        case "update_global_state_key": {
            // Check if the key already exists and has the same value
            const key = msg.data.key;
            // Use a type assertion to handle the dynamic key access with proper typing
            const current = (zustandStore as Record<string, any>)[key];
            const incomingPartial = msg.data.partial;
            
            // Only update if there's a difference
            if (!isEqual(current, incomingPartial)) {
                zustandStore.mergePartialGlobalState({ [key]: incomingPartial })
            }
            break
        }

        // etc. for your other inbound messages...
    }
}