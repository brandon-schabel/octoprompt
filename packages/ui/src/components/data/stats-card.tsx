import React from 'react'
import { cn } from '../../utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../core/card'
import { Badge } from '../core/badge'
import { Progress } from './progress'
import { Button } from '../core/button'
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface StatItem {
  label: string
  value: string | number | React.ReactNode
  icon?: LucideIcon
  color?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string | number
  description?: string
  badge?: string | React.ReactNode
  onClick?: () => void
}

export interface StatsCardProps {
  title: string
  subtitle?: string
  description?: string
  stats: StatItem[] | StatItem[][]
  progress?: {
    value: number
    label?: string
    color?: string
  }
  actions?: React.ReactNode
  badge?: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  variant?: 'default' | 'compact' | 'detailed'
  layout?: 'grid' | 'list' | 'mixed'
  className?: string
  onClick?: () => void
  selected?: boolean
}

function getTrendIcon(trend?: 'up' | 'down' | 'neutral') {
  switch (trend) {
    case 'up':
      return TrendingUp
    case 'down':
      return TrendingDown
    case 'neutral':
      return Minus
    default:
      return null
  }
}

function getTrendColor(trend?: 'up' | 'down' | 'neutral') {
  switch (trend) {
    case 'up':
      return 'text-green-600'
    case 'down':
      return 'text-red-600'
    case 'neutral':
      return 'text-muted-foreground'
    default:
      return ''
  }
}

