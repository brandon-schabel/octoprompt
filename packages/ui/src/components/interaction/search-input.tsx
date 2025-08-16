import * as React from 'react'
import { cn } from '../../utils'
import { Input } from '../core/input'
import { Button } from '../core/button'
import { Search, X, Loader2 } from 'lucide-react'

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'onSubmit' | 'size'> {
  /**
   * The current search value
   */
  value?: string
  /**
   * Callback when the search value changes
   */
  onChange?: (value: string) => void
  /**
   * Callback when the clear button is clicked
   */
  onClear?: () => void
  /**
   * Callback when Enter key is pressed
   */
  onSubmit?: (value: string) => void
  /**
   * Whether to show the search icon
   * @default true
   */
  showIcon?: boolean
  /**
   * Whether to show the clear button when there's text
   * @default true
   */
  showClear?: boolean
  /**
   * Whether the search is in a loading state
   * @default false
   */
  isLoading?: boolean
  /**
   * Custom icon to display instead of the default search icon
   */
  icon?: React.ReactNode
  /**
   * Size variant for the input
   * @default "default"
   */
  size?: 'sm' | 'default' | 'lg'
  /**
   * Whether to focus the input on mount
   * @default false
   */
  autoFocus?: boolean
  /**
   * Keyboard shortcut hint to display
   */
  shortcutHint?: string
}

const sizeClasses = {
  sm: 'h-8 text-sm',
  default: 'h-10',
  lg: 'h-12 text-lg'
}

const iconSizeClasses = {
  sm: 'h-3.5 w-3.5',
  default: 'h-4 w-4',
  lg: 'h-5 w-5'
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onChange,
      onClear,
      onSubmit,
      showIcon = true,
      showClear = true,
      isLoading = false,
      icon,
      size = 'default',
      autoFocus = false,
      shortcutHint,
      placeholder = 'Search...',
      disabled,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const mergedRef = React.useMemo(
      () => (node: HTMLInputElement | null) => {
        if (ref) {
          if (typeof ref === 'function') {
            ref(node)
          } else {
            ref.current = node
          }
        }
        if (inputRef.current !== node) {
          inputRef.current = node
        }
      },
      [ref]
    )

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e.target.value)
      },
      [onChange]
    )

    const handleClear = React.useCallback(() => {
      onChange?.('')
      onClear?.()
      inputRef.current?.focus()
    }, [onChange, onClear])

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onSubmit) {
          e.preventDefault()
          onSubmit(value || '')
        }
        if (e.key === 'Escape' && value) {
          e.preventDefault()
          handleClear()
        }
        props.onKeyDown?.(e)
      },
      [onSubmit, value, handleClear, props]
    )

    React.useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus()
      }
    }, [autoFocus])

    const showClearButton = showClear && value && !isLoading && !disabled

    return (
      <div className="relative flex items-center">
        {showIcon && (
          <div className={cn(
            'absolute left-3 flex items-center pointer-events-none',
            'text-muted-foreground'
          )}>
            {isLoading ? (
              <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
            ) : (
              icon || <Search className={iconSizeClasses[size]} />
            )}
          </div>
        )}
        
        <Input
          ref={mergedRef}
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            sizeClasses[size],
            showIcon && 'pl-10',
            showClearButton && 'pr-10',
            shortcutHint && 'pr-20',
            className
          )}
          aria-label="Search"
          {...props}
        />

        {shortcutHint && !showClearButton && (
          <div className="absolute right-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              {shortcutHint}
            </kbd>
          </div>
        )}

        {showClearButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className={cn(
              'absolute right-1 h-7 w-7 p-0',
              size === 'sm' && 'h-6 w-6',
              size === 'lg' && 'h-8 w-8'
            )}
            aria-label="Clear search"
          >
            <X className={cn(iconSizeClasses[size], 'text-muted-foreground')} />
          </Button>
        )}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'