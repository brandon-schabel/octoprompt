import * as React from 'react'
import { cn } from '../../utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2, CheckCircle, XCircle, AlertCircle, WifiOff, Wifi } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../core/tooltip'

const statusIndicatorVariants = cva(
  'inline-flex items-center justify-center rounded-full',
  {
    variants: {
      variant: {
        default: 'bg-gray-500',
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500',
        loading: 'bg-blue-500'
      },
      size: {
        xs: 'h-1.5 w-1.5',
        sm: 'h-2 w-2',
        md: 'h-2.5 w-2.5',
        lg: 'h-3 w-3',
        xl: 'h-4 w-4'
      },
      pulse: {
        true: 'animate-pulse',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      pulse: false
    }
  }
)

const statusIconVariants = cva(
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        default: 'text-gray-500',
        success: 'text-green-500',
        error: 'text-red-500',
        warning: 'text-yellow-500',
        info: 'text-blue-500',
        loading: 'text-blue-500'
      },
      size: {
        xs: 'h-3 w-3',
        sm: 'h-3.5 w-3.5',
        md: 'h-4 w-4',
        lg: 'h-5 w-5',
        xl: 'h-6 w-6'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

export type StatusIndicatorStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'warning' | 'idle'

export interface StatusIndicatorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof statusIndicatorVariants> {
  /**
   * The status to display
   */
  status?: StatusIndicatorStatus
  /**
   * Whether to show an icon instead of a dot
   * @default false
   */
  showIcon?: boolean
  /**
   * Custom icon to display
   */
  icon?: React.ReactNode
  /**
   * Label text to display next to the indicator
   */
  label?: string
  /**
   * Tooltip text to show on hover
   */
  tooltip?: string
  /**
   * Whether to show a loading spinner
   * @default false for status === 'connecting'
   */
  showSpinner?: boolean
  /**
   * Additional details to show in tooltip
   */
  details?: string
  /**
   * Whether the indicator should pulse/animate
   */
  pulse?: boolean
}

const statusToVariant: Record<StatusIndicatorStatus, StatusIndicatorProps['variant']> = {
  connected: 'success',
  disconnected: 'error',
  connecting: 'loading',
  error: 'error',
  warning: 'warning',
  idle: 'default'
}

const statusToIcon: Record<StatusIndicatorStatus, React.ReactNode> = {
  connected: <CheckCircle />,
  disconnected: <XCircle />,
  connecting: <Loader2 className="animate-spin" />,
  error: <XCircle />,
  warning: <AlertCircle />,
  idle: <WifiOff />
}

const statusToLabel: Record<StatusIndicatorStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  error: 'Error',
  warning: 'Warning',
  idle: 'Idle'
}

export const StatusIndicator = React.forwardRef<HTMLDivElement, StatusIndicatorProps>(
  (
    {
      className,
      status = 'idle',
      variant,
      size = 'md',
      pulse,
      showIcon = false,
      icon,
      label,
      tooltip,
      showSpinner,
      details,
      ...props
    },
    ref
  ) => {
    const computedVariant = variant || statusToVariant[status]
    const shouldPulse = pulse !== undefined ? pulse : (status === 'connecting' || status === 'warning')
    const shouldShowSpinner = showSpinner !== undefined ? showSpinner : status === 'connecting'
    const displayLabel = label || statusToLabel[status]
    const displayIcon = icon || statusToIcon[status]

    const indicator = (
      <div
        ref={ref}
        className={cn('inline-flex items-center gap-2', className)}
        {...props}
      >
        {showIcon ? (
          shouldShowSpinner && status === 'connecting' ? (
            <Loader2 className={cn(statusIconVariants({ variant: computedVariant, size }), 'animate-spin')} />
          ) : (
            <div className={statusIconVariants({ variant: computedVariant, size })}>
              {displayIcon}
            </div>
          )
        ) : (
          <div className={cn(
            statusIndicatorVariants({ variant: computedVariant, size, pulse: shouldPulse }),
            shouldShowSpinner && status === 'connecting' && 'animate-spin rounded-full border-2 border-current border-t-transparent'
          )} />
        )}
        
        {displayLabel && (
          <span className={cn(
            'text-sm font-medium',
            computedVariant === 'success' && 'text-green-600 dark:text-green-400',
            computedVariant === 'error' && 'text-red-600 dark:text-red-400',
            computedVariant === 'warning' && 'text-yellow-600 dark:text-yellow-400',
            computedVariant === 'info' && 'text-blue-600 dark:text-blue-400',
            computedVariant === 'loading' && 'text-blue-600 dark:text-blue-400',
            computedVariant === 'default' && 'text-gray-600 dark:text-gray-400'
          )}>
            {displayLabel}
          </span>
        )}
      </div>
    )

    if (tooltip || details) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{indicator}</TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {tooltip && <p>{tooltip}</p>}
                {details && <p className="text-xs text-muted-foreground">{details}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return indicator
  }
)

StatusIndicator.displayName = 'StatusIndicator'

/**
 * Connection-specific status indicator
 */
export interface ConnectionStatusProps extends Omit<StatusIndicatorProps, 'status'> {
  /**
   * Whether the connection is active
   */
  isConnected: boolean
  /**
   * Whether the connection is in progress
   */
  isConnecting?: boolean
  /**
   * Error message if connection failed
   */
  error?: string
  /**
   * Connection URL or endpoint
   */
  endpoint?: string
  /**
   * Latency in milliseconds
   */
  latency?: number
}

export const ConnectionStatus = React.forwardRef<HTMLDivElement, ConnectionStatusProps>(
  (
    {
      isConnected,
      isConnecting = false,
      error,
      endpoint,
      latency,
      ...props
    },
    ref
  ) => {
    const status: StatusIndicatorStatus = isConnecting 
      ? 'connecting' 
      : isConnected 
        ? 'connected' 
        : error 
          ? 'error' 
          : 'disconnected'

    const details = React.useMemo(() => {
      const parts: string[] = []
      if (endpoint) parts.push(`Endpoint: ${endpoint}`)
      if (latency !== undefined) parts.push(`Latency: ${latency}ms`)
      if (error) parts.push(`Error: ${error}`)
      return parts.join(' • ')
    }, [endpoint, latency, error])

    return (
      <StatusIndicator
        ref={ref}
        status={status}
        details={details}
        showIcon
        {...props}
      />
    )
  }
)

ConnectionStatus.displayName = 'ConnectionStatus'