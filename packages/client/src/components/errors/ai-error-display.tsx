import { AlertCircle, AlertTriangle, Info, RefreshCw, Key, Clock, Zap } from 'lucide-react'
import { Button } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export type AIErrorType =
  | 'MISSING_API_KEY'
  | 'RATE_LIMIT'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'INVALID_MODEL'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN'

export interface AIErrorDisplayProps {
  error: {
    type: AIErrorType
    message: string
    details?: string
    provider?: string
    retryable?: boolean
  }
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

const errorConfig = {
  MISSING_API_KEY: {
    icon: Key,
    title: 'API Key Missing',
    variant: 'warning' as const,
    actionText: 'Add API Key'
  },
  RATE_LIMIT: {
    icon: Clock,
    title: 'Rate Limit Exceeded',
    variant: 'warning' as const,
    actionText: 'Try Again Later'
  },
  CONTEXT_LENGTH_EXCEEDED: {
    icon: AlertTriangle,
    title: 'Context Too Long',
    variant: 'error' as const,
    actionText: 'Reduce Message Length'
  },
  INVALID_MODEL: {
    icon: AlertCircle,
    title: 'Invalid Model',
    variant: 'error' as const,
    actionText: 'Choose Different Model'
  },
  NETWORK_ERROR: {
    icon: Zap,
    title: 'Network Error',
    variant: 'error' as const,
    actionText: 'Retry'
  },
  PROVIDER_ERROR: {
    icon: AlertCircle,
    title: 'Provider Error',
    variant: 'error' as const,
    actionText: 'Retry'
  },
  UNKNOWN: {
    icon: Info,
    title: 'Something Went Wrong',
    variant: 'error' as const,
    actionText: 'Retry'
  }
}

export function AIErrorDisplay({ error, onRetry, onDismiss, className }: AIErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false)
  const config = errorConfig[error.type]
  const Icon = config.icon

  const bgColor = {
    error: 'bg-destructive/10 border-destructive/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20'
  }[config.variant]

  const iconColor = {
    error: 'text-destructive',
    warning: 'text-yellow-600'
  }[config.variant]

  return (
    <div className={cn('rounded-lg border p-4', bgColor, className)}>
      <div className='flex items-start gap-3'>
        <Icon className={cn('w-5 h-5 mt-0.5', iconColor)} />
        <div className='flex-1 space-y-2'>
          <div>
            <h4 className='font-medium text-sm'>{config.title}</h4>
            {error.provider && <span className='text-xs text-muted-foreground'>Provider: {error.provider}</span>}
          </div>

          <p className='text-sm text-muted-foreground'>{error.message}</p>

          {error.details && (
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className='text-xs text-muted-foreground hover:text-foreground underline'
              >
                {showDetails ? 'Hide' : 'Show'} details
              </button>
              {showDetails && (
                <pre className='mt-2 text-xs bg-background/50 p-2 rounded overflow-x-auto'>{error.details}</pre>
              )}
            </>
          )}

          <div className='flex gap-2 pt-2'>
            {error.retryable !== false && onRetry && (
              <Button size='sm' variant='outline' onClick={onRetry} className='gap-2'>
                <RefreshCw className='w-3 h-3' />
                {config.actionText}
              </Button>
            )}
            {onDismiss && (
              <Button size='sm' variant='ghost' onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
