# Hybrid Forms System - FormFactory & TanStack Form Integration

A comprehensive, intelligent form system that combines the simplicity of FormFactory with the power of TanStack Form, automatically choosing the best implementation based on your form's complexity.

## 🎯 Overview

This system provides **three approaches** to building forms in Promptliano:

1. **FormFactory** - Simple, fast forms for basic use cases (80% of forms)
2. **TanStack Form** - Advanced forms for complex scenarios (20% of forms) 
3. **HybridFormFactory** - Intelligent switching between both based on complexity

## 📊 Quick Decision Guide

```
Form Fields < 10 + Basic Validation → FormFactory
Form Fields > 15 + Advanced Features → TanStack Form
Dynamic/Conditional Logic → TanStack Form
Multi-step Workflows → TanStack Form
Performance Critical → TanStack Form
```

## 🚀 Quick Start

### Simple Form (Automatic Selection)

```tsx
import { HybridFormFactory, createTextField, createEmailField } from '@promptliano/ui/forms'
import { z } from 'zod'

const ContactSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Valid email required'),
  message: z.string().min(10, 'Message too short')
})

function ContactForm() {
  return (
    <HybridFormFactory
      schema={ContactSchema}
      fields={[
        createTextField({
          name: 'name',
          label: 'Full Name',
          required: true
        }),
        createEmailField({
          name: 'email', 
          label: 'Email Address',
          required: true
        }),
        createTextareaField({
          name: 'message',
          label: 'Message',
          rows: 4,
          required: true
        })
      ]}
      onSubmit={(data) => console.log(data)}
      submitButton={{ text: 'Send Message' }}
    />
  )
}
```

### Force Specific Implementation

```tsx
// Force FormFactory for simple forms
<HybridFormFactory
  forceImplementation="original"
  // ... other props
/>

// Force TanStack Form for complex forms  
<HybridFormFactory
  forceImplementation="tanstack"
  features={{
    conditionalFields: true,
    autoSave: true,
    multiStep: true
  }}
  // ... other props
/>
```

## 📁 Folder Structure

```
src/components/forms/
├── README.md                     # This comprehensive guide
├── form-factory.tsx             # Original FormFactory (simple forms)
├── demo.tsx                     # Basic demos
├── hybrid-form-factory.tsx      # Intelligent form selector
├── tanstack/                    # TanStack Form implementation
│   ├── index.ts                 # Clean exports
│   ├── tanstack-form.tsx        # Core TanStack Form wrapper
│   ├── tanstack-field.tsx       # Individual field components
│   ├── tanstack-form-factory.tsx # Factory pattern for TanStack
│   └── tanstack-validation.tsx  # Zod validation helpers
└── examples/                    # Comprehensive examples
    ├── index.ts                 # Example exports
    ├── simple-forms.tsx         # Contact, login, settings forms
    ├── complex-forms.tsx        # Multi-step, dynamic, conditional forms
    └── hybrid-forms.tsx         # Migration and comparison demos
```

## 🔧 Core Components

### 1. HybridFormFactory (Recommended)

The intelligent form component that automatically chooses the best implementation:

```tsx
interface HybridFormConfig<T> {
  schema: z.ZodSchema<T>
  fields: FieldConfig[]
  
  // Force specific implementation
  forceImplementation?: 'original' | 'tanstack'
  
  // Advanced features (suggests TanStack)
  features?: {
    conditionalFields?: boolean
    fieldDependencies?: boolean
    dynamicArrays?: boolean
    multiStep?: boolean
    crossFieldValidation?: boolean
    autoSave?: boolean
  }
  
  // Development helpers
  showComplexityAnalysis?: boolean  // Shows decision reasoning
  migrationMode?: boolean          // Side-by-side comparison
}
```

### 2. FormFactory (Simple Forms)

Perfect for straightforward forms with basic validation:

