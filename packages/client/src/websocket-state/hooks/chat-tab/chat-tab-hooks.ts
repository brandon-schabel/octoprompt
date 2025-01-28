import { ChatTabState } from "shared/index"
import { useChatTabById } from "../selectors/websocket-selectors"
import { useUpdateChatTabState } from "../updaters/websocket-updater-hooks"
import { useGenericField } from "../helpers/use-generic-field"

// TOOD: this now uses the generic field hook which comes to readers/writers from the store, so these need to be implemented in the pages
export function useChatTabField<K extends keyof ChatTabState>(tabId: string, fieldKey: K) {
    const chatTab = useChatTabById(tabId)
    const updateChatTabState = useUpdateChatTabState()

    // Reusable hook
    return useGenericField<ChatTabState, K>({
        queryKey: ["globalState", "chatTab", tabId],
        fieldKey,
        currentRecord: chatTab ?? undefined,
        enabled: Boolean(tabId), // only run if we have a valid tabId
        onUpdate: (updater) => {
            if (chatTab) {
                updateChatTabState(tabId, updater, chatTab)
            }
        },
    })
}