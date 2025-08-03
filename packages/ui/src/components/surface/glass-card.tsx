import * as React from 'react'
import { cn } from '../../utils'
import { cva, type VariantProps } from 'class-variance-authority'

const glassCardVariants = cva('relative overflow-hidden rounded-lg transition-all duration-300', {
  variants: {
    variant: {
      default: 'bg-card/30 backdrop-blur-md',
      dark: 'bg-black/40 backdrop-blur-md',
      light: 'bg-white/30 backdrop-blur-md',
      colorful: 'bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 backdrop-blur-md'
    },
    blur: {
      none: 'backdrop-blur-none',
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg',
      xl: 'backdrop-blur-xl'
    },
    border: {
      true: 'border border-white/10',
      false: ''
    },
    glow: {
      true: 'shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30',
      false: ''
    }
  },
  defaultVariants: {
    variant: 'default',
    blur: 'md',
    border: true,
    glow: false
  }
})

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof glassCardVariants> {
  asChild?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, blur, border, glow, ...props }, ref) => {
    return <div ref={ref} className={cn(glassCardVariants({ variant, blur, border, glow }), className)} {...props} />
  }
)
GlassCard.displayName = 'GlassCard'

// GlassCardGradient - animated gradient background
interface GlassCardGradientProps extends React.HTMLAttributes<HTMLDivElement> {
  gradient?: string
  animate?: boolean
}

const GlassCardGradient = React.forwardRef<HTMLDivElement, GlassCardGradientProps>(
  ({ className, gradient, animate = true, children, ...props }, ref) => {
    const defaultGradient = 'from-primary/20 via-secondary/20 to-accent/20'

    return (
      <div ref={ref} className={cn('relative overflow-hidden rounded-lg', className)} {...props}>
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-br backdrop-blur-md',
            gradient || defaultGradient,
            animate && 'animate-gradient-shift'
          )}
        />
        <div className='relative z-10 bg-card/30 backdrop-blur-sm p-6'>{children}</div>
      </div>
    )
  }
)
GlassCardGradient.displayName = 'GlassCardGradient'

// FloatingGlass - floating glass effect with subtle animation
interface FloatingGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number
}

const FloatingGlass = React.forwardRef<HTMLDivElement, FloatingGlassProps>(
  ({ className, delay = 0, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-lg bg-card/20 backdrop-blur-lg border border-white/10',
          'animate-float shadow-xl hover:shadow-2xl transition-shadow duration-300',
          className
        )}
        style={{
          animationDelay: `${delay}s`
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
FloatingGlass.displayName = 'FloatingGlass'

// GlassPanel - simple glass panel for sections
const glassPanelVariants = cva('backdrop-blur-md rounded-lg p-6', {
  variants: {
    variant: {
      subtle: 'bg-background/5',
      medium: 'bg-background/10',
      strong: 'bg-background/20'
    },
    border: {
      true: 'border border-white/10',
      false: ''
    }
  },
  defaultVariants: {
    variant: 'medium',
    border: true
  }
})

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof glassPanelVariants> {}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant, border, ...props }, ref) => {
    return <div ref={ref} className={cn(glassPanelVariants({ variant, border }), className)} {...props} />
  }
)
GlassPanel.displayName = 'GlassPanel'

export { GlassCard, GlassCardGradient, FloatingGlass, GlassPanel, glassCardVariants }
