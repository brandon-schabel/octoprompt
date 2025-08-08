import { motion } from 'framer-motion'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils'
import type { LucideIcon } from 'lucide-react'
import { Button, buttonVariants } from '../core/button'

interface CTAButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gradient' | 'glow'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  loading?: boolean
  href?: string
  target?: string
  asChild?: boolean
}

/**
 * CTAButton extends the base Button component with:
 * - Framer Motion animations for hover and tap interactions
 * - Custom gradient and glow variants with special styling
 * - Support for xl size variant
 * - asChild prop for composition with router links
 * - Loading state with animated spinner
 * - Icon support with configurable position
 */
export const CTAButton = forwardRef<HTMLButtonElement, CTAButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      fullWidth = false,
      loading = false,
      disabled,
      href,
      target,
      asChild,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
      ghost: 'hover:bg-muted text-foreground',
      gradient: 'bg-gradient-to-r from-primary to-secondary text-white hover:shadow-xl',
      glow: 'bg-primary text-primary-foreground shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/60'
    }

    const sizes = {
      sm: 'h-9 px-3 text-sm gap-2',
      md: 'h-11 px-6 text-base gap-2',
      lg: 'h-12 px-10 text-lg gap-3',
      xl: 'h-14 px-12 text-xl gap-3'
    }

    const iconSizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-7 w-7'
    }

    const content = (
      <>
        {loading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className={cn('border-2 border-current border-t-transparent rounded-full', iconSizes[size])}
          />
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
            {children}
            {Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
          </>
        )}
      </>
    )

    const motionProps = {
      whileHover: { scale: disabled || loading ? 1 : 1.05 },
      whileTap: { scale: disabled || loading ? 1 : 0.95 },
      transition: { type: 'spring', stiffness: 400, damping: 17 }
    }

    // If href is provided and it's external, render as anchor
    if (href && (href.startsWith('http') || target === '_blank')) {
      return (
        <motion.a
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className={cn(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className)}
          {...motionProps}
        >
          {content}
        </motion.a>
      )
    }

    // Otherwise, render as a button with motion wrapper
    const variantMap = {
      primary: 'default',
      secondary: 'secondary',
      ghost: 'ghost',
      gradient: 'default',
      glow: 'default'
    } as const

    const buttonVariant = variantMap[variant]
    const buttonSize = size === 'md' ? 'default' : size

    return (
      <motion.div {...motionProps} className={cn(fullWidth && 'w-full', 'inline-block')}>
        <Button
          ref={ref}
          variant={buttonVariant}
          size={buttonSize}
          asChild={asChild}
          className={cn(
            variant === 'gradient' && 'bg-gradient-to-r from-primary to-secondary text-white hover:shadow-xl',
            variant === 'glow' && 'shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/60',
            fullWidth && 'w-full',
            className
          )}
          disabled={disabled || loading}
          {...props}
        >
          {asChild ? <>{children}</> : <>{content}</>}
        </Button>
      </motion.div>
    )
  }
)

CTAButton.displayName = 'CTAButton'

// Animated gradient button
export const CTAButtonAnimated = forwardRef<HTMLButtonElement, CTAButtonProps>(
  ({ className, size = 'md', children, ...props }, ref) => {
    return (
      <motion.div className='relative inline-block' whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        {/* Animated background */}
        <motion.div
          className='absolute inset-0 rounded-lg bg-gradient-to-r from-primary via-secondary to-accent opacity-75 blur-xl'
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
          }}
          transition={{
            duration: 3,
            ease: 'linear',
            repeat: Infinity
          }}
          style={{
            backgroundSize: '200% 200%'
          }}
        />

        {/* Button */}
        <CTAButton ref={ref} variant='gradient' size={size} className={cn('relative', className)} {...props}>
          {children}
        </CTAButton>
      </motion.div>
    )
  }
)

CTAButtonAnimated.displayName = 'CTAButtonAnimated'

// Outline button with animated border
export const CTAButtonOutline = forwardRef<HTMLButtonElement, CTAButtonProps>(
  ({ className, size = 'md', href, target, children, icon: Icon, iconPosition = 'left', asChild, ...props }, ref) => {
    const buttonSize = size === 'md' ? 'default' : size
    const classes = cn(
      buttonVariants({ variant: 'outline', size: buttonSize }),
      'relative bg-background text-foreground',
      'before:absolute before:inset-0 before:rounded-lg before:p-[2px]',
      'before:bg-gradient-to-r before:from-primary before:via-secondary before:to-accent',
      'before:-z-10',
      className
    )

    const motionProps = {
      whileHover: { scale: 1.05 },
      whileTap: { scale: 0.95 },
      transition: { type: 'spring', stiffness: 400, damping: 17 }
    }

    const iconSizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-7 w-7'
    }

    const content = (
      <>
        <motion.span
          className='absolute inset-0 rounded-lg bg-gradient-to-r from-primary via-secondary to-accent opacity-0 transition-opacity duration-300'
          whileHover={{ opacity: 0.1 }}
        />
        <span className='relative z-10 inline-flex items-center gap-2'>
          {Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
          {children as React.ReactNode}
          {Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
        </span>
      </>
    )

    if (href && (href.startsWith('http') || target === '_blank')) {
      return (
        <motion.a
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className={classes}
          {...motionProps}
        >
          {content}
        </motion.a>
      )
    }

    // Filter out conflicting props
    const { onDrag, onDragEnd, onDragStart, onAnimationStart, ...buttonProps } = props

    return (
      <motion.button ref={ref} className={classes} {...motionProps} {...buttonProps}>
        {content}
      </motion.button>
    )
  }
)

CTAButtonOutline.displayName = 'CTAButtonOutline'

// Button group component
interface CTAButtonGroupProps {
  children: React.ReactNode
  className?: string
  direction?: 'horizontal' | 'vertical'
}

export function CTAButtonGroup({ children, className, direction = 'horizontal' }: CTAButtonGroupProps) {
  return (
    <div className={cn('flex', direction === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-3', className)}>
      {children}
    </div>
  )
}
