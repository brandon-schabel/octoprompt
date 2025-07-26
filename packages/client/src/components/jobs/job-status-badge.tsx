import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Ban } from 'lucide-react'
import type { JobStatus } from '@octoprompt/schemas'
import { cn } from '@/lib/utils'

interface JobStatusBadgeProps {
  status: JobStatus
  className?: string
}

export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  const config = {
    pending: {
      variant: 'secondary' as const,
      icon: Loader2,
      label: 'Pending',
      animate: false
    },
    running: {
      variant: 'default' as const,
      icon: Loader2,
      label: 'Running',
      animate: true
    },
    completed: {
      variant: 'secondary' as const,
      icon: CheckCircle,
      label: 'Completed',
      animate: false,
      className: 'bg-green-100 text-green-800 border-green-200'
    },
    failed: {
      variant: 'destructive' as const,
      icon: XCircle,
      label: 'Failed',
      animate: false
    },
    cancelled: {
      variant: 'outline' as const,
      icon: Ban,
      label: 'Cancelled',
      animate: false
    }
  }

  const statusConfig = config[status]
  const { variant, icon: Icon, label, animate } = statusConfig
  const statusClassName = 'className' in statusConfig ? statusConfig.className : undefined

  return (
    <Badge variant={variant} className={cn('gap-1', statusClassName, className)}>
      <Icon className={cn('h-3 w-3', animate && 'animate-spin')} />
      {label}
    </Badge>
  )
}