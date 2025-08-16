import React from 'react'
import { cn } from '../../utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../core/card'
import { Button } from '../core/button'
import { type LucideIcon } from 'lucide-react'

export interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  icon?: LucideIcon
  disabled?: boolean
  loading?: boolean
  loadingText?: string
}

export interface EmptyStateProps {
  icon?: LucideIcon
  iconClassName?: string
  title: string
  description?: string
  actions?: EmptyStateAction[] | React.ReactNode
  tip?: string
  variant?: 'simple' | 'card' | 'decorated' | 'minimal'
  className?: string
  children?: React.ReactNode
}

export const EmptyState = React.memo(function EmptyState({
  icon: Icon,
  iconClassName,
  title,
  description,
  actions,
  tip,
  variant = 'simple',
  className,
  children
}: EmptyStateProps) {
  const renderActions = () => {
    if (!actions) return null
    
    if (React.isValidElement(actions)) {
      return actions
    }
    
    if (Array.isArray(actions)) {
      return (
        <div className='flex flex-col sm:flex-row gap-2 justify-center'>
          {actions.map((action, index) => {
            const ActionIcon = action.icon
            return (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? 'default' : 'outline')}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                className='min-w-[120px]'
              >
                {action.loading ? (
                  <>
                    <span className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                    {action.loadingText || 'Loading...'}
                  </>
                ) : (
                  <>
                    {ActionIcon && <ActionIcon className='mr-2 h-4 w-4' />}
                    {action.label}
                  </>
                )}
              </Button>
            )
          })}
        </div>
      )
    }
    
    return null
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('text-center py-8 px-4', className)}>
        {Icon && (
          <Icon className={cn('mx-auto h-8 w-8 text-muted-foreground mb-3', iconClassName)} />
        )}
        <p className='text-sm text-muted-foreground'>{title}</p>
        {description && (
          <p className='text-xs text-muted-foreground mt-1'>{description}</p>
        )}
        {actions && <div className='mt-4'>{renderActions()}</div>}
        {children}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className='text-center pb-4'>
          {Icon && (
            <div className='flex justify-center mb-4'>
              <div className='p-3 rounded-full bg-muted'>
                <Icon className={cn('h-6 w-6 text-muted-foreground', iconClassName)} />
              </div>
            </div>
          )}
          <CardTitle className='text-xl'>{title}</CardTitle>
          {description && (
            <CardDescription className='mt-2 max-w-md mx-auto'>
              {description}
            </CardDescription>
          )}
        </CardHeader>
        {(actions || tip || children) && (
          <CardContent className='text-center pb-6'>
            {renderActions()}
            {tip && (
              <div className='mt-4 text-xs text-muted-foreground italic'>
                💡 {tip}
              </div>
            )}
            {children}
          </CardContent>
        )}
      </Card>
    )
  }

  if (variant === 'decorated') {
    return (
      <div className={cn(
        'relative flex flex-col items-center justify-center min-h-[400px] p-8 overflow-hidden',
        className
      )}>
        {/* Background decorations */}
        <div className='absolute inset-0 -z-10'>
          <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5' />
          <div className='absolute inset-0 bg-grid-white/[0.02] bg-[length:50px_50px]' />
          <div className='absolute right-0 top-0 -mt-20 -mr-20 h-[300px] w-[300px] rounded-full bg-primary/10 blur-[100px]' />
          <div className='absolute left-0 bottom-0 -mb-20 -ml-20 h-[300px] w-[300px] rounded-full bg-secondary/10 blur-[100px]' />
        </div>
        
        {/* Content */}
        <div className='relative z-10 text-center space-y-4 max-w-2xl'>
          {Icon && (
            <div className='flex justify-center mb-4'>
              <div className='relative'>
                <div className='absolute inset-0 bg-primary/20 blur-xl' />
                <div className='relative p-4 rounded-2xl bg-background border shadow-lg'>
                  <Icon className={cn('h-8 w-8 text-primary', iconClassName)} />
                </div>
              </div>
            </div>
          )}
          
          <h3 className='text-2xl font-bold tracking-tight'>{title}</h3>
          
          {description && (
            <p className='text-muted-foreground max-w-md mx-auto'>
              {description}
            </p>
          )}
          
          {renderActions()}
          
          {tip && (
            <div className='mt-6 text-sm text-muted-foreground italic'>
              💡 {tip}
            </div>
          )}
          
          {children}
        </div>
      </div>
    )
  }

  // Default 'simple' variant
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-12 px-4 space-y-4',
      'border rounded-lg bg-muted/20',
      className
    )}>
      {Icon && (
        <div className='text-muted-foreground'>
          <Icon className={cn('mx-auto h-12 w-12 opacity-50', iconClassName)} />
        </div>
      )}
      
      <div className='space-y-2'>
        <h3 className='text-lg font-semibold'>{title}</h3>
        {description && (
          <p className='text-sm text-muted-foreground max-w-md'>
            {description}
          </p>
        )}
      </div>
      
      {renderActions()}
      
      {tip && (
        <div className='mt-4 text-xs text-muted-foreground italic'>
          💡 {tip}
        </div>
      )}
      
      {children}
    </div>
  )
})

// Specialized variant for list empty states
export interface ListEmptyStateProps extends Omit<EmptyStateProps, 'variant'> {
  onAdd?: () => void
  addLabel?: string
}

export function ListEmptyState({
  onAdd,
  addLabel = 'Add Item',
  ...props
}: ListEmptyStateProps) {
  const actions = onAdd ? [{ label: addLabel, onClick: onAdd }] : props.actions
  
  return (
    <EmptyState
      {...props}
      actions={actions}
      variant='simple'
    />
  )
}

// Specialized variant for search/filter empty states
export interface SearchEmptyStateProps extends Omit<EmptyStateProps, 'variant' | 'title' | 'description'> {
  searchTerm?: string
  onClear?: () => void
}

export function SearchEmptyState({
  searchTerm,
  onClear,
  ...props
}: SearchEmptyStateProps) {
  return (
    <EmptyState
      {...props}
      title='No results found'
      description={searchTerm ? `No results found for "${searchTerm}"` : 'Try adjusting your filters'}
      actions={onClear ? [{ label: 'Clear filters', onClick: onClear, variant: 'outline' }] : props.actions}
      variant='minimal'
    />
  )
}

// Specialized variant for error empty states
export interface ErrorEmptyStateProps extends Omit<EmptyStateProps, 'variant'> {
  error?: Error | string
  onRetry?: () => void
}

export function ErrorEmptyState({
  error,
  onRetry,
  ...props
}: ErrorEmptyStateProps) {
  const errorMessage = error instanceof Error ? error.message : error
  
  return (
    <EmptyState
      {...props}
      title={props.title || 'Something went wrong'}
      description={errorMessage || props.description || 'An unexpected error occurred'}
      actions={onRetry ? [{ label: 'Try again', onClick: onRetry }] : props.actions}
      variant='simple'
      className={cn('border-destructive/50 bg-destructive/5', props.className)}
    />
  )
}
