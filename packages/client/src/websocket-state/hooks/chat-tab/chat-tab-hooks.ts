import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { ChatTabState } from "shared/index"
import { useChatTabById } from "../selectors/websocket-selectors"
import { useUpdateChatTabState } from "../updaters/websocket-updater-hooks"

/**
 * Subscribe to a **single** field within a given chat tab's data.
 * This uses React Query's `select` option so that if the *selected field*
 * is unchanged, your component will NOT re-render—even if other fields
 * in that tab changed.
 */
export function useChatTabField<K extends keyof ChatTabState>(
    tabId: string,
    key: K
) {
    return useQuery<ChatTabState, unknown, ChatTabState[K]>({
        queryKey: ["globalState", "chatTab", tabId],
        enabled: Boolean(tabId),
        // "select" runs on the entire ChatTabState but returns only the single field
        select: (fullTab) => fullTab?.[key],
    })
}


/**
 * Returns an "updater" object that allows you to mutate exactly one field
 * of the ChatTabState in a type-safe way.
 */
export function useChatTabFieldUpdater<K extends keyof ChatTabState>(
    tabId: string,
    key: K
) {
    const chatTab = useChatTabById(tabId)
    const updateChatTabState = useUpdateChatTabState()

    const mutate = useCallback(
        (
            valueOrFn:
                | ChatTabState[K]
                | ((prevValue: ChatTabState[K]) => ChatTabState[K])
        ) => {
            // Early return if the tab doesn't exist
            if (!chatTab) return

            updateChatTabState(tabId, (prevTab) => {
                const currentValue = prevTab[key]
                const newValue =
                    typeof valueOrFn === "function"
                        ? (valueOrFn as (prev: ChatTabState[K]) => ChatTabState[K])(
                            currentValue
                        )
                        : valueOrFn
                return { [key]: newValue }
            }, chatTab)
        },
        [chatTab, tabId, updateChatTabState]
    )

    return { mutate }
}