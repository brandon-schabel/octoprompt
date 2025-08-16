import React from 'react'
import { z } from 'zod'
import { FormFactory, FormConfig, FieldConfig } from './form-factory'
import { TanStackFormFactory, TanStackFormFactoryConfig } from './tanstack/tanstack-form-factory'
import { 
  createTanStackTextField, 
  createTanStackTextareaField,
  createTanStackSelectField,
  createTanStackCheckboxField,
  createTanStackSwitchField,
  createTanStackRadioField,
  createTanStackDateField,
  createTanStackTagsField,
  createTanStackEmailField,
  createTanStackPasswordField,
  createTanStackNumberField
} from './tanstack/tanstack-form-factory'
import { FieldProps } from './tanstack/tanstack-field'

// =============================================
// COMPLEXITY DETECTOR
// =============================================

interface ComplexityAnalysis {
  isComplex: boolean
  reasons: string[]
  score: number
  recommendations: string[]
}

function analyzeFormComplexity<T extends z.ZodType>(config: HybridFormConfig<T>): ComplexityAnalysis {
  const reasons: string[] = []
  let score = 0
  const recommendations: string[] = []

  // Check number of fields
  const fieldCount = config.fields.length
  if (fieldCount > 15) {
    score += 3
    reasons.push('Large number of fields (15+)')
    recommendations.push('Consider using TanStack Form for better performance with many fields')
  } else if (fieldCount > 10) {
    score += 2
    reasons.push('Moderate number of fields (10+)')
  }

  // Check for complex field types
  const hasComplexFields = config.fields.some(field => 
    field.type === 'array' || 
    field.type === 'group' ||
    (field.type === 'tags' && field.maxTags && field.maxTags > 5)
  )
  
  if (hasComplexFields) {
    score += 3
    reasons.push('Contains complex field types (arrays, groups)')
    recommendations.push('TanStack Form provides better support for dynamic arrays and complex structures')
  }

  // Check for advanced features
  if (config.features?.conditionalFields) {
    score += 2
    reasons.push('Requires conditional field visibility')
    recommendations.push('TanStack Form has better conditional logic support')
  }

  if (config.features?.fieldDependencies) {
    score += 2
    reasons.push('Has field dependencies')
    recommendations.push('TanStack Form handles field dependencies more efficiently')
  }

  if (config.features?.multiStep) {
    score += 3
    reasons.push('Multi-step form configuration')
    recommendations.push('TanStack Form is recommended for multi-step forms')
  }

  if (config.features?.crossFieldValidation) {
    score += 2
    reasons.push('Complex cross-field validation')
    recommendations.push('TanStack Form provides better async validation support')
  }

  if (config.features?.autoSave) {
    score += 2
    reasons.push('Auto-save functionality required')
    recommendations.push('TanStack Form has built-in auto-save capabilities')
  }

  // Check validation complexity
  const hasComplexValidation = config.fields.some(field => {
    // Check for custom validation on fields that support it
    if (field.type === 'text' && field.validation?.custom) return true
    if (field.type === 'email' && field.validation?.custom) return true
    if (field.type === 'tags' && field.validation?.custom) return true
    
    // Check email-specific validation
    if (field.type === 'email' && field.validation?.allowPlusSymbol) return true
    
    // Check date field constraints
    if (field.type === 'date' && (field.minDate || field.maxDate || field.disabledDates)) return true
    
    return false
  })

  if (hasComplexValidation) {
    score += 1
    reasons.push('Complex validation requirements')
  }

  const isComplex = score >= 4

  return {
    isComplex,
    reasons,
    score,
    recommendations: isComplex ? recommendations : ['Simple FormFactory is sufficient for this form']
  }
}

// =============================================
// HYBRID FORM TYPES
// =============================================

export interface HybridFormConfig<T extends z.ZodType> extends Omit<FormConfig<T>, 'fields'> {
  /** Form submission handler */
  onSubmit: (data: z.infer<T>) => void | Promise<void>
  
  /** Optional cancel handler */
  onCancel?: () => void
  
  /** Loading state */
  isLoading?: boolean
  
  /** Disabled state */
  isDisabled?: boolean
  
  /** Form fields - can be original or TanStack field configs */
  fields: FieldConfig[]
  
  /** Force a specific form implementation */
  forceImplementation?: 'original' | 'tanstack'
  
