import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { formatDistanceToNow } from 'date-fns'
import { useLocalModelStatus, type LocalModelProvider } from '@/hooks/use-local-model-status'
import { cn } from '@/lib/utils'

// Default URLs for local model providers
const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234'

interface LocalModelStatusIndicatorProps {
  provider: LocalModelProvider
  url?: string
  className?: string
}

export function LocalModelStatusIndicator({ provider, url, className }: LocalModelStatusIndicatorProps) {
  const { isConnected, isChecking, error, lastChecked } = useLocalModelStatus(provider, {
    url,
    enabled: true, // Always enabled to test default URLs
    refetchInterval: 5000
  })

  const providerName = provider === 'ollama' ? 'Ollama' : 'LM Studio'
  const testedUrl = url || (provider === 'ollama' ? DEFAULT_OLLAMA_URL : DEFAULT_LMSTUDIO_URL)
  const isUsingDefault = !url

  // Determine the status dot style
  const dotClassName = cn('w-2 h-2 rounded-full', {
    'bg-green-500': isConnected && !isChecking,
    'bg-red-500': !isConnected && !isChecking,
    'bg-gray-400 animate-pulse': isChecking
  })

  // Determine tooltip content
  const getTooltipContent = () => {
    if (isChecking) {
      return `Checking ${providerName} connection...`
    }
    if (isConnected) {
      return (
        <div className='space-y-1'>
          <p className='font-medium'>Connected to {providerName}</p>
          <p className='text-xs text-muted-foreground'>
            {testedUrl} {isUsingDefault && '(default)'}
          </p>
          {lastChecked && (
            <p className='text-xs text-muted-foreground'>
              Checked {formatDistanceToNow(lastChecked, { addSuffix: true })}
            </p>
          )}
        </div>
      )
    }
    return (
      <div className='space-y-1'>
        <p className='font-medium'>Cannot connect to {providerName}</p>
        <p className='text-xs text-muted-foreground'>
          {testedUrl} {isUsingDefault && '(default)'}
        </p>
        {error && <p className='text-xs text-destructive'>{error}</p>}
        {lastChecked && (
          <p className='text-xs text-muted-foreground'>
            Checked {formatDistanceToNow(lastChecked, { addSuffix: true })}
          </p>
        )}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <div className={dotClassName} />
            <span className='text-xs text-muted-foreground'>
              {isChecking
                ? 'Checking...'
                : isConnected
                  ? isUsingDefault
                    ? 'Connected (default)'
                    : 'Connected'
                  : isUsingDefault
                    ? 'Disconnected (default)'
                    : 'Disconnected'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{getTooltipContent()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