```tsx
<FormFactory
  schema={schema}
  fields={[
    createTextField({ name: 'name', label: 'Name', required: true }),
    createEmailField({ name: 'email', label: 'Email', required: true })
  ]}
  onSubmit={handleSubmit}
  submitButton={{ text: 'Submit' }}
/>
```

**Best for:**
- ✅ < 10 fields
- ✅ Basic validation
- ✅ Static field structure  
- ✅ Contact forms, login forms
- ✅ Simple settings forms

### 3. TanStack Form (Advanced Forms)

For complex forms requiring advanced features:

```tsx
<TanStackFormFactory
  schema={schema}
  fields={tanstackFields}
  onSubmit={handleSubmit}
  features={{
    conditionalFields: true,
    autoSave: true,
    multiStep: true
  }}
  autoSave={{
    enabled: true,
    interval: 30000,
    onSave: (values) => saveProgress(values)
  }}
/>
```

**Best for:**
- ✅ > 15 fields
- ✅ Dynamic field arrays
- ✅ Conditional logic
- ✅ Multi-step workflows
- ✅ Complex validation
- ✅ Performance requirements

## 🎨 Field Types & Factories

### Basic Fields

```tsx
// Text input
createTextField({
  name: 'username',
  label: 'Username',
  placeholder: 'Enter username',
  maxLength: 50,
  showCount: true
})

// Email with validation
createEmailField({
  name: 'email',
  label: 'Email Address',
  required: true,
  autoComplete: 'email'
})

// Password with toggle
createPasswordField({
  name: 'password',
  label: 'Password',
  showToggle: true,
  required: true
})

// Multi-line text
createTextareaField({
  name: 'description',
  label: 'Description',
  rows: 4,
  maxLength: 1000,
  showCount: true
})
```

### Selection Fields

```tsx
// Dropdown select
createSelectField({
  name: 'category',
  label: 'Category',
  options: [
    { value: 'tech', label: 'Technology' },
    { value: 'design', label: 'Design' },
    { value: 'business', label: 'Business' }
  ],
  searchable: true
})

// Radio buttons
createRadioField({
  name: 'priority',
  label: 'Priority Level',
  options: [
    { value: 'low', label: 'Low', description: 'No rush' },
    { value: 'high', label: 'High', description: 'Urgent' }
  ],
  orientation: 'horizontal'
})
```

### Advanced Fields

```tsx
// Tag input with suggestions
createTagsField({
  name: 'skills',
  label: 'Skills',
  maxTags: 10,
  suggestions: ['React', 'TypeScript', 'Node.js'],
  allowCustom: true
})

// Date picker
createDateField({
  name: 'dueDate',
  label: 'Due Date',
  minDate: new Date(),
  dateFormat: 'PPP'
})

// File upload
createFileField({
  name: 'documents',
  label: 'Upload Documents',
  accept: '.pdf,.doc,.docx',
  multiple: true,
  maxFiles: 5,
  maxSize: 10 * 1024 * 1024 // 10MB
})
```

### Field Groups

```tsx
createFieldGroup({
  title: 'Personal Information',
  description: 'Basic details about yourself',
  columns: 2,
  collapsible: true,
  fields: [
    createTextField({ name: 'firstName', label: 'First Name' }),
    createTextField({ name: 'lastName', label: 'Last Name' }),
    createEmailField({ name: 'email', label: 'Email' })
  ]
})
```

## 🔄 Advanced Features (TanStack Form)

### Multi-Step Forms

```tsx
<TanStackMultiStepForm
  schema={schema}
  steps={[
    {
      title: 'Basic Information',
      description: 'Tell us about yourself',
      fields: [
        createTextField({ name: 'name', label: 'Name', required: true }),
        createEmailField({ name: 'email', label: 'Email', required: true })
      ]
    },
    {
      title: 'Preferences',
      description: 'Your preferences',
      fields: [
        createSelectField({ name: 'theme', label: 'Theme', options: themeOptions })
      ]
    }
  ]}
  onSubmit={handleSubmit}
  showProgress={true}
/>
```

