import React from 'react'
import { z } from 'zod'
import { TanStackForm, TanStackFormProps } from './tanstack-form'
import { TanStackField, FieldProps } from './tanstack-field'

// =============================================
// TANSTACK FORM FACTORY
// =============================================

export interface TanStackFormFactoryConfig<T extends Record<string, any>> 
  extends Omit<TanStackFormProps<T>, 'children'> {
  /** Array of field configurations */
  fields: FieldProps[]
  
  /** Field groups for organization */
  fieldGroups?: FieldGroup[]
  
  /** Advanced form features */
  features?: {
    /** Enable conditional field visibility */
    conditionalFields?: boolean
    
    /** Enable field dependencies */
    fieldDependencies?: boolean
    
    /** Enable dynamic field arrays */
    dynamicArrays?: boolean
    
    /** Enable multi-step progression */
    multiStep?: boolean
    
    /** Enable field validation on dependencies */
    crossFieldValidation?: boolean
  }
}

export interface FieldGroup {
  title: string
  description?: string
  fields: FieldProps[]
  collapsible?: boolean
  defaultExpanded?: boolean
  columns?: 1 | 2 | 3
  condition?: (formValues: any) => boolean
}

// =============================================
// FIELD FACTORY FUNCTIONS
// =============================================

export function createTanStackTextField(config: Omit<Extract<FieldProps, { fieldType: 'text' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'text',
    ...config
  }
}

export function createTanStackTextareaField(config: Omit<Extract<FieldProps, { fieldType: 'textarea' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'textarea',
    ...config
  }
}

export function createTanStackSelectField(config: Omit<Extract<FieldProps, { fieldType: 'select' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'select',
    ...config
  }
}

export function createTanStackCheckboxField(config: Omit<Extract<FieldProps, { fieldType: 'checkbox' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'checkbox',
    ...config
  }
}

export function createTanStackSwitchField(config: Omit<Extract<FieldProps, { fieldType: 'switch' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'switch',
    ...config
  }
}

export function createTanStackRadioField(config: Omit<Extract<FieldProps, { fieldType: 'radio' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'radio',
    ...config
  }
}

export function createTanStackDateField(config: Omit<Extract<FieldProps, { fieldType: 'date' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'date',
    ...config
  }
}

export function createTanStackTagsField(config: Omit<Extract<FieldProps, { fieldType: 'tags' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'tags',
    ...config
  }
}

export function createTanStackFileField(config: Omit<Extract<FieldProps, { fieldType: 'file' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'file',
    ...config
  }
}

export function createTanStackCustomField(config: Omit<Extract<FieldProps, { fieldType: 'custom' }>, 'fieldType'>): FieldProps {
  return {
    fieldType: 'custom',
    ...config
  }
}

// =============================================
// CONVENIENCE FIELD CREATORS
// =============================================

export function createTanStackEmailField(config: Omit<Extract<FieldProps, { fieldType: 'text' }>, 'fieldType' | 'type'>): FieldProps {
  return createTanStackTextField({
    ...config,
    type: 'email',
    validator: z.string().email('Please enter a valid email address')
  })
}

export function createTanStackPasswordField(config: Omit<Extract<FieldProps, { fieldType: 'text' }>, 'fieldType' | 'type'>): FieldProps {
  return createTanStackTextField({
    ...config,
    type: 'password',
    validator: z.string().min(8, 'Password must be at least 8 characters')
  })
}

export function createTanStackNumberField(config: Omit<Extract<FieldProps, { fieldType: 'text' }>, 'fieldType' | 'type'>): FieldProps {
  return createTanStackTextField({
    ...config,
    type: 'number',
    validator: z.number()
  })
}

// =============================================
// FIELD GROUP FACTORY
// =============================================

export function createTanStackFieldGroup(group: FieldGroup): FieldGroup {
  return group
}

// =============================================
// MAIN FORM FACTORY COMPONENT
// =============================================

