import { motion, MotionProps } from 'framer-motion'
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'

interface CTAButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps>, MotionProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gradient' | 'glow'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  loading?: boolean
  href?: string
  target?: string
}

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
      children,
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
      lg: 'h-12 px-8 text-lg gap-3',
      xl: 'h-14 px-10 text-xl gap-3'
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

    // If href is provided, render as a Link
    if (href) {
      const isExternal = href.startsWith('http') || target === '_blank'

      if (isExternal) {
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

      return (
        <Link to={href} className={cn(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className)}>
          <motion.span className='inline-flex items-center justify-center w-full h-full' {...motionProps}>
            {content}
          </motion.span>
        </Link>
      )
    }

    // Otherwise, render as a button
    return (
      <motion.button
        ref={ref}
        {...motionProps}
        className={cn(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {content}
      </motion.button>
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
  ({ className, size = 'md', href, target, children, icon: Icon, iconPosition = 'left', ...props }, ref) => {
    const classes = cn(
      'relative inline-flex items-center justify-center font-medium rounded-lg',
      'bg-background text-foreground',
      'before:absolute before:inset-0 before:rounded-lg before:p-[2px]',
      'before:bg-gradient-to-r before:from-primary before:via-secondary before:to-accent',
      'before:-z-10',
      size === 'sm' && 'h-9 px-3 text-sm gap-2',
      size === 'md' && 'h-11 px-6 text-base gap-2',
      size === 'lg' && 'h-12 px-8 text-lg gap-3',
      size === 'xl' && 'h-14 px-10 text-xl gap-3',
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

    if (href) {
      const isExternal = href.startsWith('http') || target === '_blank'

      if (isExternal) {
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

      return (
        <Link to={href} className={classes}>
          <motion.span className='relative w-full h-full inline-flex items-center justify-center' {...motionProps}>
            {content}
          </motion.span>
        </Link>
      )
    }

    return (
      <motion.button ref={ref} className={classes} {...motionProps} {...props}>
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
