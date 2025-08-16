import { z } from 'zod'

// =============================================
// COMMON VALIDATION SCHEMAS
// =============================================

export const tanstackValidation = {
  // Basic string validations
  required: (message = 'This field is required') => z.string().min(1, message),
  optional: z.string().optional(),
  
  // Email validation
  email: z.string().email('Please enter a valid email address'),
  
  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  
  // Name validation  
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  
  // Description validation
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  
  // URL validation
  url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  
  // Phone validation
  phone: z.string()
    .regex(/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number')
    .optional(),
  
  // Number validations
  positiveNumber: z.number().positive('Must be a positive number'),
  nonNegativeNumber: z.number().min(0, 'Must be zero or greater'),
  integer: z.number().int('Must be a whole number'),
  
  // Date validations
  date: z.date(),
  futureDate: z.date().refine(date => date > new Date(), 'Date must be in the future'),
  pastDate: z.date().refine(date => date < new Date(), 'Date must be in the past'),
  
  // Array validations
  tags: z.array(z.string()).default([]),
  nonEmptyArray: (message = 'At least one item is required') => 
    z.array(z.any()).min(1, message),
  
  // Boolean validation
  boolean: z.boolean(),
  requiredBoolean: (message = 'You must accept this') => 
    z.boolean().refine(val => val === true, message),
  
  // Custom validation helpers
  minLength: (min: number, message?: string) => 
    z.string().min(min, message || `Must be at least ${min} characters`),
  
  maxLength: (max: number, message?: string) => 
    z.string().max(max, message || `Must be no more than ${max} characters`),
  
  length: (exact: number, message?: string) => 
    z.string().length(exact, message || `Must be exactly ${exact} characters`),
  
  regex: (pattern: RegExp, message: string) => 
    z.string().regex(pattern, message),
  
  oneOf: <T extends readonly [string, ...string[]]>(values: T, message?: string) =>
    z.enum(values, { 
      errorMap: () => ({ message: message || `Must be one of: ${values.join(', ')}` })
    }),
  
  // Date range validation
  dateRange: (min: Date, max: Date) => 
    z.date()
      .min(min, `Date must be after ${min.toLocaleDateString()}`)
      .max(max, `Date must be before ${max.toLocaleDateString()}`),
  
  // File validation
  file: z.instanceof(File),
  files: z.array(z.instanceof(File)),
  
  // Image file validation
  imageFile: z.instanceof(File).refine(
    file => file.type.startsWith('image/'),
    'File must be an image'
  ),
  
  // File size validation
  maxFileSize: (maxSize: number) => 
    z.instanceof(File).refine(
      file => file.size <= maxSize,
      `File size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`
    ),
  
  // Multiple file validation
  maxFiles: (max: number) =>
    z.array(z.instanceof(File)).max(max, `Maximum ${max} files allowed`)
}

// =============================================
// COMPLEX VALIDATION PATTERNS
// =============================================

export const tanstackPatterns = {
  // User profile schema
  userProfile: z.object({
    firstName: tanstackValidation.name,
    lastName: tanstackValidation.name,
    email: tanstackValidation.email,
    phone: tanstackValidation.phone,
    bio: tanstackValidation.description,
    website: tanstackValidation.url,
    avatar: tanstackValidation.imageFile.optional()
  }),
  
  // Contact form schema
  contactForm: z.object({
    name: tanstackValidation.name,
    email: tanstackValidation.email,
    subject: tanstackValidation.minLength(5).and(tanstackValidation.maxLength(100)),
    message: tanstackValidation.minLength(10).and(tanstackValidation.maxLength(1000)),
    priority: tanstackValidation.oneOf(['low', 'medium', 'high']),
    subscribe: z.boolean().default(false)
  }),
  
  // Project creation schema
  projectForm: z.object({
    name: tanstackValidation.minLength(1).and(tanstackValidation.maxLength(100)),
    description: tanstackValidation.description,
    category: tanstackValidation.oneOf(['web', 'mobile', 'desktop', 'api', 'library']),
    tags: tanstackValidation.tags,
    isPublic: z.boolean().default(false),
    dueDate: tanstackValidation.futureDate.optional(),
    budget: tanstackValidation.positiveNumber.optional()
  }),
  
  // Login form schema
  loginForm: z.object({
    email: tanstackValidation.email,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().default(false)
  }),
  
  // Registration form schema
  registrationForm: z.object({
    firstName: tanstackValidation.name,
    lastName: tanstackValidation.name,
    email: tanstackValidation.email,
    password: tanstackValidation.password,
    confirmPassword: z.string(),
    agreeToTerms: tanstackValidation.requiredBoolean('You must agree to the terms and conditions')
  }).refine(
    data => data.password === data.confirmPassword,
    {
      message: "Passwords don't match",
      path: ['confirmPassword']
    }
  ),
  
  // Settings form schema
  settingsForm: z.object({
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean()
    }),
    privacy: z.object({
      profilePublic: z.boolean(),
      showEmail: z.boolean(),
      allowMessages: z.boolean()
    }),
    preferences: z.object({
      theme: tanstackValidation.oneOf(['light', 'dark', 'system']),
      language: z.string(),
      timezone: z.string()
    })
  })
}

