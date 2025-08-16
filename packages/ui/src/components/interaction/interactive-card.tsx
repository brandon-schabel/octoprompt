import React, { useState } from 'react'
import { cn } from '../../utils'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../core/card'
import { Badge } from '../core/badge'
import { Button } from '../core/button'
import { 
  type LucideIcon,
  ChevronRight,
  MoreHorizontal,
  Star,
  StarOff,
  Pin,
  PinOff,
  Copy,
  Edit,
  Trash2,
  ExternalLink,
  Maximize2,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../core/dropdown-menu'

export type CardVariant = 'default' | 'outline' | 'ghost' | 'elevated' | 'glass'
export type CardSize = 'sm' | 'md' | 'lg'

export interface CardAction {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  disabled?: boolean
}

export interface CardMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

export interface InteractiveCardProps {
  title: string
  description?: string
  icon?: LucideIcon | React.ReactNode
  iconClassName?: string
  variant?: CardVariant
  size?: CardSize
  
  // Interactive states
  isClickable?: boolean
  isSelected?: boolean
  isDisabled?: boolean
  isFavorite?: boolean
  isPinned?: boolean
  isNew?: boolean
  
  // Actions
  onClick?: () => void
  onDoubleClick?: () => void
  onFavorite?: () => void
  onPin?: () => void
  primaryAction?: CardAction
  secondaryAction?: CardAction
  menuItems?: CardMenuItem[]
  
  // Content
  badges?: Array<{ label: string; variant?: 'default' | 'secondary' | 'outline' | 'destructive' }>
  metadata?: Array<{ label: string; value: string | number }>
  footer?: React.ReactNode
  children?: React.ReactNode
  
  // Styling
  className?: string
  headerClassName?: string
  contentClassName?: string
  footerClassName?: string
}

const sizeClasses = {
  sm: {
    card: 'p-3',
    header: 'p-3 pb-2',
    content: 'px-3 py-2',
    footer: 'px-3 py-2',
    icon: 'h-4 w-4',
    title: 'text-sm',
    description: 'text-xs'
  },
  md: {
    card: 'p-4',
    header: 'p-4 pb-3',
    content: 'px-4 py-3',
    footer: 'px-4 py-3',
    icon: 'h-5 w-5',
    title: 'text-base',
    description: 'text-sm'
  },
  lg: {
    card: 'p-6',
    header: 'p-6 pb-4',
    content: 'px-6 py-4',
    footer: 'px-6 py-4',
    icon: 'h-6 w-6',
    title: 'text-lg',
    description: 'text-base'
  }
}

const variantClasses = {
  default: 'bg-card',
  outline: 'bg-transparent border-2',
  ghost: 'bg-transparent border-0 shadow-none',
  elevated: 'bg-card shadow-lg hover:shadow-xl',
  glass: 'bg-card/50 backdrop-blur-sm border-white/10'
}

export function InteractiveCard({
  title,
  description,
  icon,
  iconClassName,
  variant = 'default',
  size = 'md',
  isClickable = false,
  isSelected = false,
  isDisabled = false,
  isFavorite = false,
  isPinned = false,
  isNew = false,
  onClick,
  onDoubleClick,
  onFavorite,
  onPin,
  primaryAction,
  secondaryAction,
  menuItems,
  badges,
  metadata,
  footer,
  children,
  className,
  headerClassName,
  contentClassName,
  footerClassName
}: InteractiveCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const sizes = sizeClasses[size]

  const handleClick = (e: React.MouseEvent) => {
    if (isDisabled || !onClick) return
    
    // Don't trigger if clicking on interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button, a, [role="button"]')) return
    
    onClick()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDisabled || !onClick) return
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  const renderIcon = () => {
    if (!icon) return null
    
    if (React.isValidElement(icon)) {
      return icon
    }
    
    const Icon = icon as LucideIcon
    return <Icon className={cn(sizes.icon, iconClassName)} />
  }

  return (
    <Card
      className={cn(
        variantClasses[variant],
        isClickable && !isDisabled && 'cursor-pointer transition-all hover:border-primary/50',
        isSelected && 'ring-2 ring-primary',
        isDisabled && 'opacity-50 pointer-events-none',
        variant === 'elevated' && !isDisabled && 'hover:-translate-y-0.5',
        className
      )}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={isClickable && !isDisabled ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
      aria-pressed={isSelected}
      aria-disabled={isDisabled}
    >
      <CardHeader className={cn(sizes.header, 'relative', headerClassName)}>
        {/* Status indicators */}
        <div className='absolute top-2 right-2 flex items-center gap-1'>
          {isNew && (
            <Badge variant='default' className='text-xs'>
              New
            </Badge>
          )}
          {isPinned && (
            <Button
              size='sm'
              variant='ghost'
              className='h-7 w-7 p-0'
              onClick={(e) => {
                e.stopPropagation()
                onPin?.()
              }}
            >
              <Pin className='h-3.5 w-3.5 text-primary' />
            </Button>
          )}
          {isFavorite && (
            <Button
              size='sm'
              variant='ghost'
              className='h-7 w-7 p-0'
              onClick={(e) => {
                e.stopPropagation()
                onFavorite?.()
              }}
            >
              <Star className='h-3.5 w-3.5 text-yellow-500 fill-yellow-500' />
            </Button>
          )}
          {menuItems && menuItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 w-7 p-0'
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {menuItems.map((item, index) => {
                  const ItemIcon = item.icon
                  return (
                    <React.Fragment key={index}>
                      {index > 0 && item.variant === 'destructive' && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          item.onClick()
                        }}
                        disabled={item.disabled}
                        className={item.variant === 'destructive' ? 'text-destructive' : ''}
                      >
                        {ItemIcon && <ItemIcon className='h-4 w-4 mr-2' />}
                        {item.label}
                      </DropdownMenuItem>
                    </React.Fragment>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className='flex items-start gap-3'>
          {renderIcon()}
          <div className='flex-1 min-w-0'>
            <CardTitle className={cn(sizes.title, 'line-clamp-2')}>
              {title}
            </CardTitle>
            {description && (
              <CardDescription className={cn(sizes.description, 'mt-1 line-clamp-2')}>
                {description}
              </CardDescription>
            )}
            {badges && badges.length > 0 && (
              <div className='flex flex-wrap gap-1.5 mt-2'>
                {badges.map((badge, index) => (
                  <Badge key={index} variant={badge.variant || 'secondary'} className='text-xs'>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {(children || metadata) && (
        <CardContent className={cn(sizes.content, contentClassName)}>
          {metadata && metadata.length > 0 && (
            <div className='grid grid-cols-2 gap-2 text-sm'>
              {metadata.map((item, index) => (
                <div key={index} className='flex justify-between'>
                  <span className='text-muted-foreground'>{item.label}:</span>
                  <span className='font-medium'>{item.value}</span>
                </div>
              ))}
            </div>
          )}
          {children}
        </CardContent>
      )}

      {(footer || primaryAction || secondaryAction) && (
        <CardFooter className={cn(sizes.footer, 'flex items-center justify-between', footerClassName)}>
          {footer || <div />}
          {(primaryAction || secondaryAction) && (
            <div className='flex items-center gap-2'>
              {secondaryAction && (
                <Button
                  size='sm'
                  variant={secondaryAction.variant || 'outline'}
                  onClick={(e) => {
                    e.stopPropagation()
                    secondaryAction.onClick()
                  }}
                  disabled={secondaryAction.disabled}
                >
                  {secondaryAction.icon && <secondaryAction.icon className='h-4 w-4 mr-1' />}
                  {secondaryAction.label}
                </Button>
              )}
              {primaryAction && (
                <Button
                  size='sm'
                  variant={primaryAction.variant || 'default'}
                  onClick={(e) => {
                    e.stopPropagation()
                    primaryAction.onClick()
                  }}
                  disabled={primaryAction.disabled}
                >
                  {primaryAction.icon && <primaryAction.icon className='h-4 w-4 mr-1' />}
                  {primaryAction.label}
                </Button>
              )}
            </div>
          )}
        </CardFooter>
      )}

      {/* Hover indicator */}
      {isClickable && !isDisabled && isHovered && (
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute bottom-2 right-2'>
            <ChevronRight className='h-4 w-4 text-muted-foreground/50' />
          </div>
        </div>
      )}
    </Card>
  )
}

// Specialized card variants
export interface SelectableCardProps extends Omit<InteractiveCardProps, 'isClickable' | 'onClick'> {
  isSelected: boolean
  onSelect: (selected: boolean) => void
}

export function SelectableCard({
  isSelected,
  onSelect,
  ...props
}: SelectableCardProps) {
  return (
    <InteractiveCard
      {...props}
      isClickable
      isSelected={isSelected}
      onClick={() => onSelect(!isSelected)}
      className={cn(
        'relative',
        isSelected && 'ring-2 ring-primary',
        props.className
      )}
    />
  )
}

export interface ActionCardProps extends Omit<InteractiveCardProps, 'primaryAction'> {
  actionLabel: string
  actionIcon?: LucideIcon
  onAction: () => void
  actionVariant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

export function ActionCard({
  actionLabel,
  actionIcon,
  onAction,
  actionVariant = 'default',
  ...props
}: ActionCardProps) {
  return (
    <InteractiveCard
      {...props}
      primaryAction={{
        label: actionLabel,
        icon: actionIcon,
        onClick: onAction,
        variant: actionVariant
      }}
    />
  )
}

export interface StatusCardProps extends Omit<InteractiveCardProps, 'icon' | 'iconClassName'> {
  status: 'success' | 'warning' | 'error' | 'info'
  statusText?: string
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    className: 'text-green-500',
    badgeVariant: 'default' as const,
    text: 'Success'
  },
  warning: {
    icon: AlertCircle,
    className: 'text-yellow-500',
    badgeVariant: 'secondary' as const,
    text: 'Warning'
  },
  error: {
    icon: AlertCircle,
    className: 'text-red-500',
    badgeVariant: 'destructive' as const,
    text: 'Error'
  },
  info: {
    icon: Info,
    className: 'text-blue-500',
    badgeVariant: 'outline' as const,
    text: 'Info'
  }
}

export function StatusCard({
  status,
  statusText,
  badges = [],
  ...props
}: StatusCardProps) {
  const config = statusConfig[status]
  
  return (
    <InteractiveCard
      {...props}
      icon={config.icon}
      iconClassName={config.className}
      badges={[
        { label: statusText || config.text, variant: config.badgeVariant },
        ...badges
      ]}
    />
  )
}