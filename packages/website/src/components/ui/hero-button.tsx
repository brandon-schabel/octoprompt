import { Link } from '@tanstack/react-router'
import { forwardRef } from 'react'
import { cn } from '@promptliano/ui'
import type { ComponentProps } from 'react'

interface HeroButtonProps extends ComponentProps<'button'> {
  href?: string
  target?: string
  variant?: 'primary' | 'outline'
  size?: 'md' | 'lg'
}

export const HeroButton = forwardRef<HTMLButtonElement, HeroButtonProps>(
  ({ href, target, variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    const sizeClasses = {
      md: 'h-11 px-6 text-base gap-2',
      lg: 'h-12 px-10 text-lg gap-3'
    }

    const variantClasses = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl',
      outline: 'border-2 border-primary bg-transparent text-foreground hover:bg-primary/10'
    }

    const classes = cn(
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      sizeClasses[size],
      variantClasses[variant],
      className
    )

    // External link
    if (href && (href.startsWith('http') || target === '_blank')) {
      return (
        <a
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className={classes}
        >
          {children}
        </a>
      )
    }

    // Internal link
    if (href) {
      return (
        <Link to={href} className={classes}>
          {children}
        </Link>
      )
    }

    // Regular button
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    )
  }
)

HeroButton.displayName = 'HeroButton'