// =============================================
// DYNAMIC VALIDATION HELPERS
// =============================================

export const tanstackDynamicValidation = {
  // Conditional validation based on other fields
  conditional: <T>(
    condition: (data: any) => boolean,
    schema: z.ZodSchema<T>,
    fallback?: z.ZodSchema<T>
  ) => {
    return z.any().superRefine((data, ctx) => {
      const shouldValidate = condition(data)
      if (shouldValidate) {
        const result = schema.safeParse(data)
        if (!result.success) {
          result.error.issues.forEach(issue => {
            ctx.addIssue(issue)
          })
        }
      } else if (fallback) {
        const result = fallback.safeParse(data)
        if (!result.success) {
          result.error.issues.forEach(issue => {
            ctx.addIssue(issue)
          })
        }
      }
    })
  },
  
  // Cross-field validation
  crossField: <T>(
    validator: (data: T) => boolean | string,
    path: string[]
  ) => {
    return z.any().superRefine((data, ctx) => {
      const result = validator(data)
      if (typeof result === 'string') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result,
          path
        })
      } else if (!result) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Validation failed',
          path
        })
      }
    })
  },
  
  // Async validation
  async: <T>(
    validator: (value: T) => Promise<boolean | string>
  ) => {
    return z.any().superRefine(async (data, ctx) => {
      try {
        const result = await validator(data)
        if (typeof result === 'string') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result
          })
        } else if (!result) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Async validation failed'
          })
        }
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Validation error occurred'
        })
      }
    })
  },
  
  // Unique field validation
  unique: <T>(
    checkUnique: (value: T) => Promise<boolean>,
    message = 'This value must be unique'
  ) => {
    return z.any().superRefine(async (data, ctx) => {
      try {
        const isUnique = await checkUnique(data)
        if (!isUnique) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message
          })
        }
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Unable to verify uniqueness'
        })
      }
    })
  }
}

// =============================================
// FORM SCHEMA UTILITIES
// =============================================

export const tanstackSchemaUtils = {
  // Extract field names from schema
  getFieldNames: <T>(schema: z.ZodSchema<T>): string[] => {
    if (schema instanceof z.ZodObject) {
      return Object.keys(schema.shape)
    }
    return []
  },
  
  // Check if field is required
  isFieldRequired: <T>(schema: z.ZodSchema<T>, fieldName: string): boolean => {
    if (schema instanceof z.ZodObject) {
      const field = schema.shape[fieldName]
      return field && !field.isOptional()
    }
    return false
  },
  
  // Get field schema
  getFieldSchema: <T>(schema: z.ZodSchema<T>, fieldName: string): z.ZodSchema<any> | null => {
    if (schema instanceof z.ZodObject) {
      return schema.shape[fieldName] || null
    }
    return null
  },
  
  // Create partial schema for multi-step forms
  createStepSchema: <T>(schema: z.ZodSchema<T>, fieldNames: string[]): z.ZodSchema<Partial<T>> => {
    if (schema instanceof z.ZodObject) {
      const stepShape: Record<string, any> = {}
      fieldNames.forEach(fieldName => {
        if (schema.shape[fieldName]) {
          stepShape[fieldName] = schema.shape[fieldName]
        }
      })
      return z.object(stepShape).partial() as unknown as z.ZodSchema<Partial<T>>
    }
    return z.object({}).partial() as unknown as z.ZodSchema<Partial<T>>
  },
  
  // Merge multiple schemas
  mergeSchemas: <T extends Record<string, any>>(...schemas: z.ZodSchema<any>[]): z.ZodSchema<T> => {
    return schemas.reduce((merged, current) => {
      if (merged instanceof z.ZodObject && current instanceof z.ZodObject) {
        return merged.merge(current)
      }
      return merged
    }, schemas[0])
  }
}

// =============================================
// ERROR FORMATTING UTILITIES
// =============================================

export const tanstackErrorUtils = {
  // Format Zod errors for display
  formatErrors: (error: z.ZodError): Record<string, string[]> => {
    const formattedErrors: Record<string, string[]> = {}
    
    error.issues.forEach(issue => {
      const path = issue.path.join('.')
      if (!formattedErrors[path]) {
        formattedErrors[path] = []
      }
      formattedErrors[path].push(issue.message)
    })
    
    return formattedErrors
  },
  
  // Get first error message for field
  getFirstError: (errors: Record<string, string[]>, fieldName: string): string | null => {
    const fieldErrors = errors[fieldName]
    return fieldErrors && fieldErrors.length > 0 ? fieldErrors[0] : null
  },
  
  // Check if field has errors
  hasError: (errors: Record<string, string[]>, fieldName: string): boolean => {
    return errors[fieldName] && errors[fieldName].length > 0
  },
  
  // Get all error messages as flat array
  getAllErrors: (errors: Record<string, string[]>): string[] => {
    return Object.values(errors).flat()
  }
}

export default {
  validation: tanstackValidation,
  patterns: tanstackPatterns,
  dynamic: tanstackDynamicValidation,
  schema: tanstackSchemaUtils,
  errors: tanstackErrorUtils
}