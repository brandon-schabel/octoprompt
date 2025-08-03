import * as React from 'react'
import { cn } from '../../utils'
import { cva, type VariantProps } from 'class-variance-authority'

const loadingDotsVariants = cva('inline-flex gap-1', {
  variants: {
    size: {
      sm: 'gap-0.5',
      md: 'gap-1',
      lg: 'gap-1.5'
    }
  },
  defaultVariants: {
    size: 'md'
  }
})

const dotVariants = cva('rounded-full bg-current animate-pulse', {
  variants: {
    size: {
      sm: 'h-1 w-1',
      md: 'h-2 w-2',
      lg: 'h-3 w-3'
    }
  },
  defaultVariants: {
    size: 'md'
  }
})

interface LoadingDotsProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof loadingDotsVariants> {
  count?: number
}

export function LoadingDots({ className, size, count = 3, ...props }: LoadingDotsProps) {
  return (
    <div className={cn(loadingDotsVariants({ size }), className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(dotVariants({ size }))}
          style={{
            animationDelay: `${i * 150}ms`,
            animationDuration: '1.5s'
          }}
        />
      ))}
    </div>
  )
}

const spinnerVariants = cva('animate-spin', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12'
    }
  },
  defaultVariants: {
    size: 'md'
  }
})

interface LoadingSpinnerProps extends React.SVGAttributes<SVGElement>, VariantProps<typeof spinnerVariants> {}

export function LoadingSpinner({ className, size, ...props }: LoadingSpinnerProps) {
  return (
    <svg
      className={cn(spinnerVariants({ size }), className)}
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      {...props}
    >
      <circle
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeDasharray='60'
        strokeDashoffset='20'
      />
    </svg>
  )
}

// Full page loading overlay
interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'spinner' | 'dots'
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function LoadingOverlay({ className, variant = 'spinner', size = 'lg', text, ...props }: LoadingOverlayProps) {
  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm', className)}
      {...props}
    >
      <div className='flex flex-col items-center gap-4'>
        {variant === 'spinner' ? <LoadingSpinner size={size} /> : <LoadingDots size={size} />}
        {text && <p className='text-sm text-muted-foreground'>{text}</p>}
      </div>
    </div>
  )
}

// Skeleton loader for content placeholders
const skeletonVariants = cva('animate-pulse rounded-md bg-muted', {
  variants: {
    variant: {
      default: '',
      text: 'h-4',
      title: 'h-8',
      avatar: 'rounded-full',
      card: 'h-32'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {}

export function LoadingSkeleton({ className, variant, ...props }: LoadingSkeletonProps) {
  return <div className={cn(skeletonVariants({ variant }), className)} {...props} />
}
