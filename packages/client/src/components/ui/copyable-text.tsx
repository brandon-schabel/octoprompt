import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/api/use-claude-code-api'

interface CopyableTextProps {
  text: string
  className?: string
  showIcon?: boolean
  iconSize?: 'sm' | 'md' | 'lg'
  variant?: 'inline' | 'block' | 'code'
  truncate?: boolean
  maxLength?: number
  children?: React.ReactNode
}

export function CopyableText({
  text,
  className,
  showIcon = true,
  iconSize = 'sm',
  variant = 'inline',
  truncate = false,
  maxLength,
  children
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false)
  const copyMutation = useCopyToClipboard()

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await copyMutation.mutateAsync(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayText = maxLength && text.length > maxLength 
    ? `${text.substring(0, maxLength)}...` 
    : text

  const iconSizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }[iconSize]

  if (variant === 'inline') {
    return (
      <span 
        className={cn(
          'inline-flex items-center gap-1 group cursor-pointer hover:bg-muted/50 rounded px-1',
          className
        )}
        onClick={handleCopy}
      >
        <span className={cn(truncate && 'truncate')}>
          {children || displayText}
        </span>
        {showIcon && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            {copied ? (
              <Check className={cn(iconSizeClass, 'text-green-500')} />
            ) : (
              <Copy className={cn(iconSizeClass, 'text-muted-foreground')} />
            )}
          </span>
        )}
      </span>
    )
  }

  if (variant === 'block') {
    return (
      <div 
        className={cn(
          'flex items-center justify-between group cursor-pointer hover:bg-muted/50 rounded p-2',
          className
        )}
      >
        <span className={cn(truncate && 'truncate flex-1')}>
          {children || displayText}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className={iconSizeClass} />
          ) : (
            <Copy className={iconSizeClass} />
          )}
        </Button>
      </div>
    )
  }

  if (variant === 'code') {
    return (
      <div className={cn('relative group', className)}>
        <pre className={cn(
          'bg-muted rounded-md p-3 pr-12 overflow-x-auto',
          truncate && 'truncate'
        )}>
          <code className="text-sm font-mono">
            {children || displayText}
          </code>
        </pre>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            'absolute top-2 right-2 h-8 w-8',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
          onClick={handleCopy}
        >
          {copied ? (
            <Check className={iconSizeClass} />
          ) : (
            <Copy className={iconSizeClass} />
          )}
        </Button>
      </div>
    )
  }

  return null
}

// Convenience components for common use cases
export function CopyableCode({ children, ...props }: Omit<CopyableTextProps, 'variant'>) {
  return <CopyableText variant="code" {...props}>{children}</CopyableText>
}

export function CopyableInline({ children, ...props }: Omit<CopyableTextProps, 'variant'>) {
  return <CopyableText variant="inline" {...props}>{children}</CopyableText>
}

export function CopyableBlock({ children, ...props }: Omit<CopyableTextProps, 'variant'>) {
  return <CopyableText variant="block" {...props}>{children}</CopyableText>
}