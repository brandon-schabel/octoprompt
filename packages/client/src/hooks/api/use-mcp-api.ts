import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../octo-client'
import type { 
  CreateMCPServerConfigBody,
  UpdateMCPServerConfigBody,
  MCPToolExecutionRequest
} from '@octoprompt/schemas'

// Query key factory
const mcpKeys = {
  all: ['mcp'] as const,
  serverConfigs: (projectId: number) => [...mcpKeys.all, 'serverConfigs', projectId] as const,
  serverConfig: (projectId: number, configId: number) => [...mcpKeys.serverConfigs(projectId), configId] as const,
  serverState: (projectId: number, configId: number) => [...mcpKeys.all, 'serverState', projectId, configId] as const,
  tools: (projectId: number) => [...mcpKeys.all, 'tools', projectId] as const,
  resources: (projectId: number) => [...mcpKeys.all, 'resources', projectId] as const,
}

// Server Config Queries
export function useGetMCPServerConfigs(projectId: number) {
  return useQuery({
    queryKey: mcpKeys.serverConfigs(projectId),
    queryFn: () => apiClient.mcp.listServerConfigs(projectId),
    enabled: !!projectId
  })
}

export function useGetMCPServerConfig(projectId: number, configId: number) {
  return useQuery({
    queryKey: mcpKeys.serverConfig(projectId, configId),
    queryFn: () => apiClient.mcp.getServerConfig(projectId, configId),
    enabled: !!projectId && !!configId
  })
}

export function useGetMCPServerState(projectId: number, configId: number) {
  return useQuery({
    queryKey: mcpKeys.serverState(projectId, configId),
    queryFn: () => apiClient.mcp.getServerState(projectId, configId),
    enabled: !!projectId && !!configId,
    refetchInterval: 5000 // Poll every 5 seconds to keep state updated
  })
}

// Server Config Mutations
export function useCreateMCPServerConfig(projectId: number) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateMCPServerConfigBody) => 
      apiClient.mcp.createServerConfig(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.serverConfigs(projectId) })
    }
  })
}

export function useUpdateMCPServerConfig(projectId: number, configId: number) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: UpdateMCPServerConfigBody) => 
      apiClient.mcp.updateServerConfig(projectId, configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.serverConfig(projectId, configId) })
      queryClient.invalidateQueries({ queryKey: mcpKeys.serverConfigs(projectId) })
    }
  })
}

export function useDeleteMCPServerConfig(projectId: number) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (configId: number) => 
      apiClient.mcp.deleteServerConfig(projectId, configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.serverConfigs(projectId) })
    }
  })
}

// Server Management Mutations
export function useStartMCPServer(projectId: number) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (configId: number) => 
      apiClient.mcp.startServer(projectId, configId),
    onSuccess: (_, configId) => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.serverState(projectId, configId) })
      queryClient.invalidateQueries({ queryKey: mcpKeys.tools(projectId) })
      queryClient.invalidateQueries({ queryKey: mcpKeys.resources(projectId) })
    }
  })
}

export function useStopMCPServer(projectId: number) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (configId: number) => 
      apiClient.mcp.stopServer(projectId, configId),
    onSuccess: (_, configId) => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.serverState(projectId, configId) })
      queryClient.invalidateQueries({ queryKey: mcpKeys.tools(projectId) })
      queryClient.invalidateQueries({ queryKey: mcpKeys.resources(projectId) })
    }
  })
}

// Tool Queries and Mutations
export function useGetMCPTools(projectId: number) {
  return useQuery({
    queryKey: mcpKeys.tools(projectId),
    queryFn: () => apiClient.mcp.listTools(projectId),
    enabled: !!projectId
  })
}

export function useExecuteMCPTool(projectId: number) {
  return useMutation({
    mutationFn: (request: MCPToolExecutionRequest) => 
      apiClient.mcp.executeTool(projectId, request)
  })
}

// Resource Queries
export function useGetMCPResources(projectId: number) {
  return useQuery({
    queryKey: mcpKeys.resources(projectId),
    queryFn: () => apiClient.mcp.listResources(projectId),
    enabled: !!projectId
  })
}

export function useReadMCPResource(projectId: number) {
  return useMutation({
    mutationFn: ({ serverId, uri }: { serverId: number; uri: string }) => 
      apiClient.mcp.readResource(projectId, serverId, uri)
  })
}