function renderStatItem(item: StatItem, variant: StatsCardProps['variant'] = 'default') {
  const Icon = item.icon
  const TrendIcon = getTrendIcon(item.trend)
  const trendColor = getTrendColor(item.trend)

  if (variant === 'compact') {
    return (
      <div
        key={item.label}
        className={cn(
          'flex items-center justify-between py-1',
          item.onClick && 'cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded'
        )}
        onClick={item.onClick}
      >
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          {Icon && <Icon className='h-3 w-3' />}
          <span>{item.label}</span>
        </div>
        <div className='flex items-center gap-1'>
          <span className={cn('font-medium text-sm', item.color)}>
            {item.value}
          </span>
          {item.badge && (
            typeof item.badge === 'string' ? (
              <Badge variant='secondary' className='text-xs px-1 py-0 h-4'>
                {item.badge}
              </Badge>
            ) : (
              item.badge
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      key={item.label}
      className={cn(
        'space-y-1',
        item.onClick && 'cursor-pointer hover:bg-muted/50 -m-2 p-2 rounded transition-colors'
      )}
      onClick={item.onClick}
    >
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        {Icon && <Icon className={cn('h-3 w-3', item.color)} />}
        <span>{item.label}</span>
        {item.badge && (
          <div className='ml-auto'>
            {typeof item.badge === 'string' ? (
              <Badge variant='secondary' className='text-xs px-1.5 py-0'>
                {item.badge}
              </Badge>
            ) : (
              item.badge
            )}
          </div>
        )}
      </div>
      <div className='flex items-baseline gap-2'>
        <p className={cn(
          variant === 'detailed' ? 'text-2xl font-semibold' : 'text-xl font-semibold',
          item.color
        )}>
          {item.value}
        </p>
        {item.trend && (
          <div className={cn('flex items-center gap-1', trendColor)}>
            {TrendIcon && <TrendIcon className='h-3 w-3' />}
            {item.trendValue && (
              <span className='text-xs font-medium'>{item.trendValue}</span>
            )}
          </div>
        )}
      </div>
      {item.description && variant === 'detailed' && (
        <p className='text-xs text-muted-foreground'>{item.description}</p>
      )}
    </div>
  )
}

export const StatsCard = React.memo(function StatsCard({
  title,
  subtitle,
  description,
  stats,
  progress,
  actions,
  badge,
  header,
  footer,
  variant = 'default',
  layout = 'grid',
  className,
  onClick,
  selected
}: StatsCardProps) {
  const isGrid = Array.isArray(stats) && stats.length > 0 && !Array.isArray(stats[0])
  const statsArray = isGrid ? stats as StatItem[] : []
  const statsGroups = !isGrid && Array.isArray(stats) ? stats as StatItem[][] : []

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        selected && 'ring-2 ring-primary',
        className
      )}
      onClick={onClick}
    >
      {header || (
        <CardHeader className={variant === 'compact' ? 'pb-2' : 'pb-4'}>
          <div className='flex items-start justify-between'>
            <div className='space-y-1'>
              <CardTitle className={variant === 'compact' ? 'text-base' : 'text-lg'}>
                {title}
              </CardTitle>
              {subtitle && (
                <div className='text-sm text-muted-foreground'>{subtitle}</div>
              )}
              {description && (
                <CardDescription className='text-xs'>{description}</CardDescription>
              )}
            </div>
            {badge && (
              <div className='ml-2'>
                {typeof badge === 'string' ? (
                  <Badge>{badge}</Badge>
                ) : (
                  badge
                )}
              </div>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={variant === 'compact' ? 'pb-3' : 'pb-6'}>
        <div className='space-y-4'>
          {/* Progress bar */}
          {progress && (
            <div className='space-y-2'>
              {progress.label && (
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>{progress.label}</span>
                  <span className='font-medium'>{Math.round(progress.value)}%</span>
                </div>
              )}
              <Progress
                value={progress.value}
                className={cn('h-2', progress.color)}
              />
            </div>
          )}

          {/* Stats display */}
          {isGrid ? (
            <div className={cn(
              layout === 'list' 
                ? 'space-y-2'
                : layout === 'grid'
                ? `grid gap-4 ${statsArray.length === 2 ? 'grid-cols-2' : statsArray.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`
                : 'space-y-4'
            )}>
              {statsArray.map((item, index) => (
                <React.Fragment key={index}>
                  {renderStatItem(item, variant)}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className='space-y-4'>
              {statsGroups.map((group, groupIndex) => (
                <div
                  key={groupIndex}
                  className={cn(
                    'grid gap-4',
                    group.length === 2 ? 'grid-cols-2' : 
                    group.length === 3 ? 'grid-cols-3' : 
                    'grid-cols-2 sm:grid-cols-4'
                  )}
                >
                  {group.map((item, index) => (
                    <React.Fragment key={index}>
                      {renderStatItem(item, variant)}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {actions && (
            <div className='pt-2'>
              {actions}
            </div>
          )}
        </div>
      </CardContent>

      {footer && (
        <div className='px-6 py-3 border-t bg-muted/30'>
          {footer}
        </div>
      )}
    </Card>
  )
})

// Specialized variant for metric cards
export interface MetricCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  description?: string
  color?: string
  className?: string
  onClick?: () => void
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  description,
  color,
  className,
  onClick
}: MetricCardProps) {
  const TrendIcon = getTrendIcon(trend)
  const trendColor = getTrendColor(trend)

  return (
    <Card
      className={cn(
        'p-4 transition-all',
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <div className='flex items-start justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2'>
            {Icon && (
              <div className={cn('p-1.5 rounded-md bg-muted', color)}>
                <Icon className='h-4 w-4' />
              </div>
            )}
            <p className='text-sm text-muted-foreground'>{label}</p>
          </div>
          <p className={cn('text-2xl font-bold', color)}>{value}</p>
          {description && (
            <p className='text-xs text-muted-foreground'>{description}</p>
          )}
        </div>
        {trend && (
          <div className={cn('flex items-center gap-1', trendColor)}>
            {TrendIcon && <TrendIcon className='h-4 w-4' />}
            {trendValue && (
              <span className='text-sm font-medium'>{trendValue}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// Specialized variant for comparison stats
export interface ComparisonStatsProps {
  title: string
  current: {
    label: string
    value: string | number
  }
  previous: {
    label: string
    value: string | number
  }
  change?: {
    value: string | number
    trend: 'up' | 'down' | 'neutral'
  }
  className?: string
}

export function ComparisonStats({
  title,
  current,
  previous,
  change,
  className
}: ComparisonStatsProps) {
  const TrendIcon = change ? getTrendIcon(change.trend) : null
  const trendColor = change ? getTrendColor(change.trend) : ''

  return (
    <Card className={cn('p-4', className)}>
      <h4 className='text-sm font-medium mb-3'>{title}</h4>
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <p className='text-xs text-muted-foreground'>{current.label}</p>
          <p className='text-xl font-semibold'>{current.value}</p>
        </div>
        <div>
          <p className='text-xs text-muted-foreground'>{previous.label}</p>
          <p className='text-xl font-semibold text-muted-foreground'>
            {previous.value}
          </p>
        </div>
      </div>
      {change && (
        <div className={cn('flex items-center gap-1 mt-2', trendColor)}>
          {TrendIcon && <TrendIcon className='h-3 w-3' />}
          <span className='text-sm font-medium'>{change.value}</span>
        </div>
      )}
    </Card>
  )
}
