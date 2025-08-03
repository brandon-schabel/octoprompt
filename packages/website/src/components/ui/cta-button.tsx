// Re-export CTA button components from UI library with router-specific wrapper
import {
  CTAButton as UIButton,
  CTAButtonAnimated as UIAnimated,
  CTAButtonOutline as UIOutline,
  CTAButtonGroup as UIGroup
} from '@promptliano/ui'
import { Link } from '@tanstack/react-router'
import { forwardRef } from 'react'
import type { ComponentProps } from 'react'

// Wrapper for router integration
export const CTAButton = forwardRef<HTMLButtonElement, ComponentProps<typeof UIButton>>(
  ({ href, children, ...props }, ref) => {
    // If it's an internal link, wrap with router Link
    if (href && !href.startsWith('http') && !props.target) {
      return (
        <UIButton ref={ref} asChild {...props}>
          <Link to={href}>{children}</Link>
        </UIButton>
      )
    }

    // Otherwise use the UI library component as-is
    return (
      <UIButton ref={ref} href={href} {...props}>
        {children}
      </UIButton>
    )
  }
)

CTAButton.displayName = 'CTAButton'

// Similar wrappers for other variants
export const CTAButtonAnimated = forwardRef<HTMLButtonElement, ComponentProps<typeof UIAnimated>>(
  ({ href, children, ...props }, ref) => {
    if (href && !href.startsWith('http') && !props.target) {
      return (
        <UIAnimated ref={ref} asChild {...props}>
          <Link to={href}>{children}</Link>
        </UIAnimated>
      )
    }
    return (
      <UIAnimated ref={ref} href={href} {...props}>
        {children}
      </UIAnimated>
    )
  }
)

CTAButtonAnimated.displayName = 'CTAButtonAnimated'

export const CTAButtonOutline = forwardRef<HTMLButtonElement, ComponentProps<typeof UIOutline>>(
  ({ href, children, ...props }, ref) => {
    if (href && !href.startsWith('http') && !props.target) {
      return (
        <UIOutline ref={ref} asChild {...props}>
          <Link to={href}>{children}</Link>
        </UIOutline>
      )
    }
    return (
      <UIOutline ref={ref} href={href} {...props}>
        {children}
      </UIOutline>
    )
  }
)

CTAButtonOutline.displayName = 'CTAButtonOutline'

// Re-export button group as-is
export const CTAButtonGroup = UIGroup