  /** Advanced features that suggest TanStack Form */
  features?: {
    conditionalFields?: boolean
    fieldDependencies?: boolean
    dynamicArrays?: boolean
    multiStep?: boolean
    crossFieldValidation?: boolean
    autoSave?: boolean
  }
  
  /** Show complexity analysis in development */
  showComplexityAnalysis?: boolean
  
  /** Migration mode - shows both forms for comparison */
  migrationMode?: boolean
  
  /** TanStack-specific configuration */
  tanstackConfig?: Partial<TanStackFormFactoryConfig<z.infer<T>>>
  
  /** Additional children */
  children?: React.ReactNode
}

// =============================================
// FIELD CONVERTER
// =============================================

function convertFieldsToTanStack(fields: any[]): FieldProps[] {
  return fields.map((field): FieldProps => {
    switch (field.type) {
      case 'text':
        return createTanStackTextField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled,
          maxLength: field.maxLength,
          showCount: field.showCount,
          autoComplete: field.autoComplete
        })
      
      case 'email':
        return createTanStackEmailField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled
        })
      
      case 'password':
        return createTanStackPasswordField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled
        })
      
      case 'number':
        return createTanStackNumberField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled
        })
      
      case 'textarea':
        return createTanStackTextareaField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled,
          rows: field.rows,
          maxLength: field.maxLength,
          showCount: field.showCount
        })
      
      case 'select':
        return createTanStackSelectField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled,
          options: field.options.map((opt: any) => ({
            value: opt.value,
            label: opt.label,
            disabled: opt.disabled
          })),
          multiple: field.multiple
        })
      
      case 'checkbox':
        return createTanStackCheckboxField({
          name: field.name,
          label: field.label,
          description: field.description,
          required: field.required,
          disabled: field.disabled
        })
      
      case 'switch':
        return createTanStackSwitchField({
          name: field.name,
          label: field.label,
          description: field.description,
          required: field.required,
          disabled: field.disabled
        })
      
      case 'radio':
        return createTanStackRadioField({
          name: field.name,
          label: field.label,
          description: field.description,
          required: field.required,
          disabled: field.disabled,
          options: field.options.map((opt: any) => ({
            value: opt.value,
            label: opt.label,
            description: opt.description
          })),
          orientation: field.orientation
        })
      
      case 'date':
        return createTanStackDateField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled,
          minDate: field.minDate,
          maxDate: field.maxDate,
          dateFormat: field.dateFormat
        })
      
      case 'tags':
        return createTanStackTagsField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled,
          maxTags: field.maxTags,
          suggestions: field.suggestions,
          allowCustom: field.allowCustom
        })
      
      default:
        // Fallback to text field
        return createTanStackTextField({
          name: field.name,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled
        })
    }
  })
}

// =============================================
// HYBRID FORM FACTORY COMPONENT
// =============================================

