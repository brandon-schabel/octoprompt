// Recent changes:
// - Initial implementation of MCP status indicator component
// - Shows real-time connection status
// - Displays last activity time
// - Auto-refreshes every 30 seconds
// - Tooltips for detailed information

import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@promptliano/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { Loader2, WifiOff, Wifi } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { promptlianoClient } from '@/hooks/promptliano-client'

interface MCPStatusIndicatorProps {
  projectId: number
}

export function MCPStatusIndicator({ projectId }: MCPStatusIndicatorProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mcp-status', projectId],
    queryFn: async () => {
      const response = await promptlianoClient.projects.getMCPInstallationStatus(projectId)
      return response.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  })

  useEffect(() => {
    // Refetch when component mounts
    refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <Badge variant='secondary' className='gap-1'>
        <Loader2 className='h-3 w-3 animate-spin' />
        Checking MCP...
      </Badge>
    )
  }

  const connectionStatus = data?.connectionStatus
  const isConnected = connectionStatus?.connected || false
  const lastActivity = connectionStatus?.lastActivity

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={`gap-1 cursor-help ${isConnected ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {isConnected ? <Wifi className='h-3 w-3' /> : <WifiOff className='h-3 w-3' />}
            MCP {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className='space-y-1'>
            <p className='font-semibold'>MCP Status: {isConnected ? 'Connected' : 'Not Connected'}</p>
            {isConnected && connectionStatus?.sessionId && (
              <p className='text-xs text-muted-foreground'>Session: {connectionStatus.sessionId.slice(0, 8)}...</p>
            )}
            {isConnected && lastActivity && (
              <p className='text-xs text-muted-foreground'>
                Last active: {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
              </p>
            )}
            {!isConnected && (
              <p className='text-xs text-muted-foreground'>Install and restart your AI tool to connect</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
