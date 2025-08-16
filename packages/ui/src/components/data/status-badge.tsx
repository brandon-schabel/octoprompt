import React from 'react'
import { cn } from '../../utils'
import { Badge } from '../core/badge'
import { 
  type LucideIcon,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  PlayCircle,
  PauseCircle,
  Ban,
  CircleDot,
  ChevronRight,
  Archive
} from 'lucide-react'

export type StatusType = 'ticket' | 'task' | 'queue' | 'project' | 'git' | 'custom'

export interface StatusConfig {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  icon?: LucideIcon
  label?: string
  color?: string
  bgColor?: string
  borderColor?: string
  animate?: boolean
}

// Default status configurations for different types
const defaultStatusConfigs: Record<string, Record<string, StatusConfig>> = {
  ticket: {
    open: {
      variant: 'secondary',
      icon: CircleDot,
      label: 'Open',
      color: 'text-blue-700 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    in_progress: {
      variant: 'default',
      icon: Loader2,
      label: 'In Progress',
      color: 'text-yellow-700 dark:text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      animate: true
    },
    closed: {
      variant: 'secondary',
      icon: CheckCircle,
      label: 'Closed',
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    cancelled: {
      variant: 'outline',
      icon: Ban,
      label: 'Cancelled',
      color: 'text-gray-700 dark:text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-200 dark:border-gray-800'
    }
  },
  task: {
    pending: {
      variant: 'outline',
      icon: Clock,
      label: 'Pending',
      color: 'text-gray-700 dark:text-gray-400'
    },
    in_progress: {
      variant: 'default',
      icon: Loader2,
      label: 'In Progress',
      color: 'text-blue-700 dark:text-blue-400',
      animate: true
    },
    completed: {
      variant: 'secondary',
      icon: CheckCircle,
      label: 'Completed',
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    },
    failed: {
      variant: 'destructive',
      icon: XCircle,
      label: 'Failed'
    }
  },
  queue: {
    active: {
      variant: 'default',
      icon: PlayCircle,
      label: 'Active',
      color: 'text-green-700 dark:text-green-400'
    },
    paused: {
      variant: 'secondary',
      icon: PauseCircle,
      label: 'Paused',
      color: 'text-yellow-700 dark:text-yellow-400'
    },
    completed: {
      variant: 'secondary',
      icon: CheckCircle,
      label: 'Completed',
      color: 'text-green-700 dark:text-green-400'
    },
    archived: {
      variant: 'outline',
      icon: Archive,
      label: 'Archived',
      color: 'text-gray-700 dark:text-gray-400'
    }
  },
  project: {
    active: {
      variant: 'default',
      icon: CircleDot,
      label: 'Active',
      color: 'text-green-700 dark:text-green-400'
    },
    archived: {
      variant: 'outline',
      icon: Archive,
      label: 'Archived',
      color: 'text-gray-700 dark:text-gray-400'
    },
    maintenance: {
      variant: 'secondary',
      icon: AlertCircle,
      label: 'Maintenance',
      color: 'text-yellow-700 dark:text-yellow-400'
    }
  },
  git: {
    clean: {
      variant: 'secondary',
      icon: CheckCircle,
      label: 'Clean',
      color: 'text-green-700 dark:text-green-400'
    },
    modified: {
      variant: 'default',
      icon: CircleDot,
      label: 'Modified',
      color: 'text-yellow-700 dark:text-yellow-400'
    },
    ahead: {
      variant: 'default',
      icon: ChevronRight,
      label: 'Ahead',
      color: 'text-blue-700 dark:text-blue-400'
    },
    behind: {
      variant: 'secondary',
      icon: ChevronRight,
      label: 'Behind',
      color: 'text-orange-700 dark:text-orange-400'
    },
    diverged: {
      variant: 'destructive',
      icon: AlertCircle,
      label: 'Diverged'
    }
  }
}

export interface StatusBadgeProps {
  status: string
  type?: StatusType
  showIcon?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
  customConfig?: StatusConfig
  className?: string
  iconClassName?: string
  onClick?: () => void
}

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5'
}

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4'
}

export function StatusBadge({
  status,
  type = 'custom',
  showIcon = true,
  showLabel = true,
  size = 'md',
  animated,
  customConfig,
  className,
  iconClassName,
  onClick
}: StatusBadgeProps) {
  // Get the configuration for this status
  const typeConfigs = defaultStatusConfigs[type] || {}
  const defaultConfig = typeConfigs[status.toLowerCase().replace(/\s+/g, '_')] || {}
  const config = { ...defaultConfig, ...customConfig }

  // Extract configuration
  const {
    variant = 'secondary',
    icon: Icon,
    label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
    color,
    bgColor,
    borderColor,
    animate = false
  } = config

  const shouldAnimate = animated !== undefined ? animated : animate
  const isClickable = !!onClick

  return (
    <Badge
      variant={variant}
      className={cn(
        sizeClasses[size],
        color,
        bgColor,
        borderColor,
        isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      {showIcon && Icon && (
        <Icon 
          className={cn(
            iconSizeClasses[size],
            showLabel && 'mr-1',
            shouldAnimate && 'animate-spin',
            iconClassName
          )} 
        />
      )}
      {showLabel && label}
    </Badge>
  )
}

// Specialized component for priority badges
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

const priorityConfigs: Record<Priority, StatusConfig> = {
  low: {
    variant: 'secondary',
    icon: ChevronRight,
    label: 'Low',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  normal: {
    variant: 'secondary',
    icon: CircleDot,
    label: 'Normal',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  high: {
    variant: 'default',
    icon: AlertCircle,
    label: 'High',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  urgent: {
    variant: 'destructive',
    icon: AlertCircle,
    label: 'Urgent'
  }
}

export interface PriorityBadgeProps {
  priority: Priority
  showIcon?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
}

export const PriorityBadge = React.memo(function PriorityBadge({
  priority,
  showIcon = true,
  showLabel = true,
  size = 'md',
  className,
  onClick
}: PriorityBadgeProps) {
  return (
    <StatusBadge
      status={priority}
      type='custom'
      customConfig={priorityConfigs[priority]}
      showIcon={showIcon}
      showLabel={showLabel}
      size={size}
      className={className}
      onClick={onClick}
    />
  )
})

// Utility function to get status color
export function getStatusColor(status: string, type: StatusType = 'custom'): string {
  const typeConfigs = defaultStatusConfigs[type] || {}
  const config = typeConfigs[status.toLowerCase().replace(/\s+/g, '_')] || {}
  return config.color || 'text-muted-foreground'
}

// Utility function to get status background color
export function getStatusBgColor(status: string, type: StatusType = 'custom'): string {
  const typeConfigs = defaultStatusConfigs[type] || {}
  const config = typeConfigs[status.toLowerCase().replace(/\s+/g, '_')] || {}
  return config.bgColor || 'bg-muted'
}