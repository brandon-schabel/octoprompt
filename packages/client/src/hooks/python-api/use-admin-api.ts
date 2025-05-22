import { useQuery } from '@tanstack/react-query'
import {
    getEnvInfoApiAdminEnvInfoGetOptions, // Updated name
    getSystemStatusApiAdminSystemStatusGetOptions, // Updated name
    getEnvInfoApiAdminEnvInfoGetQueryKey, // Updated name
    getSystemStatusApiAdminSystemStatusGetQueryKey // Updated name
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path is correct
import type { GetEnvInfoApiAdminEnvInfoGetData, GetSystemStatusApiAdminSystemStatusGetData } from '../../generated-python/types.gen' // Ensure path is correct for types

// Renaming GetEnvInfoApiAdminEnvInfoResponse to GetEnvInfoApiAdminEnvInfoGetData
// Renaming GetSystemStatusApiAdminSystemStatusResponse to GetSystemStatusApiAdminSystemStatusGetData
// Assuming the actual response type from the queryFn is the GetData type.
// If the Response type is different (e.g. { success: boolean, data: GetData }), this needs adjustment.
// Based on react-query.gen.ts, queryFn returns `data`, so `GetData` type is appropriate.

export interface TableCount {
    count: number
}

export interface DatabaseStats {
    chats: TableCount
    chat_messages: TableCount
    projects: TableCount
    files: TableCount
    prompts: TableCount
    prompt_projects: TableCount
    provider_keys: TableCount
    tickets: TableCount
    ticket_files: TableCount
    ticket_tasks: TableCount
    file_changes: TableCount
}

export interface EnvInfo { // This local interface might need to align with GetEnvInfoApiAdminEnvInfoGetData
    environment: Record<string, string | undefined>
    serverInfo: {
        version: string
        bunVersion: string
        platform: string
        arch: string
        memoryUsage: Record<string, number>
        uptime: number
    }
    databaseStats: DatabaseStats
}

export interface SystemStatus { // This local interface might need to align with GetSystemStatusApiAdminSystemStatusGetData
    status: string
    checks: {
        api: string
        timestamp: string
    }
}

export const useGetEnvironmentInfo = () => {
    const queryOptions = getEnvInfoApiAdminEnvInfoGetOptions() // Updated name
    return useQuery<
        GetEnvInfoApiAdminEnvInfoGetData, // Use generated type
        Error,
        GetEnvInfoApiAdminEnvInfoGetData, // Use generated type
        ReturnType<typeof getEnvInfoApiAdminEnvInfoGetQueryKey> // Updated name
    >({
        queryKey: queryOptions.queryKey,
        queryFn: queryOptions.queryFn,
        refetchOnWindowFocus: false,
        retry: 1
    })
}

export const useGetSystemStatus = () => {
    const queryOptions = getSystemStatusApiAdminSystemStatusGetOptions() // Updated name
    return useQuery<
        GetSystemStatusApiAdminSystemStatusGetData, // Use generated type
        Error,
        GetSystemStatusApiAdminSystemStatusGetData, // Use generated type
        ReturnType<typeof getSystemStatusApiAdminSystemStatusGetQueryKey> // Updated name
    >({
        queryKey: queryOptions.queryKey,
        queryFn: queryOptions.queryFn,
        refetchOnWindowFocus: false,
        retry: 1,
        refetchInterval: 30000
    })
}