import React, { useState } from 'react'
import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  GlassCard,
  AnimateOnScroll,
  cn
} from '@promptliano/ui'
import {
  Check,
  Cloud,
  Monitor,
  Settings,
  Trash2,
  Zap,
  Shield,
  Clock,
  Activity,
  MoreVertical,
  Edit,
  Copy,
  ExternalLink,
  Loader2,
  Wifi,
  WifiOff,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Database
} from 'lucide-react'
import type { ProviderKey, ProviderHealthStatus } from '@promptliano/schemas'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface ProviderCardProps {
  provider: ProviderKey
  health?: ProviderHealthStatus
  meta?: {
    name: string
    isLocal?: boolean
    description?: string
    link?: string
    linkTitle?: string
  }
  onTest?: () => void
  onEdit?: () => void
  onDelete?: () => void
  isTesting?: boolean
  className?: string
}

export function ProviderCard({
  provider,
  health,
  meta,
  onTest,
  onEdit,
  onDelete,
  isTesting = false,
  className
}: ProviderCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isConnected = health?.status === 'healthy'
  const isLocal = meta?.isLocal

  const handleCopyKey = () => {
    navigator.clipboard.writeText(provider.key)
    toast.success('API key copied to clipboard')
  }

  const getStatusColor = () => {
    if (isTesting) return 'text-blue-500 bg-blue-500/10 border-blue-500/30'
    if (isConnected) return 'text-green-500 bg-green-500/10 border-green-500/30'
    if (health?.status === 'degraded') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
    if (health?.status === 'unhealthy') return 'text-red-500 bg-red-500/10 border-red-500/30'
    return 'text-gray-500 bg-gray-500/10 border-gray-500/30'
  }

  const getStatusIcon = () => {
    if (isTesting) return <Loader2 className='h-3 w-3 animate-spin' />
    if (isConnected) return <Wifi className='h-3 w-3' />
    if (health?.status === 'degraded') return <AlertCircle className='h-3 w-3' />
    if (health?.status === 'unhealthy') return <WifiOff className='h-3 w-3' />
    return <WifiOff className='h-3 w-3' />
  }

  const getStatusText = () => {
    if (isTesting) return 'Testing...'
    if (isConnected) return 'Connected'
    if (health?.status === 'degraded') return 'Degraded'
    if (health?.status === 'unhealthy') return 'Disconnected'
    if (health?.status === 'unknown') return 'Unknown'
    return 'Disconnected'
  }

  const getPerformanceScore = () => {
    if (!health?.responseTime) return null
    const time = health.responseTime
    if (time < 200) return { label: 'Excellent', color: 'text-green-500', value: 100 }
    if (time < 500) return { label: 'Good', color: 'text-blue-500', value: 80 }
    if (time < 1000) return { label: 'Fair', color: 'text-yellow-500', value: 60 }
    return { label: 'Slow', color: 'text-red-500', value: 40 }
  }

  const performance = getPerformanceScore()

  return (
    <AnimateOnScroll animation='fade-up' duration={0.3} className={className}>
      <GlassCard
        className={cn(
          'relative group transition-all duration-500',
          'hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1',
          'overflow-hidden',
          isConnected && 'border-green-500/20'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Animated Background Gradient */}
        <div
          className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
            'bg-gradient-to-br from-primary/5 via-transparent to-primary/5'
          )}
        />

        {/* Status Indicator */}
        <div className='absolute top-4 right-4 z-10'>
          <Badge className={cn('gap-1 transition-all', getStatusColor(), isConnected && 'animate-pulse')}>
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </div>

        {/* Pulse Animation for Connected Status */}
        {isConnected && (
          <div className='absolute top-4 right-4 z-0'>
            <div className='w-20 h-8 bg-green-500 rounded-full animate-ping opacity-20' />
          </div>
        )}

        <CardHeader className='relative'>
          <div className='flex items-start gap-3'>
            {/* Provider Icon */}
            <div
              className={cn(
                'p-3 rounded-xl transition-all duration-300',
                'bg-gradient-to-br shadow-lg',
                isHovered && 'rotate-3',
                isLocal
                  ? 'from-orange-500/20 to-amber-500/10 group-hover:from-orange-500/30 group-hover:to-amber-500/20'
                  : 'from-blue-500/20 to-cyan-500/10 group-hover:from-blue-500/30 group-hover:to-cyan-500/20'
              )}
            >
              {isLocal ? <Monitor className='h-5 w-5 text-orange-500' /> : <Cloud className='h-5 w-5 text-blue-500' />}
            </div>

            {/* Title and Description */}
            <div className='flex-1 min-w-0'>
              <CardTitle className='text-base flex items-center gap-2'>
                <span className='truncate'>{provider.name}</span>
                {provider.isDefault && (
                  <Badge variant='secondary' className='text-xs'>
                    Default
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className='text-xs mt-1 line-clamp-2'>
                {meta?.description || meta?.name || provider.provider}
              </CardDescription>
            </div>

            {/* More Options Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-8 w-8'>
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuItem onClick={onTest}>
                  <Zap className='h-4 w-4 mr-2' />
                  Test Connection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className='h-4 w-4 mr-2' />
                  Edit Provider
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyKey}>
                  <Copy className='h-4 w-4 mr-2' />
                  Copy API Key
                </DropdownMenuItem>
                {meta?.link && (
                  <DropdownMenuItem asChild>
                    <a href={meta.link} target='_blank' rel='noopener noreferrer'>
                      <ExternalLink className='h-4 w-4 mr-2' />
                      {meta.linkTitle || 'View Documentation'}
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className='text-red-500'>
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete Provider
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tags */}
          <div className='flex flex-wrap gap-2 mt-3'>
            {isLocal && (
              <Badge variant='outline' className='text-xs gap-1'>
                <Database className='h-3 w-3' />
                Local
              </Badge>
            )}
            {health?.modelCount && health.modelCount > 0 && (
              <Badge variant='outline' className='text-xs gap-1'>
                <Sparkles className='h-3 w-3' />
                {health.modelCount} models
              </Badge>
            )}
            {performance && isConnected && (
              <Badge variant='outline' className={cn('text-xs gap-1', performance.color)}>
                <TrendingUp className='h-3 w-3' />
                {performance.label}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className='space-y-4'>
          {/* Stats Grid */}
          {isConnected && (
            <div className='grid grid-cols-3 gap-2 animate-in fade-in duration-300'>
              <div className='p-2 rounded-lg bg-muted/50 backdrop-blur'>
                <p className='text-xs text-muted-foreground mb-1'>Models</p>
                <p className='text-sm font-bold'>{health?.modelCount || '--'}</p>
              </div>
              <div className='p-2 rounded-lg bg-muted/50 backdrop-blur'>
                <p className='text-xs text-muted-foreground mb-1'>Response</p>
                <p className='text-sm font-bold'>{health?.responseTime ? `${health.responseTime}ms` : '--'}</p>
              </div>
              <div className='p-2 rounded-lg bg-muted/50 backdrop-blur'>
                <p className='text-xs text-muted-foreground mb-1'>Status</p>
                <p className='text-sm font-bold text-green-500'>Active</p>
              </div>
            </div>
          )}

          {/* API Key Display */}
          <div className='space-y-1'>
            <p className='text-xs text-muted-foreground flex items-center gap-1'>
              <Shield className='h-3 w-3' />
              API Key
            </p>
            <div className='flex items-center gap-2'>
              <code className='text-xs bg-muted/50 px-2 py-1.5 rounded flex-1 truncate font-mono'>
                {provider.key.substring(0, 12)}
                {'•'.repeat(8)}
              </code>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-7 w-7' onClick={handleCopyKey}>
                      <Copy className='h-3 w-3' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy API Key</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Last Tested */}
          {health?.lastTested && (
            <div className='flex items-center justify-between text-xs'>
              <span className='text-muted-foreground flex items-center gap-1'>
                <Clock className='h-3 w-3' />
                Last tested
              </span>
              <span className='font-medium'>
                {formatDistanceToNow(new Date(health.lastTested), { addSuffix: true })}
              </span>
            </div>
          )}

          {/* Performance Indicator */}
          {performance && isConnected && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground flex items-center gap-1'>
                  <Activity className='h-3 w-3' />
                  Performance
                </span>
                <span className={cn('font-medium', performance.color)}>{performance.label}</span>
              </div>
              <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    performance.value >= 80 && 'bg-green-500',
                    performance.value >= 60 && performance.value < 80 && 'bg-blue-500',
                    performance.value >= 40 && performance.value < 60 && 'bg-yellow-500',
                    performance.value < 40 && 'bg-red-500'
                  )}
                  style={{ width: `${performance.value}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className='flex items-center justify-between gap-3 pt-2'>
            <Button
              size='sm'
              variant={isConnected ? 'outline' : 'default'}
              className='flex-1 gap-1.5 max-w-[60%]'
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className='h-3 w-3 animate-spin' />
                  Testing...
                </>
              ) : isConnected ? (
                <>
                  <Check className='h-3 w-3' />
                  Connected
                </>
              ) : (
                <>
                  <Zap className='h-3 w-3' />
                  Test
                </>
              )}
            </Button>
            <div className='flex gap-1.5 ml-auto'>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size='sm' variant='ghost' className='h-8 w-8 p-0' onClick={onEdit}>
                      <Settings className='h-3.5 w-3.5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit provider</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size='sm' variant='ghost' className='h-8 w-8 p-0' onClick={onDelete}>
                      <Trash2 className='h-3.5 w-3.5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete provider</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </GlassCard>
    </AnimateOnScroll>
  )
}
