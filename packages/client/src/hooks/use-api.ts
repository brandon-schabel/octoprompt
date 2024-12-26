import { useRouteContext } from '@tanstack/react-router'

export function useApi() {
    return useRouteContext({ from: "__root__" })
} 