import { useGlobalStateStore } from "./global-state-store"
import type {
    InboundMessage,
} from "shared"

// Example: call this once to set up your server WebSocket event handlers
export function handleIncomingWebsocketMessage(msg: InboundMessage) {
    const zustandStore = useGlobalStateStore.getState()

    switch (msg.type) {
        case "initial_state":
        case "state_update": {
            zustandStore.mergeFullGlobalState(msg.data)
            break
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
                return {
                    projectTabs: {
                        ...state.projectTabs,
                        [tabId]: {
                            ...existing,
                            ...(msg.type === "update_project_tab" ? msg.data : msg.partial),
                        }
                    }
                }
            })
            break
        }

        case "delete_project_tab": {
            const { tabId } = msg
            useGlobalStateStore.setState((state) => {
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
            useGlobalStateStore.setState({ projectActiveTabId: msg.tabId })
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
                return {
                    chatTabs: {
                        ...state.chatTabs,
                        [tabId]: {
                            ...existing,
                            ...(msg.type === "update_chat_tab" ? msg.data : msg.partial),
                        }
                    }
                }
            })
            break
        }

        case "delete_chat_tab": {
            const { tabId } = msg
            useGlobalStateStore.setState((state) => {
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
            useGlobalStateStore.setState({ chatActiveTabId: msg.tabId })
            break
        }

        case "update_settings":
        case "update_settings_partial": {
            useGlobalStateStore.setState((state) => ({
                settings: {
                    ...state.settings,
                    ...(msg.type === "update_settings" ? msg.data : msg.partial),
                }
            }))
            break
        }

        case "update_global_state_key": {
            zustandStore.mergePartialGlobalState({ [msg.data.key]: msg.data.partial })
            break
        }

        // etc. for your other inbound messages...
    }
}