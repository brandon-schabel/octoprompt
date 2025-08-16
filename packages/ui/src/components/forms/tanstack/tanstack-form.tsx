import React, { ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'
import { cn } from '../../../utils'
import { Button } from '../../core/button'
import { Separator } from '../../core/separator'
import { Card, CardContent, CardHeader, CardTitle } from '../../core/card'
import { Progress } from '../../data/progress'
import { Badge } from '../../core/badge'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'

// =============================================
// TANSTACK FORM TYPES
// =============================================

export interface TanStackFormProps<T extends Record<string, any>> {
  /** Zod schema for validation */
  schema: z.ZodSchema<T>
  
  /** Form submission handler */
  onSubmit: (values: T) => void | Promise<void>
  
  /** Default values */
  defaultValues?: Partial<T>
  
  /** Form children - typically TanStackField components */
  children: ReactNode
  
  /** Form container styling */
  className?: string
  
  /** Form title */
  title?: string
  
  /** Form description */
  description?: string
  
  /** Loading state */
  isLoading?: boolean
  
  /** Disabled state */
  isDisabled?: boolean
  
  /** Show form progress indicator */
  showProgress?: boolean
  
  /** Submit button configuration */
  submitButton?: {
    text?: string
    loadingText?: string
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    className?: string
    disabled?: boolean
  }
  
  /** Cancel button configuration */
  cancelButton?: {
    text?: string
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    className?: string
    onClick?: () => void
  }
  
  /** Form layout */
  layout?: {
    spacing?: 'sm' | 'md' | 'lg'
    showCard?: boolean
    columns?: 1 | 2 | 3
  }
  
  /** Validation mode */
  validationMode?: 'onChange' | 'onBlur' | 'onSubmit'
  
  /** Revalidation mode */
  reValidateMode?: 'onChange' | 'onBlur' | 'onSubmit'
  
  /** Form error handler */
  onError?: (errors: Record<string, string[]>) => void
  
  /** Form success handler */
  onSuccess?: (values: T) => void
  
  /** Reset form after successful submission */
  resetOnSubmit?: boolean
  
  /** Auto-save functionality */
  autoSave?: {
    enabled: boolean
    interval?: number
    onSave?: (values: Partial<T>) => void
  }
}

export interface FormState {
  isValid: boolean
  isSubmitting: boolean
  isDirty: boolean
  submitCount: number
  errors: Record<string, string[]>
  touchedFields: Set<string>
}

// =============================================
// TANSTACK FORM COMPONENT
// =============================================

export function TanStackForm<T extends Record<string, any>>({
  schema,
  onSubmit,
  defaultValues = {} as Partial<T>,
  children,
  className,
  title,
  description,
  isLoading = false,
  isDisabled = false,
  showProgress = false,
  submitButton = {
    text: 'Submit',
    loadingText: 'Submitting...',
    variant: 'default'
  },
  cancelButton,
  layout = {
    spacing: 'md',
    showCard: false,
    columns: 1
  },
  validationMode = 'onBlur',
  reValidateMode = 'onBlur',
  onError,
  onSuccess,
  resetOnSubmit = false,
  autoSave
}: TanStackFormProps<T>) {
  const form = useForm({
    defaultValues,
    validators: {
      onChange: validationMode === 'onChange' ? ({ value }) => {
        const result = schema.safeParse(value)
        return result.success ? undefined : result.error.errors.map(err => err.message).join(', ')
      } : undefined,
      onBlur: validationMode === 'onBlur' ? ({ value }) => {
        const result = schema.safeParse(value)
        return result.success ? undefined : result.error.errors.map(err => err.message).join(', ')
      } : undefined,
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value)
        return result.success ? undefined : result.error.errors.map(err => err.message).join(', ')
      }
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await onSubmit(value as T)
        onSuccess?.(value as T)
        
        if (resetOnSubmit) {
          formApi.reset()
        }
      } catch (error) {
        console.error('Form submission error:', error)
        onError?.({ submit: [(error as Error).message] })
      }
    }
  })

  // Auto-save functionality
  React.useEffect(() => {
    if (!autoSave?.enabled) return

    const interval = setInterval(() => {
      const values = form.state.values
      if (form.state.isDirty && !form.state.isSubmitting) {
        autoSave.onSave?.(values)
      }
    }, autoSave.interval || 30000) // Default 30 seconds

    return () => clearInterval(interval)
  }, [autoSave, form])

  // Calculate form progress for multi-step forms
  const calculateProgress = () => {
    if (!showProgress) return 0
    
    const totalFields = Object.keys(defaultValues).length
    const completedFields = Object.values(form.state.values || {}).filter(value => 
      value !== undefined && value !== '' && value !== null
    ).length
    
    return totalFields > 0 ? (completedFields / totalFields) * 100 : 0
  }

  // Extract form state for external use
  const formState: FormState = {
    isValid: form.state.isValid,
    isSubmitting: form.state.isSubmitting || isLoading,
    isDirty: form.state.isDirty,
    submitCount: 0, // submitAttempts doesn't exist in TanStack Form
    errors: {},
    touchedFields: new Set(Object.keys(form.state.fieldMeta || {}).filter(
      key => {
        const fieldMeta = form.state.fieldMeta?.[key as keyof typeof form.state.fieldMeta]
        return fieldMeta && 'isTouched' in fieldMeta && fieldMeta.isTouched
      }
    ))
  }

  const spacingClasses = {
    sm: 'space-y-3',
    md: 'space-y-4',
    lg: 'space-y-6'
  }

  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }

  const FormContent = (
    <div className={cn('w-full', className)}>
      {/* Form Header */}
      {(title || description || showProgress) && (
        <div className="space-y-3 mb-6">
          {title && (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              {formState.isDirty && (
                <Badge variant="outline" className="text-xs">
                  <Info className="w-3 h-3 mr-1" />
                  Unsaved changes
                </Badge>
              )}
            </div>
          )}
          
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          
          {showProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completion Progress</span>
                <span>{Math.round(calculateProgress())}%</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className={cn(
          spacingClasses[layout.spacing || 'md'],
          'w-full'
        )}
      >
        {/* Form Fields */}
        <div className={cn(
          'grid gap-4',
          gridClasses[layout.columns || 1]
        )}>
          <TanStackFormProvider value={form}>
            {children}
          </TanStackFormProvider>
        </div>

        {/* Form Actions */}
        {(submitButton || cancelButton) && (
          <>
            <Separator className="my-6" />
            <div className="flex items-center justify-end gap-3">
              {cancelButton && (
                <Button
                  type="button"
                  variant={cancelButton.variant || 'outline'}
                  onClick={cancelButton.onClick}
                  disabled={formState.isSubmitting || isDisabled}
                  className={cancelButton.className}
                >
                  {cancelButton.text || 'Cancel'}
                </Button>
              )}
              
              <Button
                type="submit"
                variant={submitButton.variant}
                disabled={
                  submitButton.disabled || 
                  !formState.isValid || 
                  formState.isSubmitting || 
                  isDisabled
                }
                className={cn(
                  'min-w-24',
                  submitButton.className
                )}
              >
                {formState.isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    {submitButton.loadingText}
                  </>
                ) : (
                  submitButton.text
                )}
              </Button>
            </div>
          </>
        )}

        {/* Form Status */}
        {(formState.errors.submit || autoSave?.enabled) && (
          <div className="mt-4 space-y-2">
            {formState.errors.submit && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span>{formState.errors.submit[0]}</span>
              </div>
            )}
            
            {autoSave?.enabled && formState.isDirty && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4" />
                <span>Auto-saving enabled</span>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  )

  // Wrap in card if requested
  if (layout.showCard) {
    return (
      <Card className={className}>
        {title && (
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {title}
              {formState.isDirty && (
                <Badge variant="outline" className="text-xs">
                  <Info className="w-3 h-3 mr-1" />
                  Unsaved
                </Badge>
              )}
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </CardHeader>
        )}
        <CardContent>
          {FormContent}
        </CardContent>
      </Card>
    )
  }

  return FormContent
}

// =============================================
// FORM CONTEXT
// =============================================

const TanStackFormContext = React.createContext<any>(null)

export const TanStackFormProvider = TanStackFormContext.Provider

// =============================================
// FORM CONTEXT HOOK
// =============================================

export function useTanStackFormContext<T = any>() {
  const context = React.useContext(TanStackFormContext)
  if (!context) {
    throw new Error('useTanStackFormContext must be used within a TanStackFormProvider')
  }
  return context
}

// =============================================
// FORM STATE HOOK
// =============================================

export function useTanStackFormState(form: any): FormState {
  return {
    isValid: form.state.isValid,
    isSubmitting: form.state.isSubmitting,
    isDirty: form.state.isDirty,
    submitCount: 0, // submitAttempts doesn't exist in TanStack Form
    errors: {},
    touchedFields: new Set(Object.keys(form.state.fieldMeta).filter(
      key => form.state.fieldMeta[key]?.isTouched
    ))
  }
}

export default TanStackForm