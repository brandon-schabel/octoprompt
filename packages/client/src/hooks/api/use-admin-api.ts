/**
 * Admin API Hooks
 * This file contains React Query hooks for admin-related API endpoints including:
 * - Environment information retrieval
 * - System status checks
 * - Other admin-related operations
 * 
 * Most recent changes:
 * - Initial implementation with useGetEnvironmentInfo and useGetSystemStatus hooks
 * - Updated EnvInfo interface to support Bun version and database statistics
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';

// Database table count type
export interface TableCount {
  count: number;
}

// Database statistics type
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

// Types for our admin data
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

// API functions
async function getEnvironmentInfo(api: ReturnType<typeof useApi>['api']): Promise<EnvInfo> {
  const response = await api.request('/api/admin/env-info', {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch environment info: ${response.statusText}`);
  }

  return response.json();
}

async function getSystemStatus(api: ReturnType<typeof useApi>['api']): Promise<SystemStatus> {
  const response = await api.request('/api/admin/system-status', {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch system status: ${response.statusText}`);
  }

  return response.json();
}

// Hooks
export const useGetEnvironmentInfo = () => {
  const { api } = useApi();
  
  return useQuery({
    queryKey: ['admin', 'env-info'],
    queryFn: () => getEnvironmentInfo(api),
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export const useGetSystemStatus = () => {
  const { api } = useApi();
  
  return useQuery({
    queryKey: ['admin', 'system-status'],
    queryFn: () => getSystemStatus(api),
    refetchOnWindowFocus: false,
    retry: 1,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

// For future additional admin operations
// Could add mutations for actions like clearing logs, restarting services, etc. 