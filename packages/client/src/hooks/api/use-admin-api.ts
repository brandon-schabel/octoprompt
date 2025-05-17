import { useQuery } from '@tanstack/react-query'
import {
  getApiAdminEnvInfoOptions,
  getApiAdminSystemStatusOptions,
  getApiAdminEnvInfoQueryKey,
  getApiAdminSystemStatusQueryKey
} from '../../generated/@tanstack/react-query.gen'
import type { GetApiAdminEnvInfoResponse, GetApiAdminSystemStatusResponse } from '../../generated/types.gen'

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

export interface EnvInfo {
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

export interface SystemStatus {
  status: string
  checks: {
    api: string
    timestamp: string
  }
}

export const useGetEnvironmentInfo = () => {
  const queryOptions = getApiAdminEnvInfoOptions()
  return useQuery<
    GetApiAdminEnvInfoResponse,
    Error,
    GetApiAdminEnvInfoResponse,
    ReturnType<typeof getApiAdminEnvInfoQueryKey>
  >({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    refetchOnWindowFocus: false,
    retry: 1
  })
}

export const useGetSystemStatus = () => {
  const queryOptions = getApiAdminSystemStatusOptions()
  return useQuery<
    GetApiAdminSystemStatusResponse,
    Error,
    GetApiAdminSystemStatusResponse,
    ReturnType<typeof getApiAdminSystemStatusQueryKey>
  >({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    refetchOnWindowFocus: false,
    retry: 1,
    refetchInterval: 30000
  })
}
