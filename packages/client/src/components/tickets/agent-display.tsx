import React, { useMemo } from 'react'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGetAgent } from '@/hooks/api/use-agents-api'
import { Skeleton } from '@promptliano/ui'

interface AgentDisplayProps {
  agentId: string | null | undefined
  projectId?: number
  className?: string
  showIcon?: boolean
  fallbackToId?: boolean
}

export function AgentDisplay({
  agentId,
  projectId,
  className,
  showIcon = true,
  fallbackToId = true
}: AgentDisplayProps) {
  // Only fetch if we have a valid agent ID
  const { data: agentResponse, isLoading } = useGetAgent(agentId || '', projectId)

  const agent = useMemo(() => {
    if (!agentResponse?.data) return null
    return agentResponse.data
  }, [agentResponse])

  // Display logic
  const displayText = useMemo(() => {
    if (!agentId) return 'No agent'
    if (isLoading) return 'Loading...'
    if (agent?.name) return agent.name
    if (fallbackToId) return agentId
    return 'Unknown agent'
  }, [agentId, isLoading, agent, fallbackToId])

  if (isLoading) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        {showIcon && <Bot className='h-3 w-3' />}
        <Skeleton className='h-3 w-16' />
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {showIcon && <Bot className='h-3 w-3' />}
      <span className='truncate max-w-[150px]'>{displayText}</span>
    </span>
  )
}
