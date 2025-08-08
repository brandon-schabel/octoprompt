import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-10',
        xl: 'h-14 rounded-md px-12',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'] | 'gradient'

export type ButtonPropsFinal = Omit<ButtonProps, 'variant'> & {
  variant?: ButtonVariant
}

const Button = React.forwardRef<HTMLButtonElement, ButtonPropsFinal>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    if (variant === 'gradient') {
      return (
        <Comp
          ref={ref}
          {...props}
          className={cn(
            'relative inline-flex items-center justify-center p-0.5 rounded-md bg-gradient-to-r from-blue-500 to-purple-500 dark:from-blue-700 dark:to-purple-700 group transition-all duration-300',
            className
          )}
        >
          <span className='relative block px-4 py-2 bg-white dark:bg-gray-900 rounded-md group-hover:bg-opacity-90'>
            {children}
          </span>
        </Comp>
      )
    }

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
