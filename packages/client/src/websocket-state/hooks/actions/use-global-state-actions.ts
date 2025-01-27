import { useQueryClient } from "@tanstack/react-query"
import { OutboundMessage, ProjectTabState } from "shared/index"
import { useSendWebSocketMessage } from "../updaters/websocket-updater-hooks"
/**
 * Example: a hook returning a set of "action" methods to update global state
 * with partial messages. Minimizes re-render if each sub-key is in its own query.
 */
export function useGlobalStateActions() {
    const { manager, isOpen } = useSendWebSocketMessage()
    const queryClient = useQueryClient()

    function updateProjectTabPartial(tabId: string, partial: Partial<ProjectTabState>) {
        if (!isOpen) {
            console.warn("Socket not open, ignoring update.")
            return
        }

        // Immediately update React Query cache (optimistic)
        queryClient.setQueryData<ProjectTabState>(["globalState", "projectTab", tabId], (prev) => {
            if (!prev) return prev;
            return { ...prev, ...partial } as ProjectTabState;
        })

        // Then inform the server
        const message: OutboundMessage = {
            type: "update_project_tab_partial",
            tabId,
            partial,
        }
        manager.sendMessage(message)
    }

    return {
        updateProjectTabPartial,
    }
}