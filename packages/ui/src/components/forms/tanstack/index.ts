// =============================================
// TANSTACK FORM EXPORTS
// =============================================

// Core Components
export { TanStackForm, useTanStackFormContext, useTanStackFormState } from './tanstack-form'
export type { TanStackFormProps, FormState } from './tanstack-form'

export { TanStackField } from './tanstack-field'
export type { 
  FieldProps,
  FieldType,
  BaseFieldProps,
  TextFieldProps,
  TextareaFieldProps,
  SelectFieldProps,
  CheckboxFieldProps,
  SwitchFieldProps,
  RadioFieldProps,
  DateFieldProps,
  TagsFieldProps,
  FileFieldProps,
  CustomFieldProps
} from './tanstack-field'

// Factory Components
export { 
  TanStackFormFactory,
  TanStackDynamicArrayField,
  TanStackMultiStepForm,
  createTanStackTextField,
  createTanStackTextareaField,
  createTanStackSelectField,
  createTanStackCheckboxField,
  createTanStackSwitchField,
  createTanStackRadioField,
  createTanStackDateField,
  createTanStackTagsField,
  createTanStackFileField,
  createTanStackCustomField,
  createTanStackEmailField,
  createTanStackPasswordField,
  createTanStackNumberField,
  createTanStackFieldGroup
} from './tanstack-form-factory'

export type {
  TanStackFormFactoryConfig,
  FieldGroup,
  DynamicArrayFieldProps,
  MultiStepFormProps
} from './tanstack-form-factory'

// Validation Utilities
export {
  tanstackValidation,
  tanstackPatterns,
  tanstackDynamicValidation,
  tanstackSchemaUtils,
  tanstackErrorUtils
} from './tanstack-validation'

export { default as tanstackValidationDefault } from './tanstack-validation'