export function HybridFormFactory<T extends z.ZodType>(config: HybridFormConfig<T>) {
  const {
    forceImplementation,
    features,
    showComplexityAnalysis = process.env.NODE_ENV === 'development',
    migrationMode = false,
    tanstackConfig,
    ...baseConfig
  } = config

  // Analyze form complexity
  const complexity = analyzeFormComplexity(config)
  
  // Determine which implementation to use
  const shouldUseTanStack = 
    forceImplementation === 'tanstack' ||
    (forceImplementation !== 'original' && complexity.isComplex)

  // Development complexity analysis
  React.useEffect(() => {
    if (showComplexityAnalysis && process.env.NODE_ENV === 'development') {
      console.group(`🔍 Form Complexity Analysis: ${(baseConfig.schema?._def as any)?.typeName || 'Unknown'} Form`)
      console.log(`Implementation: ${shouldUseTanStack ? '🚀 TanStack Form' : '⚡ Simple FormFactory'}`)
      console.log(`Complexity Score: ${complexity.score}/10`)
      console.log('Reasons:', complexity.reasons)
      console.log('Recommendations:', complexity.recommendations)
      console.groupEnd()
    }
  }, [complexity, shouldUseTanStack, showComplexityAnalysis, baseConfig.schema])

  // Migration mode - show both forms side by side
  if (migrationMode) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4">
        {/* Original FormFactory */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <span className="text-sm font-medium">⚡ Original FormFactory</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
              Current Implementation
            </span>
          </div>
          <FormFactory
            {...baseConfig}
          />
        </div>

        {/* TanStack FormFactory */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <span className="text-sm font-medium">🚀 TanStack Form</span>
            <span className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
              Enhanced Implementation
            </span>
          </div>
          <TanStackFormFactory
            schema={baseConfig.schema}
            fields={convertFieldsToTanStack(baseConfig.fields)}
            onSubmit={baseConfig.onSubmit}
            defaultValues={baseConfig.defaultValues}
            title="TanStack Form Version"
            {...tanstackConfig}
          />
        </div>
      </div>
    )
  }

  // Production implementation selection
  if (shouldUseTanStack) {
    return (
      <div className="space-y-2">
        {showComplexityAnalysis && (
          <div className="text-xs text-muted-foreground">
            Using TanStack Form (complexity score: {complexity.score})
          </div>
        )}
        <TanStackFormFactory
          schema={baseConfig.schema}
          fields={convertFieldsToTanStack(baseConfig.fields)}
          onSubmit={baseConfig.onSubmit}
          defaultValues={baseConfig.defaultValues}
          features={features}
          {...tanstackConfig}
        />
      </div>
    )
  } else {
    return (
      <div className="space-y-2">
        {showComplexityAnalysis && (
          <div className="text-xs text-muted-foreground">
            Using Simple FormFactory (complexity score: {complexity.score})
          </div>
        )}
        <FormFactory
          {...baseConfig}
        />
      </div>
    )
  }
}

// =============================================
// MIGRATION HELPER
// =============================================

export interface MigrationGuide {
  currentImplementation: 'original' | 'tanstack'
  recommendation: 'keep-original' | 'upgrade-to-tanstack' | 'consider-upgrade'
  benefits: string[]
  migrationSteps: string[]
  effort: 'low' | 'medium' | 'high'
}

export function generateMigrationGuide<T extends z.ZodType>(
  config: HybridFormConfig<T>
): MigrationGuide {
  const complexity = analyzeFormComplexity(config)
  
  if (complexity.score <= 2) {
    return {
      currentImplementation: 'original',
      recommendation: 'keep-original',
      benefits: [
        'Simpler implementation is sufficient',
        'Smaller bundle size',
        'Faster initial render'
      ],
      migrationSteps: [
        'No migration needed',
        'Continue using FormFactory'
      ],
      effort: 'low'
    }
  } else if (complexity.score <= 4) {
    return {
      currentImplementation: 'original',
      recommendation: 'consider-upgrade',
      benefits: [
        'Better performance with many fields',
        'More flexible validation',
        'Better developer experience'
      ],
      migrationSteps: [
        'Test with migrationMode={true}',
        'Compare both implementations',
        'Gradually migrate if benefits are clear'
      ],
      effort: 'medium'
    }
  } else {
    return {
      currentImplementation: 'original',
      recommendation: 'upgrade-to-tanstack',
      benefits: [
        'Significant performance improvements',
        'Better handling of complex scenarios',
        'More maintainable code',
        'Advanced features support'
      ],
      migrationSteps: [
        'Replace HybridFormFactory with forceImplementation="tanstack"',
        'Test all form functionality',
        'Update any custom validation logic',
        'Deploy and monitor'
      ],
      effort: complexity.score > 7 ? 'high' : 'medium'
    }
  }
}

// =============================================
// DECISION TREE HELPER
// =============================================

export function getFormImplementationDecision(requirements: {
  fieldCount: number
  hasArrayFields: boolean
  hasConditionalLogic: boolean
  hasComplexValidation: boolean
  needsAutoSave: boolean
  isMultiStep: boolean
  performanceRequired: boolean
}): 'original' | 'tanstack' {
  let score = 0
  
  if (requirements.fieldCount > 10) score += 2
  if (requirements.fieldCount > 20) score += 2
  if (requirements.hasArrayFields) score += 3
  if (requirements.hasConditionalLogic) score += 2
  if (requirements.hasComplexValidation) score += 2
  if (requirements.needsAutoSave) score += 2
  if (requirements.isMultiStep) score += 3
  if (requirements.performanceRequired) score += 2
  
  return score >= 4 ? 'tanstack' : 'original'
}

export default HybridFormFactory