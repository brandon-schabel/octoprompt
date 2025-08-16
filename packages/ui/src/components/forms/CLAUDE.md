# Hybrid Form System Guide

## Overview

Promptliano's form system combines FormFactory (simple forms) with TanStack Form (complex forms) via HybridFormFactory, which intelligently selects the best implementation based on form complexity.

- **FormFactory**: Best for simple forms (<10 fields, basic validation)
- **TanStack Form**: Ideal for complex forms (>15 fields, dynamic/conditional logic)
- **HybridFormFactory**: Recommended default - auto-selects based on analysis

Benefits:

- 75% boilerplate reduction
- Type-safe with Zod
- Consistent shadcn/ui styling
- Automatic complexity-based optimization

## Quick Decision Guide

From README.md and hybrid-form-factory.tsx analysis:

```
Form Fields < 10 + Basic Validation → FormFactory
Form Fields > 15 + Advanced Features → TanStack Form
Dynamic/Conditional Logic → TanStack Form
Multi-step Workflows → TanStack Form
Performance Critical → TanStack Form
Unsure? → Use HybridFormFactory
```

Complexity score (from analyzeFormComplexity):

- Score <4: FormFactory
- Score >=4: TanStack Form

Factors increasing score: field count, complex types, conditional fields, auto-save, multi-step, etc.

## Quick Start

Use HybridFormFactory for automatic selection:

```tsx
import { HybridFormFactory, createTextField } from '@promptliano/ui/forms' // Adjust import if needed
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required')
})

function SimpleForm() {
  return (
    <HybridFormFactory
      schema={schema}
      fields={[
        createTextField({
          name: 'name',
          label: 'Name',
          placeholder: 'Enter your name',
          required: true
        })
      ]}
      onSubmit={(data) => console.log('Submitted:', data)}
      submitButton={{ text: 'Submit' }}
    />
  )
}
```

For complex forms, add features to trigger TanStack:

```tsx
<HybridFormFactory
  // ... other props
  features={{ conditionalFields: true, multiStep: true }}
/>
```

Force implementation if needed:

```tsx
<HybridFormFactory forceImplementation="tanstack" />
```

## Examples

See examples/ folder for comprehensive demos:

- simple-forms.tsx: Basic contact, login, settings forms using FormFactory
- complex-forms.tsx: Multi-step, dynamic, conditional forms using TanStack
- hybrid-forms.tsx: Migration examples and side-by-side comparisons

These demonstrate real-world usage and best practices.

## FormFactory (Simple Forms)

From form-factory.tsx: Use for basic forms.

Example from examples/simple-forms.tsx:

```tsx
// Simple contact form
<FormFactory
  schema={contactSchema}
  fields={[
    createTextField({ name: 'name', label: 'Name' }),
    createEmailField({ name: 'email', label: 'Email' })
  ]}
  onSubmit={handleSubmit}
/>
```

Best for: <10 fields, static structure.

## TanStack Form (Advanced Forms)

From tanstack/tanstack-form-factory.tsx: Use for complex scenarios.

Example from examples/complex-forms.tsx:

```tsx
// Multi-step form
<TanStackFormFactory
  schema={complexSchema}
  fields={complexFields}
  features={{ multiStep: true }}
  onSubmit={handleSubmit}
/>
```

Best for: Dynamic arrays, conditionals, auto-save.

## Field Types

Fields work with both implementations via converters in hybrid-form-factory.tsx. Use create*Field functions.

Examples:

- Text: createTextField({ name: 'title', maxLength: 100 })
- Select: createSelectField({ name: 'category', options: [...] })
- Tags: createTagsField({ name: 'tags', maxTags: 10 })

See examples/ for more.

## Form Configuration

Merged props for HybridFormFactory (extends both):

- schema: Zod schema
- fields: FieldConfig[]
- onSubmit: (data) => void
- features: { conditionalFields?: boolean, autoSave?: boolean, ... }
- layout: { columns?: number, spacing?: 'md' }
- submitButton: { text?: string, variant?: 'default' }

For TanStack-specific: tanstackConfig prop in Hybrid.

## Pre-built Patterns

From README.md and examples/:

- loginForm()
- profileForm()
- projectForm()

Use with HybridFormFactory.

## Migration Guide

From README.md and hybrid-form-factory.tsx:

1. Use HybridFormFactory with showComplexityAnalysis={true} to assess.
2. Enable migrationMode={true} for side-by-side comparison.
3. If complex, set forceImplementation="tanstack".
4. Use generateMigrationGuide(config) for steps.

Example targets: ProjectCreateForm, TicketEditForm, etc.

## Performance

- FormFactory: Faster for simple forms
- TanStack: Better for complex state
- Hybrid: Optimal auto-selection

## Testing & Accessibility

Full ARIA support, keyboard navigation. Test examples from examples/.

## Contributing

Extend fields in form-factory.tsx and tanstack/, update converters in hybrid.