### Dynamic Field Arrays

```tsx
<TanStackDynamicArrayField
  name="teamMembers"
  label="Team Members"
  fieldTemplate={(index) => ({
    name: `teamMembers.${index}.name`,
    label: `Member ${index + 1} Name`,
    required: true
  })}
  minItems={1}
  maxItems={10}
  addButtonText="Add Team Member"
  removeButtonText="Remove"
/>
```

### Conditional Fields

```tsx
createTextField({
  name: 'companyName',
  label: 'Company Name',
  condition: (values) => values.userType === 'business'
})
```

### Auto-Save

```tsx
<TanStackFormFactory
  autoSave={{
    enabled: true,
    interval: 30000, // 30 seconds
    onSave: (values) => {
      console.log('Auto-saving:', values)
      // Save to localStorage or API
    }
  }}
/>
```

## 🧪 Validation System

### Built-in Validators

```tsx
import { tanstackValidation } from '@promptliano/ui/forms/tanstack'

const schema = z.object({
  name: tanstackValidation.name,
  email: tanstackValidation.email,
  password: tanstackValidation.password,
  age: tanstackValidation.positiveNumber,
  website: tanstackValidation.url,
  tags: tanstackValidation.tags,
  dueDate: tanstackValidation.futureDate
})
```

### Custom Validation

```tsx
// Synchronous validation
const customField = z.string().refine(
  value => value.includes('special'),
  'Must contain "special"'
)

// Asynchronous validation
const uniqueEmail = z.string().email().refine(
  async (email) => {
    const exists = await checkEmailExists(email)
    return !exists
  },
  'Email already in use'
)

// Cross-field validation
const passwordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string()
}).refine(
  data => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword']
  }
)
```

### Pre-built Patterns

```tsx
import { tanstackPatterns } from '@promptliano/ui/forms/tanstack'

// Use complete patterns
const userProfileSchema = tanstackPatterns.userProfile
const contactFormSchema = tanstackPatterns.contactForm
const projectFormSchema = tanstackPatterns.projectForm
const loginFormSchema = tanstackPatterns.loginForm
const registrationSchema = tanstackPatterns.registrationForm
```

## 🎛️ Configuration & Customization

### Form Layout

```tsx
<HybridFormFactory
  layout={{
    columns: 2,              // Responsive grid
    spacing: 'lg',           // 'sm' | 'md' | 'lg'
    showCard: true,          // Wrap in card
    direction: 'vertical'    // 'horizontal' | 'vertical'
  }}
/>
```

### Button Configuration

```tsx
<HybridFormFactory
  submitButton={{
    text: 'Create Account',
    loadingText: 'Creating...',
    variant: 'default',
    icon: PlusIcon,
    fullWidth: true
  }}
  cancelButton={{
    text: 'Cancel',
    variant: 'outline',
    onClick: handleCancel
  }}
/>
```

### Styling & Theming

```tsx
<HybridFormFactory
  styling={{
    className: 'my-form',
    containerClassName: 'form-container',
    fieldClassName: 'form-field'
  }}
/>
```

## 🧭 Migration Guide

### When to Migrate

| Current Setup | Recommendation | Effort |
|---------------|----------------|--------|
| < 5 fields, basic validation | Keep FormFactory | None |
| 5-10 fields, moderate complexity | Consider TanStack | Low |
| > 15 fields, advanced features | Migrate to TanStack | Medium |
| Dynamic arrays, multi-step | Migrate to TanStack | High |

### Migration Steps

1. **Assessment**: Use `HybridFormFactory` with `showComplexityAnalysis={true}`
2. **Testing**: Enable `migrationMode={true}` for side-by-side comparison
3. **Gradual Migration**: Start with `forceImplementation="tanstack"`
4. **Validation**: Test all form functionality thoroughly
5. **Deployment**: Monitor performance and user experience

