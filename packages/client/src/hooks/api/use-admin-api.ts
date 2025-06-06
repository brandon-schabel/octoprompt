import { useQuery } from '@tanstack/react-query'
import { octoClient } from '../api-hooks'

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

const ADMIN_KEYS = {
  all: ['admin'] as const,
  envInfo: () => [...ADMIN_KEYS.all, 'envInfo'] as const,
  systemStatus: () => [...ADMIN_KEYS.all, 'systemStatus'] as const,
}

export const useGetEnvironmentInfo = () => {
  return useQuery({
    queryKey: ADMIN_KEYS.envInfo(),
    queryFn: () => octoClient.admin.getEnvironmentInfo(),
    refetchOnWindowFocus: false,
    retry: 1
  })
}

export const useGetSystemStatus = () => {
  return useQuery({
    queryKey: ADMIN_KEYS.systemStatus(),
    queryFn: () => octoClient.admin.getSystemStatus(),
    refetchOnWindowFocus: false,
    retry: 1,
    refetchInterval: 30000
  })
}
