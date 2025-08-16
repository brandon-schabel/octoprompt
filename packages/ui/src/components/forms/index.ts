// =============================================
// FORMS SYSTEM EXPORTS
// =============================================

// =============================================
// ORIGINAL FORM FACTORY (Simple Forms)
// =============================================

export {
  FormFactory,
  createTextField,
  createNumberField,
  createPasswordField,
  createEmailField,
  createSelectField,
  createCheckboxField,
  createRadioField,
  createSwitchField,
  createDateField,
  createFileField,
  createTagsField,
  createTextareaField,
  createFieldGroup,
  createFieldArray,
  createFormComponent,
  formValidation
} from './form-factory'

export type {
  FormConfig,
  FieldConfig,
  BaseFieldConfig,
  TextFieldConfig,
  NumberFieldConfig,
  PasswordFieldConfig,
  EmailFieldConfig,
  SelectFieldConfig,
  CheckboxFieldConfig,
  RadioFieldConfig,
  SwitchFieldConfig,
  DateFieldConfig,
  FileFieldConfig,
  TagsFieldConfig,
  FieldGroupConfig,
  FieldArrayConfig
} from './form-factory'

// =============================================
// TANSTACK FORM INTEGRATION (Advanced Forms)
// =============================================

export {
  TanStackForm,
  TanStackField,
  TanStackFormFactory,
  TanStackDynamicArrayField,
  TanStackMultiStepForm,
  useTanStackFormContext,
  useTanStackFormState,
  
  // Field Creators
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
  createTanStackFieldGroup,
  
  // Validation System
  tanstackValidation,
  tanstackPatterns,
  tanstackDynamicValidation,
  tanstackSchemaUtils,
  tanstackErrorUtils
} from './tanstack'

export type {
  TanStackFormProps,
  TanStackFormFactoryConfig,
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
  CustomFieldProps,
  FieldGroup,
  DynamicArrayFieldProps,
  MultiStepFormProps,
  FormState
} from './tanstack'

// =============================================
// HYBRID FORM SYSTEM (Intelligent Selection)
// =============================================

export {
  HybridFormFactory,
  generateMigrationGuide,
  getFormImplementationDecision
} from './hybrid-form-factory'

export type {
  HybridFormConfig,
  MigrationGuide
} from './hybrid-form-factory'

// =============================================
// COMPREHENSIVE EXAMPLES
// =============================================

// TODO: Create examples directory
/*
export {
  // Simple Forms Examples
  SimpleContactForm,
  SimpleLoginForm,
  SimpleUserSettingsForm,
  SimpleFormsShowcase,
  
  // Complex Forms Examples
  ComplexProjectForm,
  MultiStepSurveyForm,
  DynamicTeamForm,
  ComplexFormsShowcase,
  
  // Hybrid Forms Examples
  AdaptiveFormExample,
  MigrationComparisonDemo,
  DecisionTreeHelper,
  HybridFormsShowcase
} from './examples'
*/

// =============================================
// LEGACY DEMO (For Backward Compatibility)
// =============================================

// export { ContactFormDemo, ProjectSetupDemo, FormFactoryDemo } from './demo' // TODO: Create demo directory

// =============================================
// DEFAULT EXPORTS
// =============================================

// Most commonly used exports for easy importing
export { HybridFormFactory as default } from './hybrid-form-factory'