import React from 'react'
import { cn } from '../../utils'
import { Skeleton } from '../data/skeleton'
import { Loader2, RefreshCw, Clock, Sparkles } from 'lucide-react'

export type LoadingVariant = 'spinner' | 'skeleton' | 'dots' | 'overlay' | 'pulse' | 'shimmer'
export type LoadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface LoadingStateProps {
  variant?: LoadingVariant
  size?: LoadingSize
  text?: string
  description?: string
  fullscreen?: boolean
  centered?: boolean
  transparent?: boolean
  icon?: React.ReactNode
  showProgress?: boolean
  progress?: number
  className?: string
  textClassName?: string
  iconClassName?: string
}

const sizeClasses = {
  xs: {
    icon: 'h-3 w-3',
    text: 'text-xs',
    description: 'text-[10px]',
    dots: 'h-1 w-1',
    skeleton: 'h-16'
  },
  sm: {
    icon: 'h-4 w-4',
    text: 'text-sm',
    description: 'text-xs',
    dots: 'h-1.5 w-1.5',
    skeleton: 'h-24'
  },
  md: {
    icon: 'h-6 w-6',
    text: 'text-base',
    description: 'text-sm',
    dots: 'h-2 w-2',
    skeleton: 'h-32'
  },
  lg: {
    icon: 'h-8 w-8',
    text: 'text-lg',
    description: 'text-base',
    dots: 'h-2.5 w-2.5',
    skeleton: 'h-48'
  },
  xl: {
    icon: 'h-10 w-10',
    text: 'text-xl',
    description: 'text-lg',
    dots: 'h-3 w-3',
    skeleton: 'h-64'
  }
}

export function LoadingState({
  variant = 'spinner',
  size = 'md',
  text,
  description,
  fullscreen = false,
  centered = true,
  transparent = false,
  icon,
  showProgress = false,
  progress = 0,
  className,
  textClassName,
  iconClassName
}: LoadingStateProps) {
  const sizes = sizeClasses[size]

  const containerClasses = cn(
    'flex flex-col items-center justify-center gap-3',
    fullscreen && 'fixed inset-0 z-50',
    centered && !fullscreen && 'p-8',
    !transparent && fullscreen && 'bg-background/80 backdrop-blur-sm',
    className
  )

  const renderLoader = () => {
    switch (variant) {
      case 'spinner':
        return (
          <>
            {icon || (
              <Loader2 
                className={cn(
                  sizes.icon,
                  'animate-spin text-primary',
                  iconClassName
                )}
                aria-label="Loading"
                role="status"
              />
            )}
          </>
        )

      case 'dots':
        return (
          <div className='flex items-center gap-1' role='status' aria-label='Loading'>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  sizes.dots,
                  'rounded-full bg-primary animate-pulse',
                  iconClassName
                )}
                style={{
                  animationDelay: `${i * 150}ms`
                }}
              />
            ))}
          </div>
        )

      case 'skeleton':
        return (
          <div className='w-full max-w-md space-y-3'>
            <Skeleton className={cn('w-full', sizes.skeleton)} />
            <Skeleton className={cn('w-4/5', sizes.skeleton)} />
            <Skeleton className={cn('w-3/5', sizes.skeleton)} />
          </div>
        )

      case 'overlay':
        return (
          <div className='relative'>
            <div className='absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer' />
            {icon || (
              <RefreshCw 
                className={cn(
                  sizes.icon,
                  'animate-spin text-primary',
                  iconClassName
                )}
                aria-label="Loading"
                role="status"
              />
            )}
          </div>
        )

      case 'pulse':
        return (
          <div className='relative'>
            <div className='absolute inset-0 rounded-full bg-primary animate-ping opacity-75' />
            {icon || (
              <Clock 
                className={cn(
                  sizes.icon,
                  'relative text-primary',
                  iconClassName
                )}
                aria-label="Loading"
                role="status"
              />
            )}
          </div>
        )

      case 'shimmer':
        return (
          <div className='relative overflow-hidden rounded-lg p-4 bg-muted'>
            <div className='absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent' />
            {icon || (
              <Sparkles 
                className={cn(
                  sizes.icon,
                  'relative text-primary',
                  iconClassName
                )}
                aria-label="Loading"
                role="status"
              />
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={containerClasses}>
      {renderLoader()}

      {(text || description) && (
        <div className='text-center space-y-1'>
          {text && (
            <p className={cn(sizes.text, 'font-medium text-foreground', textClassName)}>
              {text}
            </p>
          )}
          {description && (
            <p className={cn(sizes.description, 'text-muted-foreground', textClassName)}>
              {description}
            </p>
          )}
        </div>
      )}

      {showProgress && progress > 0 && (
        <div className='w-full max-w-xs'>
          <div className='h-2 bg-muted rounded-full overflow-hidden'>
            <div
              className='h-full bg-primary transition-all duration-300 ease-out rounded-full'
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className='text-xs text-muted-foreground text-center mt-1'>
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  )
}

// Specialized loading states for common use cases
export interface ListLoadingProps {
  itemCount?: number
  className?: string
}

export function ListLoading({ itemCount = 3, className }: ListLoadingProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: itemCount }).map((_, i) => (
        <div key={i} className='flex items-center gap-3 p-3 rounded-lg bg-muted/50'>
          <Skeleton className='h-10 w-10 rounded-full' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </div>
      ))}
    </div>
  )
}

