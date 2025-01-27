import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query"
import { useCallback } from "react"

/**
 * Configuration object for `useGenericField` that tells it:
 *  - how to fetch the current record (for reading)
 *  - how to update the record (for writing)
 *  - the unique `queryKey` to use in react-query
 */
export interface UseGenericFieldOptions<T extends object, K extends keyof T> {
    /**
     * The unique react-query key segments.
     * Example: ["globalState", "chatTab", tabId]
     */
    queryKey: readonly unknown[]

    /**
     * Whether react-query should run (e.g., to skip or enable).
     * Defaults to `true` if omitted.
     */
    enabled?: boolean

    /**
     * The property name on T you want to read/write.
     */
    fieldKey: K

    /**
     * The full record object (e.g. a single ChatTabState) you want to read from.
     * If undefined, your hook will show `data = undefined`.
     */
    currentRecord: T | undefined | null

    /**
     * A function that updates the underlying record. It's the "partial update" function
     * you already have, e.g. `updateChatTabState(tabId, ...)`.
     * 
     * This is invoked with an updater function that receives the previous
     * record and returns a partial patch object (like `{ [fieldKey]: newValue }`).
     */
    onUpdate: (updater: (prev: T) => Partial<T>) => void

    /**
     * Optionally override or extend the react-query options (e.g. for staleTime, cacheTime).
     */
    queryOptions?: Omit<
        UseQueryOptions<T, unknown, T[K], readonly unknown[]>,
        "queryKey" | "select" | "enabled"
    >
}

/**
 * A single hook that returns both the current field value (via React Query)
 * and a `mutate` function for updating that field.
 *
 * @example
 * const { data, isLoading, mutate } = useGenericField({
 *   queryKey: ["globalState", "chatTab", tabId],
 *   fieldKey: "model",
 *   currentRecord: chatTabState,
 *   onUpdate: (upd) => updateChatTabState(tabId, upd),
 * })
 *
 * // data is type `ChatTabState["model"]`
 * // mutate(...) updates that single field.
 */
export function useGenericField<T extends object, K extends keyof T>(
    options: UseGenericFieldOptions<T, K>
) {
    const {
        queryKey,
        enabled = true,
        fieldKey,
        currentRecord,
        onUpdate,
        queryOptions,
    } = options

    // React Query for the "read" portion
    const queryResult: UseQueryResult<T[K], unknown> = useQuery<T, unknown, T[K]>({
        ...queryOptions,
        queryKey,
        enabled,
        // Pull out just the single field
        select: (fullObj) => fullObj[fieldKey],
        // We can store the record in a global store OR pass it in here. 
        // For demonstration, we treat "currentRecord" as the source-of-truth.
        // If you rely on React Query to fetch the entire object from an async call,
        // you'd typically implement the `queryFn` as well. Here, we short-circuit
        // the fetch and just rely on the "currentRecord" (override with initialData).
        // Another approach: define a `queryFn` that returns "fullObj" from your store.
        initialData: currentRecord ? () => currentRecord : undefined,
    })

    // The "write" portion
    const mutate = useCallback(
        (valueOrFn: T[K] | ((prevValue: T[K]) => T[K])) => {
            if (!currentRecord) return
            onUpdate((prev) => {
                const oldVal = prev[fieldKey]
                const newVal =
                    typeof valueOrFn === "function"
                        ? (valueOrFn as (prevVal: T[K]) => T[K])(oldVal)
                        : valueOrFn
                return { [fieldKey]: newVal } as Record<K, T[K]> as Partial<T>
            })
        },
        [currentRecord, fieldKey, onUpdate]
    )

    // Return read/write in one place
    return {
        ...queryResult,
        mutate,
    }
}