import React, { useState, useMemo } from 'react'
import { Bot, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@promptliano/ui'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@promptliano/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@promptliano/ui'
import { useGetAllAgents } from '@/hooks/api/use-agents-api'
import { Skeleton } from '@promptliano/ui'

interface AgentSelectorPopoverProps {
  currentAgentId?: string | null
  onAgentSelect: (agentId: string | null) => void
  projectId: number
  triggerClassName?: string
  disabled?: boolean
  showNoAgent?: boolean
  triggerLabel?: string
  placeholder?: string
}

export function AgentSelectorPopover({
  currentAgentId,
  onAgentSelect,
  projectId,
  triggerClassName,
  disabled = false,
  showNoAgent = true,
  triggerLabel,
  placeholder = 'Select agent...'
}: AgentSelectorPopoverProps) {
  const [open, setOpen] = useState(false)
  const { data: agentsResponse, isLoading, error } = useGetAllAgents(projectId)

  // Extract agents from response
  const agents = useMemo(() => {
    if (!agentsResponse?.data) return []
    return Array.isArray(agentsResponse.data) ? agentsResponse.data : []
  }, [agentsResponse])

  // Find current agent details
  const currentAgent = useMemo(() => {
    if (!currentAgentId || !agents.length) return null
    return agents.find((agent: any) => agent.id === currentAgentId)
  }, [currentAgentId, agents])

  const handleSelect = (agentId: string | null) => {
    onAgentSelect(agentId)
    setOpen(false)
  }

  // Determine trigger display text
  const triggerText = useMemo(() => {
    if (triggerLabel) return triggerLabel
    if (currentAgent) return currentAgent.name || currentAgent.id
    if (currentAgentId && !isLoading) return currentAgentId // Fallback to ID if agent not found
    return placeholder
  }, [triggerLabel, currentAgent, currentAgentId, placeholder, isLoading])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant='ghost'
          size='sm'
          role='combobox'
          aria-expanded={open}
          aria-haspopup='listbox'
          aria-label='Select agent'
          className={cn(
            'h-auto py-0.5 px-1 text-xs justify-start gap-1 hover:bg-accent',
            !currentAgentId && 'text-muted-foreground',
            triggerClassName
          )}
          disabled={disabled}
        >
          <Bot className='h-3 w-3' />
          <span className='truncate max-w-[150px]'>{isLoading ? 'Loading...' : triggerText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[300px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='Search agents...' className='h-9' />
          <CommandList>
            {isLoading && (
              <div className='p-2 space-y-2'>
                <Skeleton className='h-8 w-full' />
                <Skeleton className='h-8 w-full' />
                <Skeleton className='h-8 w-full' />
              </div>
            )}

            {error && (
              <CommandEmpty>
                <div className='text-sm text-destructive p-2'>Failed to load agents</div>
              </CommandEmpty>
            )}

            {!isLoading && !error && agents.length === 0 && (
              <CommandEmpty>
                <div className='text-sm text-muted-foreground p-2'>No agents available</div>
              </CommandEmpty>
            )}

            {!isLoading && !error && agents.length > 0 && (
              <>
                {showNoAgent && (
                  <>
                    <CommandGroup>
                      <CommandItem value='no-agent' onSelect={() => handleSelect(null)} disabled={disabled}>
                        <X className='mr-2 h-4 w-4 text-muted-foreground' />
                        <span>No agent</span>
                        {currentAgentId === null && <Check className='ml-auto h-4 w-4' />}
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

                <CommandGroup heading='Available Agents'>
                  {agents.map((agent: any) => (
                    <CommandItem
                      key={agent.id}
                      value={agent.id}
                      onSelect={() => handleSelect(agent.id)}
                      disabled={disabled}
                      className='flex items-start gap-2'
                    >
                      <Bot className='mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0' />
                      <div className='flex-1 min-w-0'>
                        <div className='font-medium truncate'>{agent.name || agent.id}</div>
                        {agent.description && (
                          <div className='text-xs text-muted-foreground line-clamp-2'>{agent.description}</div>
                        )}
                      </div>
                      {currentAgentId === agent.id && <Check className='ml-2 h-4 w-4 flex-shrink-0' />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