### Migration Helper

```tsx
import { generateMigrationGuide, getFormImplementationDecision } from '@promptliano/ui/forms'

// Get automated recommendation
const decision = getFormImplementationDecision({
  fieldCount: 12,
  hasArrayFields: true,
  hasConditionalLogic: true,
  hasComplexValidation: false,
  needsAutoSave: true,
  isMultiStep: false,
  performanceRequired: true
})
// Returns: 'tanstack' or 'original'

// Get detailed migration guide
const guide = generateMigrationGuide(formConfig)
console.log(guide.recommendation) // 'upgrade-to-tanstack'
console.log(guide.benefits)      // ['Better performance', ...]
console.log(guide.migrationSteps) // ['Step 1: ...', ...]
```

## 📚 Examples

### Simple Contact Form

```tsx
import { HybridFormFactory, createTextField, createEmailField } from '@promptliano/ui/forms'

function ContactForm() {
  return (
    <HybridFormFactory
      schema={contactSchema}
      fields={[
        createTextField({ name: 'name', label: 'Name', required: true }),
        createEmailField({ name: 'email', label: 'Email', required: true }),
        createTextareaField({ name: 'message', label: 'Message', required: true })
      ]}
      onSubmit={(data) => sendMessage(data)}
      forceImplementation="original" // Simple enough for FormFactory
    />
  )
}
```

### Complex Project Setup

```tsx
import { TanStackFormFactory, createTanStackFieldGroup } from '@promptliano/ui/forms/tanstack'

function ProjectSetupForm() {
  return (
    <TanStackFormFactory
      schema={projectSchema}
      fieldGroups={[
        createTanStackFieldGroup({
          title: 'Basic Info',
          fields: [
            createTanStackTextField({ name: 'name', label: 'Project Name' }),
            createTanStackSelectField({ name: 'category', label: 'Category', options: categoryOptions })
          ]
        }),
        createTanStackFieldGroup({
          title: 'Team',
          fields: [
            // Dynamic array of team members
          ]
        })
      ]}
      features={{
        conditionalFields: true,
        autoSave: true,
        crossFieldValidation: true
      }}
      onSubmit={(data) => createProject(data)}
    />
  )
}
```

### Adaptive Form (Recommended)

```tsx
function AdaptiveApplicationForm() {
  return (
    <HybridFormFactory
      schema={applicationSchema}
      fields={applicationFields}
      onSubmit={(data) => submitApplication(data)}
      features={{
        conditionalFields: true,    // Triggers TanStack if needed
        fieldDependencies: false,
        autoSave: false
      }}
      showComplexityAnalysis={true} // Shows decision in dev mode
      migrationMode={false}         // Set to true to compare both
    />
  )
}
```

## 🔍 Development Tools

### Complexity Analysis

Enable in development to see form complexity decisions:

```tsx
<HybridFormFactory
  showComplexityAnalysis={true} // Only in development
  // Shows: "Using TanStack Form (complexity score: 6)"
/>
```

### Side-by-Side Comparison

Test both implementations simultaneously:

```tsx
<HybridFormFactory
  migrationMode={true}
  // Renders both FormFactory and TanStack Form side by side
/>
```

### Performance Monitoring

```tsx
<TanStackFormFactory
  onSubmit={(data) => {
    console.time('Form Submission')
    submitData(data).then(() => {
      console.timeEnd('Form Submission')
    })
  }}
/>
```

## ⚡ Performance Considerations

### Bundle Size Impact

| Implementation | Gzipped Size | Best For |
|----------------|--------------|----------|
| FormFactory only | ~15KB | Simple forms, size-critical |
| TanStack Form only | ~25KB | Complex forms, feature-rich |
| Hybrid (both) | ~35KB | Mixed complexity, flexibility |

### Rendering Performance

- **FormFactory**: Faster initial render, good for simple forms
- **TanStack Form**: Better with >15 fields, field-level reactivity
- **Hybrid**: Automatic optimization based on complexity

