import * as React from 'react'
import { cn } from '../../utils'
import { Input } from '../core/input'
import { Textarea } from '../core/textarea'
import { Progress } from '../data/progress'

export interface CharacterLimitInputProps {
  /**
   * Current value
   */
  value: string
  /**
   * Callback when value changes
   */
  onChange: (value: string) => void
  /**
   * Maximum character limit
   */
  maxLength: number
  /**
   * Minimum character requirement (optional)
   */
  minLength?: number
  /**
   * Input type - single line or multiline
   * @default "input"
   */
  type?: 'input' | 'textarea'
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Whether the input is disabled
   * @default false
   */
  disabled?: boolean
  /**
   * Whether to show the character count
   * @default true
   */
  showCount?: boolean
  /**
   * Whether to show a progress bar
   * @default false
   */
  showProgress?: boolean
  /**
   * Whether to enforce hard limit (prevent typing) or soft limit (allow but warn)
   * @default "hard"
   */
  limitType?: 'hard' | 'soft'
  /**
   * Warning threshold as percentage (0-100)
   * @default 80
   */
  warningThreshold?: number
  /**
   * Custom className for the container
   */
  className?: string
  /**
   * Custom className for the input/textarea
   */
  inputClassName?: string
  /**
   * Label for the input
   */
  label?: string
  /**
   * Helper text
   */
  helperText?: string
  /**
   * Error message
   */
  error?: string
  /**
   * Whether the field is required
   */
  required?: boolean
  /**
   * Number of rows for textarea
   * @default 4
   */
  rows?: number
  /**
   * Additional props for the input/textarea element
   */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> | React.TextareaHTMLAttributes<HTMLTextAreaElement>
}

export const CharacterLimitInput = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  CharacterLimitInputProps
>(
  (
    {
      value,
      onChange,
      maxLength,
      minLength = 0,
      type = 'input',
      placeholder,
      disabled = false,
      showCount = true,
      showProgress = false,
      limitType = 'hard',
      warningThreshold = 80,
      className,
      inputClassName,
      label,
      helperText,
      error,
      required = false,
      rows = 4,
      inputProps = {}
    },
    ref
  ) => {
    const currentLength = value.length
    const percentUsed = (currentLength / maxLength) * 100
    const isNearLimit = percentUsed >= warningThreshold
    const isOverLimit = currentLength > maxLength
    const isBelowMin = minLength > 0 && currentLength < minLength

    const getCountColor = () => {
      if (isOverLimit && limitType === 'soft') return 'text-destructive'
      if (isNearLimit) return 'text-yellow-600 dark:text-yellow-400'
      if (isBelowMin) return 'text-muted-foreground'
      return 'text-muted-foreground'
    }

    const getProgressColor = () => {
      if (isOverLimit && limitType === 'soft') return 'bg-destructive'
      if (isNearLimit) return 'bg-yellow-500'
      return 'bg-primary'
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value
      
      if (limitType === 'hard' && newValue.length > maxLength) {
        // Prevent exceeding max length in hard limit mode
        return
      }
      
      onChange(newValue)
    }

    const countDisplay = React.useMemo(() => {
      if (minLength > 0 && currentLength < minLength) {
        return `${currentLength}/${minLength} min`
      }
      return `${currentLength}/${maxLength}`
    }, [currentLength, maxLength, minLength])

    const showError = error || (isOverLimit && limitType === 'soft')
    const errorMessage = error || (isOverLimit && limitType === 'soft' ? `Maximum ${maxLength} characters allowed` : '')

    const inputElement = type === 'input' ? (
      <Input
        ref={ref as React.Ref<HTMLInputElement>}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={limitType === 'hard' ? maxLength : undefined}
        required={required}
        className={cn(
          showError && 'border-destructive focus-visible:ring-destructive',
          inputClassName
        )}
        aria-invalid={showError ? 'true' : 'false'}
        aria-describedby={showError ? 'error-message' : helperText ? 'helper-text' : undefined}
        {...(inputProps as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    ) : (
      <Textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={limitType === 'hard' ? maxLength : undefined}
        required={required}
        rows={rows}
        className={cn(
          'resize-none',
          showError && 'border-destructive focus-visible:ring-destructive',
          inputClassName
        )}
        aria-invalid={showError ? 'true' : 'false'}
        aria-describedby={showError ? 'error-message' : helperText ? 'helper-text' : undefined}
        {...(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    )

    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </label>
            {showCount && (
              <span className={cn('text-xs', getCountColor())}>
                {countDisplay}
              </span>
            )}
          </div>
        )}

        <div className="space-y-1">
          {inputElement}

          {showProgress && (
            <Progress
              value={Math.min(percentUsed, 100)}
              className="h-1"
              indicatorColor={cn(
                'transition-all duration-300',
                getProgressColor()
              )}
            />
          )}

          {!label && showCount && (
            <div className="flex justify-end">
              <span className={cn('text-xs', getCountColor())}>
                {countDisplay}
              </span>
            </div>
          )}
        </div>

        {helperText && !showError && (
          <p id="helper-text" className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}

        {showError && (
          <p id="error-message" className="text-xs text-destructive">
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
)

CharacterLimitInput.displayName = 'CharacterLimitInput'