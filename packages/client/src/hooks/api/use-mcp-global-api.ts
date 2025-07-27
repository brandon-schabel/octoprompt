import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { promptlianoClient } from '../promptliano-client'

// Query Keys
const MCP_GLOBAL_KEYS = {
  all: ['mcpGlobal'] as const,
  config: () => [...MCP_GLOBAL_KEYS.all, 'config'] as const,
  installations: () => [...MCP_GLOBAL_KEYS.all, 'installations'] as const,
  status: () => [...MCP_GLOBAL_KEYS.all, 'status'] as const
}

// --- Query Hooks ---

export function useGetGlobalMCPConfig() {
  return useQuery({
    queryKey: MCP_GLOBAL_KEYS.config(),
    queryFn: () => promptlianoClient.mcpGlobalConfig.getGlobalConfig(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  })
}

export function useGetGlobalInstallations() {
  return useQuery({
    queryKey: MCP_GLOBAL_KEYS.installations(),
    queryFn: () => promptlianoClient.mcpGlobalConfig.getGlobalInstallations(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true
  })
}

export function useGetGlobalMCPStatus() {
  return useQuery({
    queryKey: MCP_GLOBAL_KEYS.status(),
    queryFn: () => promptlianoClient.mcpGlobalConfig.getGlobalStatus(),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true
  })
}

// --- Mutation Hooks ---

export function useUpdateGlobalMCPConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (updates: any) => promptlianoClient.mcpGlobalConfig.updateGlobalConfig(updates),
    onSuccess: (data) => {
      // Invalidate all MCP global queries
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.all })
      toast.success(data.data?.message || 'Global MCP config updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update global MCP config')
    }
  })
}

export function useInstallGlobalMCP() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { tool: string; serverName?: string; debug?: boolean }) =>
      promptlianoClient.mcpGlobalConfig.installGlobalMCP(data),
    onSuccess: (data) => {
      // Invalidate installations and status
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.installations() })
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.status() })
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.config() })
      toast.success(data.data?.message || 'MCP tool installed globally')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to install MCP tool globally')
    }
  })
}

export function useUninstallGlobalMCP() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { tool: string }) => promptlianoClient.mcpGlobalConfig.uninstallGlobalMCP(data),
    onSuccess: (data) => {
      // Invalidate installations and status
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.installations() })
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.status() })
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.config() })
      toast.success(data.data?.message || 'MCP tool uninstalled globally')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to uninstall MCP tool globally')
    }
  })
}

// --- Invalidation Utilities ---

export function useInvalidateGlobalMCP() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.all })
    },
    invalidateConfig: () => {
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.config() })
    },
    invalidateInstallations: () => {
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.installations() })
    },
    invalidateStatus: () => {
      queryClient.invalidateQueries({ queryKey: MCP_GLOBAL_KEYS.status() })
    },
    // Optimistic update for config
    setConfigOptimistically: (config: any) => {
      queryClient.setQueryData(MCP_GLOBAL_KEYS.config(), (old: any) => ({
        ...old,
        data: {
          ...old?.data,
          ...config
        }
      }))
    }
  }
}

// --- Composite Hooks ---

export function useGlobalMCPManager() {
  const { data: config, isLoading: configLoading } = useGetGlobalMCPConfig()
  const { data: installations, isLoading: installationsLoading } = useGetGlobalInstallations()
  const { data: status, isLoading: statusLoading } = useGetGlobalMCPStatus()

  const updateConfig = useUpdateGlobalMCPConfig()
  const install = useInstallGlobalMCP()
  const uninstall = useUninstallGlobalMCP()

  return {
    // Query states
    config: config?.data,
    installations: installations?.data || { installations: [], toolStatuses: [] },
    toolStatuses: installations?.data?.toolStatuses || [],
    status: status?.data,
    isLoading: configLoading || installationsLoading || statusLoading,

    // Mutations
    updateConfig: updateConfig.mutate,
    install: install.mutate,
    uninstall: uninstall.mutate,

    // Mutation states
    isUpdating: updateConfig.isPending,
    isInstalling: install.isPending,
    isUninstalling: uninstall.isPending,

    // Helper methods
    isToolInstalled: (tool: string) => {
      return installations?.data?.installations?.some((installation: any) => installation.tool === tool) ?? false
    },

    getInstallation: (tool: string) => {
      return installations?.data?.installations?.find((installation: any) => installation.tool === tool)
    }
  }
}

// Re-export types for convenience
export type GlobalMCPConfig = {
  servers?: Record<string, any>
  mcpServers?: Record<string, any>
  capabilities?: {
    sampling?: boolean
    [key: string]: any
  }
  cloudProvider?: string
  cloudProviderConfig?: any
  extends?: string | string[]
}

export type GlobalMCPInstallation = {
  tool: string
  version: string
  installedAt: string
  installedBy: string
  location: string
  config?: {
    serverName?: string
    settings?: Record<string, any>
  }
}

export type GlobalMCPStatus = {
  installed: boolean
  configPath?: string
  configExists?: boolean
  error?: string
}