### Memory Usage

- **FormFactory**: Lower memory footprint for simple forms
- **TanStack Form**: More efficient with complex state management
- **Auto-save**: Minimal impact with debounced updates

## 🎯 Best Practices

### 1. Form Design

- ✅ **Progressive disclosure**: Hide advanced options initially
- ✅ **Logical grouping**: Group related fields together
- ✅ **Clear validation**: Provide immediate, helpful feedback
- ✅ **Save states**: Auto-save long forms, show save indicators

### 2. Performance

- ✅ **Lazy loading**: Load complex forms on demand
- ✅ **Field virtualization**: Use TanStack for many fields
- ✅ **Debounced validation**: Avoid excessive API calls
- ✅ **Smart defaults**: Pre-fill common values

### 3. User Experience

- ✅ **Loading states**: Show progress during submission
- ✅ **Error recovery**: Clear error messages and retry options
- ✅ **Accessibility**: Full keyboard navigation, screen reader support
- ✅ **Mobile optimization**: Touch-friendly, responsive design

### 4. Development

- ✅ **Type safety**: Use Zod schemas for end-to-end types
- ✅ **Component composition**: Build reusable field components
- ✅ **Testing**: Test both happy path and error scenarios
- ✅ **Documentation**: Document complex validation logic

## 🐛 Troubleshooting

### Common Issues

**Form not submitting**
```tsx
// Check validation errors
const form = useFormContext()
console.log(form.formState.errors)
```

**Performance issues with many fields**
```tsx
// Switch to TanStack Form
<HybridFormFactory forceImplementation="tanstack" />
```

**Conditional fields not updating**
```tsx
// Ensure proper dependencies
createTextField({
  name: 'field',
  condition: (values) => values.trigger === 'show'
})
```

**Validation not working**
```tsx
// Check schema definition
const schema = z.object({
  field: z.string().min(1, 'Required') // Clear error message
})
```

### Debug Mode

```tsx
<HybridFormFactory
  showComplexityAnalysis={true}
  migrationMode={true}
  onError={(errors) => console.error('Form errors:', errors)}
/>
```

## 🚀 Future Roadmap

- [ ] **React 19 Support**: Leverage new concurrent features
- [ ] **AI Form Generation**: Auto-generate forms from descriptions
- [ ] **Advanced Analytics**: Track form completion rates and bottlenecks
- [ ] **Offline Support**: Forms that work without internet
- [ ] **Real-time Collaboration**: Multiple users editing same form
- [ ] **Voice Input**: Speech-to-text for accessibility
- [ ] **Smart Validation**: ML-powered validation suggestions

## 📖 API Reference

### HybridFormFactory Props

| Prop | Type | Description |
|------|------|-------------|
| `schema` | `z.ZodSchema` | Zod validation schema |
| `fields` | `FieldConfig[]` | Array of field configurations |
| `onSubmit` | `(data: T) => void` | Form submission handler |
| `forceImplementation` | `'original' \| 'tanstack'` | Override automatic selection |
| `features` | `FormFeatures` | Advanced features configuration |
| `showComplexityAnalysis` | `boolean` | Show decision reasoning (dev) |
| `migrationMode` | `boolean` | Side-by-side comparison mode |

### Field Factory Functions

All field factories accept similar base props:

```tsx
interface BaseFieldProps {
  name: string
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}
```

See individual field types for specific props.

## 🤝 Contributing

1. **Form Types**: Add new field types to both implementations
2. **Validation**: Extend validation helpers in `tanstack-validation.tsx`
3. **Examples**: Add real-world examples in `examples/` folder
4. **Tests**: Write comprehensive tests for new features
5. **Documentation**: Update this README with new features

## 📄 License

MIT License - Use freely in your Promptliano applications.

---

**Need Help?** Check the examples in `examples/` or create an issue in the Promptliano repository.