import React, { ReactNode } from 'react'
import { useField } from '@tanstack/react-form'
import { z } from 'zod'
import { useTanStackFormContext } from './tanstack-form'
import { cn } from '../../../utils'
import { Label } from '../../core/label'
import { Input } from '../../core/input'
import { Textarea } from '../../core/textarea'
import { Button } from '../../core/button'
import { Checkbox } from '../../core/checkbox'
import { Switch } from '../../core/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../core/select'
import { RadioGroup, RadioGroupItem } from '../../core/radio-group'
import { Badge } from '../../core/badge'
import { Calendar } from '../../core/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../../core/popover'
import { CalendarIcon, Eye, EyeOff, X, Plus } from 'lucide-react'
import { format } from 'date-fns'

// =============================================
// TANSTACK FIELD TYPES
// =============================================

export type FieldType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'number' 
  | 'textarea' 
  | 'select'
  | 'checkbox' 
  | 'switch' 
  | 'radio' 
  | 'date'
  | 'tags'
  | 'file'
  | 'custom'

export interface BaseFieldProps {
  name: string
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  
  // Layout
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  
  // Validation
  validator?: z.ZodSchema<any>
  customValidation?: (value: any) => string | undefined
  
  // Help text
  helpText?: ReactNode
  errorClassName?: string
  
  // Conditional rendering
  condition?: (formValues: any) => boolean
}

export interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'number'
  maxLength?: number
  minLength?: number
  showCount?: boolean
  autoComplete?: string
  pattern?: string
}

export interface TextareaFieldProps extends BaseFieldProps {
  rows?: number
  maxLength?: number
  showCount?: boolean
  autoResize?: boolean
}

export interface SelectFieldProps extends BaseFieldProps {
  options: Array<{
    value: string
    label: string
    description?: string
    disabled?: boolean
  }>
  multiple?: boolean
  searchable?: boolean
}

export interface CheckboxFieldProps extends BaseFieldProps {
  indeterminate?: boolean
}

export interface SwitchFieldProps extends BaseFieldProps {
  // Switch-specific props
}

export interface RadioFieldProps extends BaseFieldProps {
  options: Array<{
    value: string
    label: string
    description?: string
    disabled?: boolean
  }>
  orientation?: 'horizontal' | 'vertical'
}

export interface DateFieldProps extends BaseFieldProps {
  minDate?: Date
  maxDate?: Date
  dateFormat?: string
  showTime?: boolean
}

export interface TagsFieldProps extends BaseFieldProps {
  maxTags?: number
  suggestions?: string[]
  allowCustom?: boolean
  separator?: string | RegExp
}

export interface FileFieldProps extends BaseFieldProps {
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSize?: number
  showPreview?: boolean
}

export interface CustomFieldProps extends BaseFieldProps {
  render: (props: {
    value: any
    onChange: (value: any) => void
    onBlur: () => void
    error?: string
    disabled?: boolean
  }) => ReactNode
}

export type FieldProps = 
  | ({ fieldType: 'text' } & TextFieldProps)
  | ({ fieldType: 'textarea' } & TextareaFieldProps) 
  | ({ fieldType: 'select' } & SelectFieldProps)
  | ({ fieldType: 'checkbox' } & CheckboxFieldProps)
  | ({ fieldType: 'switch' } & SwitchFieldProps)
  | ({ fieldType: 'radio' } & RadioFieldProps)
  | ({ fieldType: 'date' } & DateFieldProps)
  | ({ fieldType: 'tags' } & TagsFieldProps)
  | ({ fieldType: 'file' } & FileFieldProps)
  | ({ fieldType: 'custom' } & CustomFieldProps)

// =============================================
// TANSTACK FIELD COMPONENT
// =============================================