export interface TableLoadingProps {
  columns?: number
  rows?: number
  className?: string
}

export function TableLoading({ columns = 4, rows = 5, className }: TableLoadingProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className='border rounded-lg'>
        {/* Header */}
        <div className='border-b bg-muted/50 p-4'>
          <div className='grid gap-4' style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className='h-4' />
            ))}
          </div>
        </div>
        
        {/* Body */}
        <div className='divide-y'>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className='p-4'>
              <div className='grid gap-4' style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton key={colIndex} className='h-4' />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export interface CardLoadingProps {
  className?: string
}

export function CardLoading({ className }: CardLoadingProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6 space-y-4', className)}>
      <div className='flex items-start gap-4'>
        <Skeleton className='h-12 w-12 rounded-lg' />
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-5 w-2/3' />
          <Skeleton className='h-4 w-full' />
        </div>
      </div>
      <div className='space-y-2'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-4/5' />
        <Skeleton className='h-4 w-3/5' />
      </div>
      <div className='flex items-center gap-2'>
        <Skeleton className='h-9 w-24' />
        <Skeleton className='h-9 w-24' />
      </div>
    </div>
  )
}

export interface InlineLoadingProps {
  text?: string
  size?: LoadingSize
  className?: string
}

export function InlineLoading({ 
  text = 'Loading',
  size = 'sm',
  className 
}: InlineLoadingProps) {
  const sizes = sizeClasses[size]
  
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Loader2 className={cn(sizes.icon, 'animate-spin')} />
      {text && <span className={sizes.text}>{text}</span>}
    </span>
  )
}

// Button loading state component
export interface ButtonLoadingProps {
  loadingText?: string
  size?: LoadingSize
  className?: string
}

export function ButtonLoading({ 
  loadingText = 'Loading...',
  size = 'sm',
  className 
}: ButtonLoadingProps) {
  const sizes = sizeClasses[size]
  
  return (
    <>
      <Loader2 className={cn(sizes.icon, 'animate-spin mr-2', className)} />
      {loadingText}
    </>
  )
}

// Page loading component for route transitions
export interface PageLoadingProps {
  title?: string
  className?: string
}

export function PageLoading({ 
  title = 'Loading page...',
  className 
}: PageLoadingProps) {
  return (
    <LoadingState
      variant='spinner'
      size='lg'
      text={title}
      centered
      className={cn('min-h-[400px]', className)}
    />
  )
}

