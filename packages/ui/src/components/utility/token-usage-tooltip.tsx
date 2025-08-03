import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../core/tooltip'
import { cn } from '../../utils'
import { Badge } from '../core/badge'
import { Zap, Database, MemoryStick, FileOutput } from 'lucide-react'

// Generic token usage type that can be extended by consumers
export interface TokenUsageData {
  input_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  output_tokens?: number
  totalInputTokens?: number
  totalCacheCreationTokens?: number
  totalCacheReadTokens?: number
  totalOutputTokens?: number
  totalTokens?: number
  service_tier?: string
}

interface TokenUsageTooltipProps {
  tokenUsage?: TokenUsageData
  children: React.ReactNode
  className?: string
  showTotal?: boolean
}

export function TokenUsageTooltip({ tokenUsage, children, className, showTotal = true }: TokenUsageTooltipProps) {
  if (!tokenUsage) return <>{children}</>

  // Handle both formats (message level and session level)
  const input =
    'input_tokens' in tokenUsage && tokenUsage.input_tokens !== undefined
      ? tokenUsage.input_tokens
      : 'totalInputTokens' in tokenUsage && tokenUsage.totalInputTokens !== undefined
        ? tokenUsage.totalInputTokens
        : undefined
  const cacheCreation =
    'cache_creation_input_tokens' in tokenUsage && tokenUsage.cache_creation_input_tokens !== undefined
      ? tokenUsage.cache_creation_input_tokens
      : 'totalCacheCreationTokens' in tokenUsage && tokenUsage.totalCacheCreationTokens !== undefined
        ? tokenUsage.totalCacheCreationTokens
        : undefined
  const cacheRead =
    'cache_read_input_tokens' in tokenUsage && tokenUsage.cache_read_input_tokens !== undefined
      ? tokenUsage.cache_read_input_tokens
      : 'totalCacheReadTokens' in tokenUsage && tokenUsage.totalCacheReadTokens !== undefined
        ? tokenUsage.totalCacheReadTokens
        : undefined
  const output =
    'output_tokens' in tokenUsage && tokenUsage.output_tokens !== undefined
      ? tokenUsage.output_tokens
      : 'totalOutputTokens' in tokenUsage && tokenUsage.totalOutputTokens !== undefined
        ? tokenUsage.totalOutputTokens
        : undefined
  const total =
    'totalTokens' in tokenUsage && tokenUsage.totalTokens !== undefined
      ? tokenUsage.totalTokens
      : (input || 0) + (cacheCreation || 0) + (cacheRead || 0) + (output || 0)

  const serviceTier = 'service_tier' in tokenUsage ? tokenUsage.service_tier : undefined

  const formatNumber = (num?: number) => {
    if (!num) return '0'
    return num.toLocaleString()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('cursor-help', className)}>{children}</span>
        </TooltipTrigger>
        <TooltipContent className='w-64 p-3'>
          <div className='space-y-2'>
            <div className='font-semibold text-sm mb-2'>Token Usage Breakdown</div>

            {/* Input Tokens */}
            {input !== undefined && input > 0 && (
              <div className='flex items-center justify-between text-xs'>
                <div className='flex items-center gap-2'>
                  <Zap className='h-3 w-3 text-blue-500' />
                  <span>Input</span>
                </div>
                <span className='font-mono'>{formatNumber(input)}</span>
              </div>
            )}

            {/* Cache Creation */}
            {cacheCreation !== undefined && cacheCreation > 0 && (
              <div className='flex items-center justify-between text-xs'>
                <div className='flex items-center gap-2'>
                  <Database className='h-3 w-3 text-green-500' />
                  <span>Cache Creation</span>
                </div>
                <span className='font-mono'>{formatNumber(cacheCreation)}</span>
              </div>
            )}

            {/* Cache Read */}
            {cacheRead !== undefined && cacheRead > 0 && (
              <div className='flex items-center justify-between text-xs'>
                <div className='flex items-center gap-2'>
                  <MemoryStick className='h-3 w-3 text-purple-500' />
                  <span>Cache Read</span>
                </div>
                <span className='font-mono'>{formatNumber(cacheRead)}</span>
              </div>
            )}

            {/* Output Tokens */}
            {output !== undefined && output > 0 && (
              <div className='flex items-center justify-between text-xs'>
                <div className='flex items-center gap-2'>
                  <FileOutput className='h-3 w-3 text-orange-500' />
                  <span>Output</span>
                </div>
                <span className='font-mono'>{formatNumber(output)}</span>
              </div>
            )}

            {/* Total */}
            {showTotal && total > 0 && (
              <>
                <div className='border-t pt-2 mt-2' />
                <div className='flex items-center justify-between text-xs font-semibold'>
                  <span>Total</span>
                  <span className='font-mono'>{formatNumber(total)}</span>
                </div>
              </>
            )}

            {/* Service Tier */}
            {serviceTier && (
              <>
                <div className='border-t pt-2 mt-2' />
                <div className='flex items-center justify-between text-xs'>
                  <span>Service Tier</span>
                  <Badge variant='secondary' className='text-xs py-0 px-1'>
                    {serviceTier}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Convenience component for inline token display with tooltip
export function TokenBadge({ tokenUsage, className }: Omit<TokenUsageTooltipProps, 'children'>) {
  if (!tokenUsage) return null

  const total =
    'totalTokens' in tokenUsage && tokenUsage.totalTokens !== undefined
      ? tokenUsage.totalTokens
      : 'input_tokens' in tokenUsage
        ? (tokenUsage.input_tokens || 0) +
          (tokenUsage.cache_creation_input_tokens || 0) +
          (tokenUsage.cache_read_input_tokens || 0) +
          (tokenUsage.output_tokens || 0)
        : 0

  if (total === 0) return null

  return (
    <TokenUsageTooltip tokenUsage={tokenUsage}>
      <Badge variant='outline' className={cn('text-xs', className)}>
        {total.toLocaleString()} tokens
      </Badge>
    </TokenUsageTooltip>
  )
}