export function TanStackField(props: FieldProps) {
  const { 
    name, 
    label, 
    description, 
    required, 
    disabled, 
    className,
    fullWidth = true,
    size = 'md',
    helpText,
    errorClassName,
    condition
  } = props

  // Get form from context
  const form = useTanStackFormContext()
  
  const field = form.useField({
    name,
    validators: props.validator ? {
      onChange: props.validator,
      onBlur: props.validator
    } : undefined
  })

  // Conditional rendering
  if (condition && !condition(field.form.state.values)) {
    return null
  }

  const hasError = field.state.meta.errors.length > 0
  const errorMessage = field.state.meta.errors[0]

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base', 
    lg: 'text-lg'
  }

  const baseFieldClasses = cn(
    sizeClasses[size],
    fullWidth && 'w-full',
    hasError && 'border-destructive',
    className
  )

  return (
    <div className={cn('space-y-2', fullWidth && 'w-full')}>
      {/* Label */}
      {label && (
        <Label 
          htmlFor={name}
          className={cn(
            'text-sm font-medium',
            required && "after:content-['*'] after:ml-0.5 after:text-destructive",
            disabled && 'opacity-50'
          )}
        >
          {label}
        </Label>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Field Input */}
      <div className="space-y-1">
        {renderFieldInput()}
        
        {/* Error Message */}
        {hasError && (
          <p className={cn('text-xs text-destructive', errorClassName)}>
            {errorMessage}
          </p>
        )}
        
        {/* Help Text */}
        {helpText && !hasError && (
          <div className="text-xs text-muted-foreground">
            {helpText}
          </div>
        )}
      </div>
    </div>
  )

  function renderFieldInput() {
    switch (props.fieldType) {
      case 'text':
        return <TextFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'textarea':
        return <TextareaFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'select':
        return <SelectFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'checkbox':
        return <CheckboxFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'switch':
        return <SwitchFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'radio':
        return <RadioFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'date':
        return <DateFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'tags':
        return <TagsFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'file':
        return <FileFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      case 'custom':
        return <CustomFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
      default:
        return <TextFieldInput {...(props as any)} field={field} className={baseFieldClasses} />
    }
  }
}

// =============================================
// FIELD INPUT COMPONENTS
// =============================================

function TextFieldInput({ 
  type = 'text', 
  placeholder, 
  maxLength, 
  showCount,
  autoComplete,
  pattern,
  disabled,
  field,
  className
}: TextFieldProps & { field: any; className: string }) {
  const [showPassword, setShowPassword] = React.useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  const currentLength = field.state.value?.toString().length || 0

  return (
    <div className="relative">
      <Input
        id={field.name}
        name={field.name}
        type={inputType}
        placeholder={placeholder}
        value={field.state.value || ''}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        disabled={disabled}
        className={className}
        maxLength={maxLength}
        autoComplete={autoComplete}
        pattern={pattern}
      />
      
      {/* Password Toggle */}
      {isPassword && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      )}
      
      {/* Character Count */}
      {showCount && maxLength && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {currentLength}/{maxLength}
        </div>
      )}
    </div>
  )
}

function TextareaFieldInput({ 
  placeholder, 
  rows = 4, 
  maxLength, 
  showCount,
  autoResize,
  disabled,
  field,
  className
}: TextareaFieldProps & { field: any; className: string }) {
  const currentLength = field.state.value?.length || 0

  return (
    <div className="relative">
      <Textarea
        id={field.name}
        name={field.name}
        placeholder={placeholder}
        value={field.state.value || ''}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        disabled={disabled}
        className={className}
        rows={rows}
        maxLength={maxLength}
      />
      
      {showCount && maxLength && (
        <div className="absolute right-2 bottom-2 text-xs text-muted-foreground bg-background px-1">
          {currentLength}/{maxLength}
        </div>
      )}
    </div>
  )
}

