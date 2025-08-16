import * as React from 'react'
import { cn } from '../../utils'
import { Button, ButtonProps } from '../core/button'
import { Copy, Check, FileText, Code, FileJson } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../core/tooltip'

export type CopyFormat = 'text' | 'markdown' | 'json' | 'code'

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  /**
   * The text to copy
   */
  text: string | (() => string)
  /**
   * Format of the content being copied
   * @default "text"
   */
  format?: CopyFormat
  /**
   * Custom label for the button
   */
  label?: string
  /**
   * Whether to show the label
   * @default true when variant is not "ghost" or "icon"
   */
  showLabel?: boolean
  /**
   * Whether to show the icon
   * @default true
   */
  showIcon?: boolean
  /**
   * Custom icon to display
   */
  icon?: React.ReactNode
  /**
   * Success message to show in tooltip
   * @default "Copied!"
   */
  successMessage?: string
  /**
   * Error message to show if copy fails
   * @default "Failed to copy"
   */
  errorMessage?: string
  /**
   * Duration to show success state in milliseconds
   * @default 2000
   */
  successDuration?: number
  /**
   * Callback when copy succeeds
   */
  onCopySuccess?: (text: string) => void
  /**
   * Callback when copy fails
   */
  onCopyError?: (error: Error) => void
  /**
   * Whether to show a tooltip
   * @default true
   */
  showTooltip?: boolean
  /**
   * Tooltip text when not copied
   */
  tooltipText?: string
}

const formatIcons: Record<CopyFormat, React.ReactNode> = {
  text: <Copy className="h-4 w-4" />,
  markdown: <FileText className="h-4 w-4" />,
  json: <FileJson className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />
}

const formatLabels: Record<CopyFormat, string> = {
  text: 'Copy',
  markdown: 'Copy as Markdown',
  json: 'Copy as JSON',
  code: 'Copy Code'
}

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      className,
      text,
      format = 'text',
      label,
      showLabel,
      showIcon = true,
      icon,
      successMessage = 'Copied!',
      errorMessage = 'Failed to copy',
      successDuration = 2000,
      onCopySuccess,
      onCopyError,
      showTooltip = true,
      tooltipText,
      variant = 'outline',
      size = 'default',
      disabled,
      ...props
    },
    ref
  ) => {
    const [isCopied, setIsCopied] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

    const displayLabel = label || formatLabels[format]
    const displayIcon = icon || formatIcons[format]
    const shouldShowLabel = showLabel !== undefined 
      ? showLabel 
      : variant !== 'ghost' && variant !== 'link' && size !== 'icon'
    
    const tooltipContent = React.useMemo(() => {
      if (error) return errorMessage
      if (isCopied) return successMessage
      return tooltipText || displayLabel
    }, [error, isCopied, errorMessage, successMessage, tooltipText, displayLabel])

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [])

    const handleCopy = async (e?: React.MouseEvent) => {
      e?.preventDefault()
      if (disabled) return

      const textToCopy = typeof text === 'function' ? text() : text

      try {
        await navigator.clipboard.writeText(textToCopy)
        setIsCopied(true)
        setError(null)
        onCopySuccess?.(textToCopy)

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
          setIsCopied(false)
        }, successDuration)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to copy')
        setError(error.message)
        setIsCopied(false)
        onCopyError?.(error)

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
          setError(null)
        }, successDuration)
      }
    }

    const button = (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        onClick={handleCopy}
        disabled={disabled}
        className={cn(
          'gap-2 transition-all',
          isCopied && 'text-green-600 dark:text-green-400',
          error && 'text-destructive',
          className
        )}
        aria-label={displayLabel}
        {...props}
      >
        {showIcon && (
          isCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            displayIcon
          )
        )}
        {shouldShowLabel && (
          <span>{isCopied ? 'Copied!' : displayLabel}</span>
        )}
      </Button>
    )

    if (showTooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>{tooltipContent}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return button
  }
)

CopyButton.displayName = 'CopyButton'

/**
 * Inline copy button for copying small pieces of text
 */
export interface InlineCopyButtonProps extends Omit<CopyButtonProps, 'variant' | 'size'> {
  /**
   * Size of the inline button
   * @default "sm"
   */
  size?: 'xs' | 'sm'
}

export const InlineCopyButton = React.forwardRef<HTMLButtonElement, InlineCopyButtonProps>(
  ({ size = 'sm', className, ...props }, ref) => {
    const sizeClasses = {
      xs: 'h-5 w-5 p-0',
      sm: 'h-6 w-6 p-0'
    }

    const iconSizes = {
      xs: 'h-3 w-3',
      sm: 'h-3.5 w-3.5'
    }

    return (
      <CopyButton
        ref={ref}
        variant="ghost"
        size="icon"
        showLabel={false}
        className={cn(sizeClasses[size], className)}
        icon={<Copy className={iconSizes[size]} />}
        {...props}
      />
    )
  }
)

InlineCopyButton.displayName = 'InlineCopyButton'

/**
 * Copy block for displaying copyable text with a copy button
 */
export interface CopyBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The text to display and copy
   */
  text: string
  /**
   * Format of the content
   * @default "text"
   */
  format?: CopyFormat
  /**
   * Whether to show the text in a monospace font
   * @default true for "code" and "json" formats
   */
  monospace?: boolean
  /**
   * Maximum number of lines to show before truncating
   */
  maxLines?: number
  /**
   * Whether to wrap long lines
   * @default false
   */
  wrap?: boolean
}

export const CopyBlock = React.forwardRef<HTMLDivElement, CopyBlockProps>(
  (
    {
      className,
      text,
      format = 'text',
      monospace,
      maxLines,
      wrap = false,
      ...props
    },
    ref
  ) => {
    const shouldUseMonospace = monospace !== undefined 
      ? monospace 
      : format === 'code' || format === 'json'

    return (
      <div
        ref={ref}
        className={cn(
          'relative group rounded-lg border bg-muted/30 p-3 pr-12',
          className
        )}
        {...props}
      >
        <pre
          className={cn(
            'text-sm',
            shouldUseMonospace && 'font-mono',
            !wrap && 'overflow-x-auto',
            wrap && 'whitespace-pre-wrap break-words',
            maxLines && 'line-clamp-[var(--max-lines)]'
          )}
          style={{
            '--max-lines': maxLines
          } as React.CSSProperties}
        >
          {text}
        </pre>
        <div className="absolute right-2 top-2">
          <InlineCopyButton
            text={text}
            format={format}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    )
  }
)

CopyBlock.displayName = 'CopyBlock'