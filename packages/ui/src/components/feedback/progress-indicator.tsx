import * as React from 'react'
import { cn } from '../../utils'
import { Progress } from '../data/progress'
import { CheckCircle2, Circle } from 'lucide-react'

export interface ProgressIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Current progress value (0-100)
   */
  value: number
  /**
   * Maximum value for progress calculation
   * @default 100
   */
  max?: number
  /**
   * Variant of the progress indicator
   * @default "linear"
   */
  variant?: 'linear' | 'circular' | 'stepped'
  /**
   * Size of the indicator
   * @default "default"
   */
  size?: 'sm' | 'default' | 'lg'
  /**
   * Whether to show the percentage label
   * @default true
   */
  showLabel?: boolean
  /**
   * Custom label format function
   */
  formatLabel?: (value: number, max: number) => string
  /**
   * Color variant
   * @default "default"
   */
  color?: 'default' | 'success' | 'warning' | 'error' | 'info'
  /**
   * For stepped variant - array of step labels
   */
  steps?: string[]
  /**
   * For stepped variant - current step (0-indexed)
   */
  currentStep?: number
  /**
   * Whether to animate the progress
   * @default true
   */
  animated?: boolean
  /**
   * Additional description text
   */
  description?: string
}

const colorClasses = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500'
}

const sizeClasses = {
  sm: {
    height: 'h-1',
    text: 'text-xs',
    circular: 'h-16 w-16',
    strokeWidth: 6
  },
  default: {
    height: 'h-2',
    text: 'text-sm',
    circular: 'h-24 w-24',
    strokeWidth: 8
  },
  lg: {
    height: 'h-3',
    text: 'text-base',
    circular: 'h-32 w-32',
    strokeWidth: 10
  }
}

const CircularProgress: React.FC<{
  value: number
  size: 'sm' | 'default' | 'lg'
  color: ProgressIndicatorProps['color']
  showLabel: boolean
  formatLabel: (value: number, max: number) => string
  max: number
  animated: boolean
}> = ({ value, size, color = 'default', showLabel, formatLabel, max, animated }) => {
  const sizeConfig = sizeClasses[size]
  const radius = size === 'sm' ? 28 : size === 'default' ? 42 : 56
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / max) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', sizeConfig.circular)}>
      <svg className={cn('transform -rotate-90', sizeConfig.circular)}>
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          stroke="currentColor"
          strokeWidth={sizeConfig.strokeWidth}
          fill="none"
          className="text-muted-foreground/20"
        />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          stroke="currentColor"
          strokeWidth={sizeConfig.strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            colorClasses[color || 'default'],
            animated && 'transition-all duration-500 ease-in-out'
          )}
          style={{
            strokeDashoffset: offset
          }}
        />
      </svg>
      {showLabel && (
        <div className={cn('absolute inset-0 flex items-center justify-center', sizeConfig.text)}>
          <span className="font-semibold">{formatLabel(value, max)}</span>
        </div>
      )}
    </div>
  )
}

const SteppedProgress: React.FC<{
  steps: string[]
  currentStep: number
  size: 'sm' | 'default' | 'lg'
  color: ProgressIndicatorProps['color']
  animated: boolean
}> = ({ steps, currentStep, size, color = 'default', animated }) => {
  const iconSize = size === 'sm' ? 'h-5 w-5' : size === 'default' ? 'h-6 w-6' : 'h-8 w-8'
  const lineHeight = size === 'sm' ? 'h-0.5' : size === 'default' ? 'h-1' : 'h-1.5'
  const textSize = sizeClasses[size].text

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isUpcoming = index > currentStep

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'rounded-full flex items-center justify-center',
                    iconSize,
                    isCompleted && cn('bg-primary text-primary-foreground', colorClasses[color || 'default']),
                    isCurrent && 'ring-2 ring-primary ring-offset-2',
                    isUpcoming && 'bg-muted text-muted-foreground',
                    animated && isCompleted && 'transition-all duration-500'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className={cn('h-full w-full')} />
                  ) : (
                    <Circle className={cn('h-full w-full')} />
                  )}
                </div>
                <span className={cn('mt-2', textSize, isCurrent && 'font-semibold')}>
                  {step}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className={cn('flex-1 mx-2', lineHeight)}>
                  <div className="relative h-full w-full bg-muted">
                    <div
                      className={cn(
                        'absolute left-0 top-0 h-full bg-primary',
                        colorClasses[color || 'default'],
                        animated && 'transition-all duration-500'
                      )}
                      style={{
                        width: isCompleted ? '100%' : isCurrent ? '50%' : '0%'
                      }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export const ProgressIndicator = React.forwardRef<HTMLDivElement, ProgressIndicatorProps>(
  (
    {
      className,
      value,
      max = 100,
      variant = 'linear',
      size = 'default',
      showLabel = true,
      formatLabel = (val, max) => `${Math.round((val / max) * 100)}%`,
      color = 'default',
      steps = [],
      currentStep = 0,
      animated = true,
      description,
      ...props
    },
    ref
  ) => {
    const normalizedValue = Math.min(Math.max(0, value), max)
    const percentage = (normalizedValue / max) * 100

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {variant === 'linear' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              {description && (
                <span className={cn('text-muted-foreground', sizeClasses[size].text)}>
                  {description}
                </span>
              )}
              {showLabel && (
                <span className={cn('font-medium', sizeClasses[size].text)}>
                  {formatLabel(normalizedValue, max)}
                </span>
              )}
            </div>
            <Progress
              value={percentage}
              className={cn(sizeClasses[size].height)}
              indicatorColor={cn(
                colorClasses[color],
                animated && 'transition-all duration-500'
              )}
            />
          </div>
        )}

        {variant === 'circular' && (
          <div className="inline-flex flex-col items-center gap-2">
            <CircularProgress
              value={normalizedValue}
              max={max}
              size={size}
              color={color}
              showLabel={showLabel}
              formatLabel={formatLabel}
              animated={animated}
            />
            {description && (
              <span className={cn('text-muted-foreground', sizeClasses[size].text)}>
                {description}
              </span>
            )}
          </div>
        )}

        {variant === 'stepped' && steps.length > 0 && (
          <div className="space-y-2">
            {description && (
              <span className={cn('text-muted-foreground', sizeClasses[size].text)}>
                {description}
              </span>
            )}
            <SteppedProgress
              steps={steps}
              currentStep={currentStep}
              size={size}
              color={color}
              animated={animated}
            />
          </div>
        )}
      </div>
    )
  }
)

ProgressIndicator.displayName = 'ProgressIndicator'