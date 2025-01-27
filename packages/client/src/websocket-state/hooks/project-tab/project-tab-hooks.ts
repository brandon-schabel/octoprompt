import { useQuery, } from "@tanstack/react-query"
import { useCallback, } from "react"
import {
    type ProjectTabState,
} from "shared"
import { useUpdateProjectTabState } from "../updaters/websocket-updater-hooks"

/**
 * Subscribe to a **single** field within a given project tab's data.
 * This uses React Query's `select` option so that if the *selected field*
 * is unchanged, your component will NOT re-render—even if other fields
 * in that tab changed.
 */
export function useProjectTabField<K extends keyof ProjectTabState>(
    tabId: string,
    key: K
) {
    return useQuery<ProjectTabState, unknown, ProjectTabState[K]>({
        queryKey: ["globalState", "projectTab", tabId],
        enabled: Boolean(tabId),
        select: (fullTab) => fullTab?.[key],
    })
}

/**
 * Returns a small "updater" object that allows you to mutate
 * exactly one field of the ProjectTabState in a type-safe way.
 */
export function useProjectTabFieldUpdater<K extends keyof ProjectTabState>(
    tabId: string,
    key: K
) {
    // We can reuse the existing partial-update hook:
    const updateTab = useUpdateProjectTabState(tabId)

    const mutate = useCallback(
        (
            valueOrFn:
                | ProjectTabState[K]
                | ((prevValue: ProjectTabState[K]) => ProjectTabState[K])
        ) => {
            updateTab((prevTab) => {
                const currentFieldValue = prevTab[key]
                const newFieldValue =
                    typeof valueOrFn === "function"
                        ? (valueOrFn as (prev: ProjectTabState[K]) => ProjectTabState[K])(
                            currentFieldValue
                        )
                        : valueOrFn
                return { [key]: newFieldValue }
            })
        },
        [tabId, key, updateTab]
    )

    return { mutate }
}