export function TanStackFormFactory<T extends Record<string, any>>({
  fields,
  fieldGroups,
  features,
  ...formProps
}: TanStackFormFactoryConfig<T>) {
  // Render individual fields
  const renderFields = (fieldsToRender: FieldProps[]) => {
    return fieldsToRender.map((field, index) => (
      <TanStackField key={field.name || index} {...field} />
    ))
  }

  // Render field groups
  const renderFieldGroups = () => {
    if (!fieldGroups) return null
    
    return fieldGroups.map((group, index) => (
      <FieldGroupComponent key={index} group={group} />
    ))
  }

  const FieldGroupComponent = ({ group }: { group: FieldGroup }) => {
    const [isExpanded, setIsExpanded] = React.useState(group.defaultExpanded ?? true)
    
    return (
      <div className="space-y-4 border rounded-lg p-4">
        {/* Group Header */}
        <div 
          className={group.collapsible ? "cursor-pointer" : ""}
          onClick={() => group.collapsible && setIsExpanded(!isExpanded)}
        >
          <h3 className="text-sm font-medium">{group.title}</h3>
          {group.description && (
            <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
          )}
        </div>
        
        {/* Group Fields */}
        {(!group.collapsible || isExpanded) && (
          <div className={`grid gap-4 ${
            group.columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
            group.columns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
            'grid-cols-1'
          }`}>
            {renderFields(group.fields)}
          </div>
        )}
      </div>
    )
  }

  return (
    <TanStackForm {...formProps}>
      {/* Render standalone fields */}
      {fields.length > 0 && (
        <div className="space-y-4">
          {renderFields(fields)}
        </div>
      )}
      
      {/* Render field groups */}
      {fieldGroups && fieldGroups.length > 0 && (
        <div className="space-y-6">
          {renderFieldGroups()}
        </div>
      )}
    </TanStackForm>
  )
}

// =============================================
// DYNAMIC ARRAY FIELD COMPONENT
// =============================================

export interface DynamicArrayFieldProps {
  name: string
  label?: string
  description?: string
  fieldTemplate: (index: number) => FieldProps
  minItems?: number
  maxItems?: number
  addButtonText?: string
  removeButtonText?: string
  className?: string
}

export function TanStackDynamicArrayField({
  name,
  label,
  description,
  fieldTemplate,
  minItems = 0,
  maxItems,
  addButtonText = "Add Item",
  removeButtonText = "Remove",
  className
}: DynamicArrayFieldProps) {
  const [items, setItems] = React.useState<number[]>([0])
  
  const addItem = () => {
    if (maxItems && items.length >= maxItems) return
    setItems(prev => [...prev, Math.max(...prev) + 1])
  }
  
  const removeItem = (index: number) => {
    if (items.length <= minItems) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      {label && (
        <div>
          <h3 className="text-sm font-medium">{label}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      
      {/* Dynamic Fields */}
      <div className="space-y-3">
        {items.map((itemId, index) => (
          <div key={itemId} className="flex gap-3 items-start">
            <div className="flex-1">
              <TanStackField {...fieldTemplate(index)} />
            </div>
            {items.length > minItems && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="mt-2 text-sm text-destructive hover:underline"
              >
                {removeButtonText}
              </button>
            )}
          </div>
        ))}
      </div>
      
      {/* Add Button */}
      {(!maxItems || items.length < maxItems) && (
        <button
          type="button"
          onClick={addItem}
          className="text-sm text-primary hover:underline"
        >
          + {addButtonText}
        </button>
      )}
    </div>
  )
}

// =============================================
// MULTI-STEP FORM COMPONENT
// =============================================

export interface MultiStepFormProps<T extends Record<string, any>> extends Omit<TanStackFormProps<T>, 'children'> {
  steps: Array<{
    title: string
    description?: string
    fields: FieldProps[]
    validation?: z.ZodSchema<any>
  }>
  onStepChange?: (step: number) => void
  showProgress?: boolean
  allowSkipSteps?: boolean
}

export function TanStackMultiStepForm<T extends Record<string, any>>({
  steps,
  onStepChange,
  showProgress = true,
  allowSkipSteps = false,
  ...formProps
}: MultiStepFormProps<T>) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const currentStepData = steps[currentStep]
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      onStepChange?.(nextStep)
    }
  }
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1
      setCurrentStep(prevStep)
      onStepChange?.(prevStep)
    }
  }
  
  return (
    <TanStackForm 
      {...formProps}
      title={`${formProps.title} - Step ${currentStep + 1} of ${steps.length}`}
      description={currentStepData.description}
      showProgress={showProgress}
    >
      {/* Progress Indicator */}
      {showProgress && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{currentStepData.title}</span>
            <span>{currentStep + 1} / {steps.length}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Current Step Fields */}
      <div className="space-y-4">
        {currentStepData.fields.map((field, index) => (
          <TanStackField key={field.name || index} {...field} />
        ))}
      </div>
      
      {/* Step Navigation */}
      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm border rounded disabled:opacity-50"
        >
          Previous
        </button>
        
        {currentStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded"
          >
            Submit
          </button>
        )}
      </div>
    </TanStackForm>
  )
}

export default TanStackFormFactory