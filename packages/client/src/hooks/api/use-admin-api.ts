import { useQuery } from '@tanstack/react-query';
import {
  getApiAdminEnvInfoOptions,
  getApiAdminSystemStatusOptions,
  getApiAdminEnvInfoQueryKey,
  getApiAdminSystemStatusQueryKey
} from '../generated/@tanstack/react-query.gen';
import type {
  GetApiAdminEnvInfoResponse,
  GetApiAdminSystemStatusResponse,
} from '../generated/types.gen';


// Re-export types for backward compatibility
export interface TableCount {
  count: number;
}

export interface DatabaseStats {
  chats: TableCount;
  chat_messages: TableCount;
  projects: TableCount;
  files: TableCount;
  prompts: TableCount;
  prompt_projects: TableCount;
  provider_keys: TableCount;
  tickets: TableCount;
  ticket_files: TableCount;
  ticket_tasks: TableCount;
  file_changes: TableCount;
}

export interface EnvInfo {
  environment: Record<string, string | undefined>;
  serverInfo: {
    version: string;
    bunVersion: string;
    platform: string;
    arch: string;
    memoryUsage: Record<string, number>;
    uptime: number;
  };
  databaseStats: DatabaseStats;
}

export interface SystemStatus {
  status: string;
  checks: {
    api: string;
    timestamp: string;
  };
}

// Admin query keys (can be kept for internal consistency or removed if unused elsewhere)
const ADMIN_KEYS = {
  all: ['admin'] as const,
  envInfo: () => ['admin', 'env-info'] as const, // These might differ from generated keys
  systemStatus: () => ['admin', 'system-status'] as const, // These might differ from generated keys
};

// Updated hooks using generated options
export const useGetEnvironmentInfo = () => {
  const queryOptions = getApiAdminEnvInfoOptions();
  return useQuery<
    GetApiAdminEnvInfoResponse, // TQueryFnData
    Error,                     // TError
    GetApiAdminEnvInfoResponse, // TData
    ReturnType<typeof getApiAdminEnvInfoQueryKey> // TQueryKey
  >({
    queryKey: queryOptions.queryKey, // Use generated key
    queryFn: queryOptions.queryFn,   // Use generated function
    // queryKey: ADMIN_KEYS.envInfo(), // Use consistent key for cache management - Use generated key instead
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export const useGetSystemStatus = () => {
  const queryOptions = getApiAdminSystemStatusOptions();
  return useQuery<
    GetApiAdminSystemStatusResponse,
    Error,
    GetApiAdminSystemStatusResponse,
    ReturnType<typeof getApiAdminSystemStatusQueryKey>
  >({
    queryKey: queryOptions.queryKey, // Use generated key
    queryFn: queryOptions.queryFn,   // Use generated function
    // queryKey: ADMIN_KEYS.systemStatus(), // Use consistent key for cache management - Use generated key instead
    refetchOnWindowFocus: false,
    retry: 1,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};