function SelectFieldInput({ 
  options, 
  placeholder,
  multiple,
  disabled,
  field,
  className
}: SelectFieldProps & { field: any; className: string }) {
  return (
    <Select
      value={field.state.value || ''}
      onValueChange={(value) => field.handleChange(value)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            <div>
              <div>{option.label}</div>
              {option.description && (
                <div className="text-xs text-muted-foreground">
                  {option.description}
                </div>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CheckboxFieldInput({ 
  indeterminate,
  disabled,
  field,
  className
}: CheckboxFieldProps & { field: any; className: string }) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={field.name}
        checked={field.state.value || false}
        onCheckedChange={(checked) => field.handleChange(checked)}
        disabled={disabled}
        className={className}
      />
    </div>
  )
}

function SwitchFieldInput({ 
  disabled,
  field,
  className
}: SwitchFieldProps & { field: any; className: string }) {
  return (
    <Switch
      id={field.name}
      checked={field.state.value || false}
      onCheckedChange={(checked) => field.handleChange(checked)}
      disabled={disabled}
      className={className}
    />
  )
}

function RadioFieldInput({ 
  options,
  orientation = 'vertical',
  disabled,
  field,
  className
}: RadioFieldProps & { field: any; className: string }) {
  return (
    <RadioGroup
      value={field.state.value || ''}
      onValueChange={(value) => field.handleChange(value)}
      disabled={disabled}
      className={cn(
        orientation === 'horizontal' ? 'flex space-x-4' : 'space-y-2',
        className
      )}
    >
      {options.map((option) => (
        <div key={option.value} className="flex items-center space-x-2">
          <RadioGroupItem value={option.value} id={`${field.name}-${option.value}`} />
          <Label htmlFor={`${field.name}-${option.value}`} className="text-sm">
            <div>
              <div>{option.label}</div>
              {option.description && (
                <div className="text-xs text-muted-foreground">
                  {option.description}
                </div>
              )}
            </div>
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}

function DateFieldInput({ 
  minDate,
  maxDate,
  dateFormat = 'PPP',
  placeholder,
  disabled,
  field,
  className
}: DateFieldProps & { field: any; className: string }) {
  const [isOpen, setIsOpen] = React.useState(false)
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !field.state.value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {field.state.value ? format(field.state.value, dateFormat) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={field.state.value}
          onSelect={(date) => {
            field.handleChange(date)
            setIsOpen(false)
          }}
          disabled={(date) =>
            Boolean((minDate && date < minDate) ||
            (maxDate && date > maxDate))
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function TagsFieldInput({ 
  maxTags,
  suggestions = [],
  allowCustom = true,
  separator = /[,\n]/,
  placeholder,
  disabled,
  field,
  className
}: TagsFieldProps & { field: any; className: string }) {
  const [inputValue, setInputValue] = React.useState('')
  const tags = field.state.value || []

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (!trimmedTag || tags.includes(trimmedTag)) return
    if (maxTags && tags.length >= maxTags) return
    
    field.handleChange([...tags, trimmedTag])
    setInputValue('')
  }

  const handleRemoveTag = (index: number) => {
    field.handleChange(tags.filter((_: string, i: number) => i !== index))
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (inputValue.trim()) {
        handleAddTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags.length - 1)
    }
  }

  return (
    <div className="space-y-2">
      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-1 h-auto p-0 hover:bg-transparent"
                onClick={() => handleRemoveTag(index)}
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
      
      {/* Input */}
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        disabled={disabled || (maxTags ? tags.length >= maxTags : false)}
        className={className}
      />
      
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions
            .filter(suggestion => !tags.includes(suggestion))
            .slice(0, 5)
            .map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => handleAddTag(suggestion)}
                disabled={disabled || (maxTags ? tags.length >= maxTags : false)}
              >
                <Plus className="w-3 h-3 mr-1" />
                {suggestion}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}

function FileFieldInput({ 
  accept,
  multiple,
  maxFiles,
  maxSize,
  showPreview,
  disabled,
  field,
  className
}: FileFieldProps & { field: any; className: string }) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    field.handleChange(multiple ? files : files[0])
  }

  return (
    <Input
      type="file"
      accept={accept}
      multiple={multiple}
      onChange={handleFileChange}
      disabled={disabled}
      className={className}
    />
  )
}

function CustomFieldInput({ 
  render,
  disabled,
  field
}: CustomFieldProps & { field: any; className: string }) {
  return render({
    value: field.state.value,
    onChange: field.handleChange,
    onBlur: field.handleBlur,
    error: field.state.meta.errors[0],
    disabled
  })
}

export default TanStackField