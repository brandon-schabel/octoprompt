import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GlobalState } from 'shared/src/global-state/global-state-schema'
import { createInitialGlobalState } from 'shared'

export function useGlobalState() {
    const queryClient = useQueryClient()

    return useQuery<GlobalState>({
        queryKey: ["globalState"],
        // If you don't actually fetch from an API, you can supply a dummy queryFn
        // or just do a no-op fetch that returns something. For example:
        queryFn: async () => {
            // Possibly return an initial "empty" shape, or throw if you rely on
            // the WebSocket to populate this data. Example:
            return createInitialGlobalState()
        },
        // If you DO fetch the initial full global state from an API endpoint, do it here
        // and let the WebSocket keep it in sync once connected.
        staleTime: Infinity, // so it won't re-fetch automatically
        enabled: false,      // if you only want WS updates to drive the data
        initialData: () => {
            // Return whatever is in the cache so we get an immediate synchronous read
            return queryClient.getQueryData<GlobalState>(["globalState"]) ?? createInitialGlobalState()
        }
    })
}