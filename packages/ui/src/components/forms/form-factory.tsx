import * as React from 'react'
import { useForm, UseFormReturn, FieldPath, Control, ControllerRenderProps } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '../../utils'
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField
} from '../core/form'
import { Input } from '../core/input'
import { Textarea } from '../core/textarea'
import { Button } from '../core/button'
import { Checkbox } from '../core/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../core/select'
import { RadioGroup, RadioGroupItem } from '../core/radio-group'
import { Switch } from '../core/switch'
import { Label } from '../core/label'
import { Calendar } from '../core/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../core/popover'
import { Badge } from '../core/badge'
import { Separator } from '../core/separator'
import { CalendarIcon, Loader2, Plus, X, Eye, EyeOff } from 'lucide-react'
import { format } from 'date-fns'

// =============================================
// FORM FIELD TYPES & CONFIGURATIONS
// =============================================

export interface BaseFieldConfig {
  name: string
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    custom?: (value: any) => string | boolean
  }
}

export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text'
  multiline?: boolean
  rows?: number
  maxLength?: number
  showCount?: boolean
  autoComplete?: string
}

export interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number'
  min?: number
  max?: number
  step?: number
  currency?: boolean
  percentage?: boolean
}

export interface PasswordFieldConfig extends BaseFieldConfig {
  type: 'password'
  showToggle?: boolean
  strength?: boolean
  autoComplete?: string
}

export interface EmailFieldConfig extends BaseFieldConfig {
  type: 'email'
  autoComplete?: string
  validation?: BaseFieldConfig['validation'] & {
    allowPlusSymbol?: boolean
  }
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select'
  options: Array<{ value: string; label: string; disabled?: boolean }>
  searchable?: boolean
  multiple?: boolean
  allowCustom?: boolean
}

export interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox'
  variant?: 'default' | 'card'
}

export interface RadioFieldConfig extends BaseFieldConfig {
  type: 'radio'
  options: Array<{ value: string; label: string; description?: string }>
  orientation?: 'horizontal' | 'vertical'
}

export interface SwitchFieldConfig extends BaseFieldConfig {
  type: 'switch'
  size?: 'default' | 'sm' | 'lg'
}

export interface DateFieldConfig extends BaseFieldConfig {
  type: 'date'
  showTime?: boolean
  dateFormat?: string
  minDate?: Date
  maxDate?: Date
  disabledDates?: (date: Date) => boolean
}

export interface FileFieldConfig extends BaseFieldConfig {
  type: 'file'
  accept?: string
  multiple?: boolean
  maxSize?: number // in bytes
  maxFiles?: number
  showPreview?: boolean
}

export interface TagsFieldConfig extends BaseFieldConfig {
  type: 'tags'
  maxTags?: number
  suggestions?: string[]
  allowCustom?: boolean
  validation?: BaseFieldConfig['validation'] & {
    tagPattern?: RegExp
  }
}

export interface FieldGroupConfig {
  type: 'group'
  title?: string
  description?: string
  fields: FieldConfig[]
  collapsible?: boolean
  defaultExpanded?: boolean
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export interface FieldArrayConfig extends BaseFieldConfig {
  type: 'array'
  itemSchema: FieldConfig
  minItems?: number
  maxItems?: number
  addButtonText?: string
  removeButtonText?: string
  reorderable?: boolean
}

export type FieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | PasswordFieldConfig
  | EmailFieldConfig
  | SelectFieldConfig
  | CheckboxFieldConfig
  | RadioFieldConfig
  | SwitchFieldConfig
  | DateFieldConfig
  | FileFieldConfig
  | TagsFieldConfig
  | FieldGroupConfig
  | FieldArrayConfig

// =============================================
// FORM FACTORY CONFIGURATION
// =============================================

export interface FormConfig<T extends z.ZodType> {
  schema: T
  fields: FieldConfig[]
  defaultValues?: Partial<z.infer<T>>
  mode?: 'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all'
  reValidateMode?: 'onChange' | 'onBlur' | 'onSubmit'
  submitButton?: {
    text?: string
    loadingText?: string
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    icon?: React.ComponentType<{ className?: string }>
    fullWidth?: boolean
  }
  cancelButton?: {
    text?: string
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    size?: 'default' | 'sm' | 'lg' | 'icon'
  }
  layout?: {
    columns?: 1 | 2 | 3 | 4
    spacing?: 'sm' | 'md' | 'lg'
    direction?: 'horizontal' | 'vertical'
  }
  styling?: {
    className?: string
    containerClassName?: string
    fieldClassName?: string
    buttonContainerClassName?: string
  }
  features?: {
    showErrors?: boolean
    showProgress?: boolean
    autoSave?: boolean
    resetOnSubmit?: boolean
    validateOnMount?: boolean
  }
}

export interface FormFactoryProps<T extends z.ZodType> extends FormConfig<T> {
  onSubmit: (data: z.infer<T>) => void | Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  isDisabled?: boolean
  children?: React.ReactNode
}

// =============================================
// FIELD RENDERER COMPONENTS
// =============================================

interface FieldRendererProps<T extends z.ZodType> {
  config: FieldConfig
  form: UseFormReturn<z.infer<T>>
  isDisabled?: boolean
}

const TextFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: TextFieldConfig }) => {
  const [charCount, setCharCount] = React.useState(0)

  return (
    <FormField
      control={form.control}
      name={config.name as FieldPath<z.infer<T>>}
      render={({ field }) => {
        React.useEffect(() => {
          setCharCount(String(field.value || '').length)
        }, [field.value])

        return (
          <FormItem className={config.className}>
            <div className="flex items-center justify-between">
              <FormLabel>{config.label}</FormLabel>
              {config.showCount && config.maxLength && (
                <span
                  className={cn(
                    'text-xs',
                    charCount > config.maxLength * 0.9 ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {charCount}/{config.maxLength}
                </span>
              )}
            </div>
            <FormControl>
              {config.multiline ? (
                <Textarea
                  {...field}
                  placeholder={config.placeholder}
                  disabled={isDisabled || config.disabled}
                  rows={config.rows || 3}
                  maxLength={config.maxLength}
                  className="resize-none"
                />
              ) : (
                <Input
                  {...field}
                  type="text"
                  placeholder={config.placeholder}
                  disabled={isDisabled || config.disabled}
                  autoComplete={config.autoComplete}
                  maxLength={config.maxLength}
                />
              )}
            </FormControl>
            {config.description && <FormDescription>{config.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const NumberFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: NumberFieldConfig }) => (
  <FormField
    control={form.control}
    name={config.name as FieldPath<z.infer<T>>}
    render={({ field }) => (
      <FormItem className={config.className}>
        <FormLabel>{config.label}</FormLabel>
        <FormControl>
          <div className="relative">
            {config.currency && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            )}
            <Input
              {...field}
              type="number"
              placeholder={config.placeholder}
              disabled={isDisabled || config.disabled}
              min={config.min}
              max={config.max}
              step={config.step}
              className={cn(config.currency && 'pl-8', config.percentage && 'pr-8')}
              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : '')}
            />
            {config.percentage && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            )}
          </div>
        </FormControl>
        {config.description && <FormDescription>{config.description}</FormDescription>}
        <FormMessage />
      </FormItem>
    )}
  />
)

const PasswordFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: PasswordFieldConfig }) => {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <FormField
      control={form.control}
      name={config.name as FieldPath<z.infer<T>>}
      render={({ field }) => (
        <FormItem className={config.className}>
          <FormLabel>{config.label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                type={showPassword ? 'text' : 'password'}
                placeholder={config.placeholder}
                disabled={isDisabled || config.disabled}
              />
              {config.showToggle && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isDisabled || config.disabled}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </FormControl>
          {config.description && <FormDescription>{config.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

const SelectFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: SelectFieldConfig }) => (
  <FormField
    control={form.control}
    name={config.name as FieldPath<z.infer<T>>}
    render={({ field }) => (
      <FormItem className={config.className}>
        <FormLabel>{config.label}</FormLabel>
        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isDisabled || config.disabled}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={config.placeholder || 'Select an option'} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {config.options.map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config.description && <FormDescription>{config.description}</FormDescription>}
        <FormMessage />
      </FormItem>
    )}
  />
)

const CheckboxFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: CheckboxFieldConfig }) => (
  <FormField
    control={form.control}
    name={config.name as FieldPath<z.infer<T>>}
    render={({ field }) => (
      <FormItem className={cn('flex flex-row items-start space-x-3 space-y-0', config.className)}>
        <FormControl>
          <Checkbox
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={isDisabled || config.disabled}
          />
        </FormControl>
        <div className="space-y-1 leading-none">
          <FormLabel className="cursor-pointer">{config.label}</FormLabel>
          {config.description && <FormDescription>{config.description}</FormDescription>}
        </div>
        <FormMessage />
      </FormItem>
    )}
  />
)

const RadioFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: RadioFieldConfig }) => (
  <FormField
    control={form.control}
    name={config.name as FieldPath<z.infer<T>>}
    render={({ field }) => (
      <FormItem className={config.className}>
        <FormLabel>{config.label}</FormLabel>
        <FormControl>
          <RadioGroup
            onValueChange={field.onChange}
            defaultValue={field.value}
            className={cn(
              config.orientation === 'horizontal' ? 'flex flex-row space-x-6' : 'flex flex-col space-y-3'
            )}
            disabled={isDisabled || config.disabled}
          >
            {config.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${config.name}-${option.value}`} />
                <Label
                  htmlFor={`${config.name}-${option.value}`}
                  className="cursor-pointer font-normal"
                >
                  <div>
                    <div>{option.label}</div>
                    {option.description && (
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FormControl>
        {config.description && <FormDescription>{config.description}</FormDescription>}
        <FormMessage />
      </FormItem>
    )}
  />
)

const SwitchFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: SwitchFieldConfig }) => (
  <FormField
    control={form.control}
    name={config.name as FieldPath<z.infer<T>>}
    render={({ field }) => (
      <FormItem className={cn('flex flex-row items-center justify-between rounded-lg border p-4', config.className)}>
        <div className="space-y-0.5">
          <FormLabel className="text-base">{config.label}</FormLabel>
          {config.description && <FormDescription>{config.description}</FormDescription>}
        </div>
        <FormControl>
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={isDisabled || config.disabled}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)

const DateFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: DateFieldConfig }) => {
  const [open, setOpen] = React.useState(false)

  return (
    <FormField
      control={form.control}
      name={config.name as FieldPath<z.infer<T>>}
      render={({ field }) => (
        <FormItem className={cn('flex flex-col', config.className)}>
          <FormLabel>{config.label}</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full pl-3 text-left font-normal',
                    !field.value && 'text-muted-foreground'
                  )}
                  disabled={isDisabled || config.disabled}
                >
                  {field.value ? (
                    format(field.value, config.dateFormat || 'PPP')
                  ) : (
                    <span>{config.placeholder || 'Pick a date'}</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={(date) => {
                  field.onChange(date)
                  setOpen(false)
                }}
                disabled={(date) => {
                  if (config.minDate && date < config.minDate) return true
                  if (config.maxDate && date > config.maxDate) return true
                  if (config.disabledDates) return config.disabledDates(date)
                  return false
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {config.description && <FormDescription>{config.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

const TagsFieldRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: TagsFieldConfig }) => {
  const [inputValue, setInputValue] = React.useState('')

  return (
    <FormField
      control={form.control}
      name={config.name as FieldPath<z.infer<T>>}
      render={({ field }) => {
        const tags = Array.isArray(field.value) ? field.value as string[] : []

        const addTag = (tag: string) => {
          const trimmedTag = tag.trim()
          if (
            trimmedTag &&
            !tags.includes(trimmedTag) &&
            (!config.maxTags || tags.length < config.maxTags)
          ) {
            field.onChange([...tags, trimmedTag])
            setInputValue('')
          }
        }

        const removeTag = (tagToRemove: string) => {
          field.onChange(tags.filter((tag: string) => tag !== tagToRemove))
        }

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag(inputValue)
          } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags[tags.length - 1])
          }
        }

        return (
          <FormItem className={config.className}>
            <FormLabel>{config.label}</FormLabel>
            <FormControl>
              <div className="min-h-[2.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => removeTag(tag)}
                        disabled={isDisabled || config.disabled}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      if (inputValue.trim()) {
                        addTag(inputValue)
                      }
                    }}
                    placeholder={tags.length === 0 ? config.placeholder || 'Add tags...' : ''}
                    className="flex-1 border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
                    disabled={isDisabled || config.disabled}
                  />
                </div>
              </div>
            </FormControl>
            {config.description && <FormDescription>{config.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const FieldGroupRenderer = <T extends z.ZodType>({
  config,
  form,
  isDisabled
}: FieldRendererProps<T> & { config: FieldGroupConfig }) => {
  const [isExpanded, setIsExpanded] = React.useState(config.defaultExpanded ?? true)

  return (
    <div className={cn('space-y-4 rounded-lg border p-4', config.className)}>
      {config.title && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{config.title}</h3>
          {config.collapsible && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          )}
        </div>
      )}
      {config.description && <p className="text-sm text-muted-foreground">{config.description}</p>}
      {(!config.collapsible || isExpanded) && (
        <div
          className={cn(
            'grid gap-4',
            config.columns === 2 && 'grid-cols-1 md:grid-cols-2',
            config.columns === 3 && 'grid-cols-1 md:grid-cols-3',
            config.columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
          )}
        >
          {config.fields.map((fieldConfig, index) => (
            <FieldRenderer
              key={('name' in fieldConfig ? fieldConfig.name : undefined) || index}
              config={fieldConfig}
              form={form}
              isDisabled={isDisabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================
// MAIN FIELD RENDERER
// =============================================

const FieldRenderer = <T extends z.ZodType>({ config, form, isDisabled }: FieldRendererProps<T>) => {
  switch (config.type) {
    case 'text':
      return <TextFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'number':
      return <NumberFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'password':
      return <PasswordFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'email':
      return <TextFieldRenderer config={{ ...config, type: 'text' }} form={form} isDisabled={isDisabled} />
    case 'select':
      return <SelectFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'checkbox':
      return <CheckboxFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'radio':
      return <RadioFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'switch':
      return <SwitchFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'date':
      return <DateFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'tags':
      return <TagsFieldRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'group':
      return <FieldGroupRenderer config={config} form={form} isDisabled={isDisabled} />
    case 'file':
    case 'array':
      // These will be implemented in the next iteration
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/25 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {config.type} field type not yet implemented
          </p>
        </div>
      )
    default:
      return null
  }
}

// =============================================
// FORM FACTORY COMPONENTS
// =============================================

export function FormFactory<T extends z.ZodType>({
  schema,
  fields,
  defaultValues,
  mode = 'onChange',
  reValidateMode = 'onBlur',
  onSubmit,
  onCancel,
  isLoading = false,
  isDisabled = false,
  submitButton,
  cancelButton,
  layout,
  styling,
  features,
  children
}: FormFactoryProps<T>) {
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
    mode,
    reValidateMode
  })

  const handleSubmit = async (data: z.infer<T>) => {
    try {
      await onSubmit(data)
      if (features?.resetOnSubmit) {
        form.reset()
      }
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  return (
    <div className={cn('space-y-6', styling?.containerClassName)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className={cn('space-y-6', styling?.className)}>
          <div
            className={cn(
              'grid gap-6',
              layout?.columns === 2 && 'grid-cols-1 md:grid-cols-2',
              layout?.columns === 3 && 'grid-cols-1 md:grid-cols-3',
              layout?.columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
              layout?.spacing === 'sm' && 'gap-3',
              layout?.spacing === 'lg' && 'gap-8'
            )}
          >
            {fields.map((fieldConfig, index) => (
              <FieldRenderer
                key={('name' in fieldConfig ? fieldConfig.name : undefined) || index}
                config={fieldConfig}
                form={form}
                isDisabled={isLoading || isDisabled}
              />
            ))}
          </div>

          {children}

          <div className={cn('flex gap-3', styling?.buttonContainerClassName)}>
            {cancelButton && onCancel && (
              <Button
                type="button"
                variant={cancelButton.variant || 'outline'}
                size={cancelButton.size}
                onClick={onCancel}
                disabled={isLoading}
              >
                {cancelButton.text || 'Cancel'}
              </Button>
            )}
            <Button
              type="submit"
              variant={submitButton?.variant}
              size={submitButton?.size}
              disabled={isLoading || isDisabled}
              className={cn(submitButton?.fullWidth && 'w-full')}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {submitButton?.loadingText || 'Loading...'}
                </>
              ) : (
                <>
                  {submitButton?.icon && <submitButton.icon className="mr-2 h-4 w-4" />}
                  {submitButton?.text || 'Submit'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

// =============================================
// FACTORY HELPER FUNCTIONS
// =============================================

export function createFormSchema<T extends z.ZodRawShape>(fields: T) {
  return z.object(fields)
}

export function createFormComponent<T extends z.ZodType>(config: FormConfig<T>) {
  return function FormComponent(props: Omit<FormFactoryProps<T>, keyof FormConfig<T>>) {
    return <FormFactory {...config} {...props} />
  }
}

// =============================================
// FIELD FACTORY FUNCTIONS
// =============================================

export const createTextField = (config: Omit<TextFieldConfig, 'type'>): TextFieldConfig => ({
  type: 'text',
  ...config
})

export const createTextareaField = (config: Omit<TextFieldConfig, 'type' | 'multiline'>): TextFieldConfig => ({
  type: 'text',
  multiline: true,
  rows: 3,
  ...config
})

export const createNumberField = (config: Omit<NumberFieldConfig, 'type'>): NumberFieldConfig => ({
  type: 'number',
  ...config
})

export const createPasswordField = (config: Omit<PasswordFieldConfig, 'type'>): PasswordFieldConfig => ({
  type: 'password',
  showToggle: true,
  ...config
})

export const createEmailField = (config: Omit<EmailFieldConfig, 'type'>): EmailFieldConfig => ({
  type: 'email',
  ...config
})

export const createSelectField = (config: Omit<SelectFieldConfig, 'type'>): SelectFieldConfig => ({
  type: 'select',
  ...config
})

export const createCheckboxField = (config: Omit<CheckboxFieldConfig, 'type'>): CheckboxFieldConfig => ({
  type: 'checkbox',
  ...config
})

export const createRadioField = (config: Omit<RadioFieldConfig, 'type'>): RadioFieldConfig => ({
  type: 'radio',
  orientation: 'vertical',
  ...config
})

export const createSwitchField = (config: Omit<SwitchFieldConfig, 'type'>): SwitchFieldConfig => ({
  type: 'switch',
  ...config
})

export const createDateField = (config: Omit<DateFieldConfig, 'type'>): DateFieldConfig => ({
  type: 'date',
  ...config
})

export const createTagsField = (config: Omit<TagsFieldConfig, 'type'>): TagsFieldConfig => ({
  type: 'tags',
  allowCustom: true,
  ...config
})

export const createFileField = (config: Omit<FileFieldConfig, 'type'>): FileFieldConfig => ({
  type: 'file',
  showPreview: true,
  ...config
})

export const createFieldGroup = (config: Omit<FieldGroupConfig, 'type'>): FieldGroupConfig => ({
  type: 'group',
  defaultExpanded: true,
  columns: 1,
  ...config
})

export const createFieldArray = (config: Omit<FieldArrayConfig, 'type'>): FieldArrayConfig => ({
  type: 'array',
  minItems: 1,
  addButtonText: 'Add Item',
  removeButtonText: 'Remove',
  ...config
})

// =============================================
// COMMON FORM PATTERNS
// =============================================

export const commonFormPatterns = {
  // Authentication forms
  loginForm: (options?: { showRememberMe?: boolean }) => [
    createEmailField({
      name: 'email',
      label: 'Email',
      placeholder: 'Enter your email address',
      required: true
    }),
    createPasswordField({
      name: 'password',
      label: 'Password',
      placeholder: 'Enter your password',
      required: true
    }),
    ...(options?.showRememberMe
      ? [
          createCheckboxField({
            name: 'rememberMe',
            label: 'Remember me'
          })
        ]
      : [])
  ],

  // User profile forms
  profileForm: () => [
    createFieldGroup({
      title: 'Personal Information',
      fields: [
        createTextField({
          name: 'firstName',
          label: 'First Name',
          placeholder: 'Enter your first name',
          required: true
        }),
        createTextField({
          name: 'lastName',
          label: 'Last Name',
          placeholder: 'Enter your last name',
          required: true
        })
      ],
      columns: 2
    }),
    createEmailField({
      name: 'email',
      label: 'Email Address',
      placeholder: 'Enter your email address',
      required: true
    }),
    createTextareaField({
      name: 'bio',
      label: 'Bio',
      placeholder: 'Tell us about yourself...',
      maxLength: 500,
      showCount: true
    })
  ],

  // Project forms
  projectForm: () => [
    createTextField({
      name: 'name',
      label: 'Project Name',
      placeholder: 'Enter project name',
      required: true,
      maxLength: 100
    }),
    createTextField({
      name: 'path',
      label: 'Project Path',
      placeholder: 'Enter or browse for project path',
      required: true
    }),
    createTextareaField({
      name: 'description',
      label: 'Description',
      placeholder: 'Describe your project...',
      maxLength: 500
    }),
    createTagsField({
      name: 'tags',
      label: 'Tags',
      placeholder: 'Add tags to categorize your project'
    })
  ],

  // Settings forms
  settingsForm: () => [
    createFieldGroup({
      title: 'Preferences',
      fields: [
        createSelectField({
          name: 'theme',
          label: 'Theme',
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' }
          ]
        }),
        createSelectField({
          name: 'language',
          label: 'Language',
          options: [
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' }
          ]
        })
      ],
      columns: 2
    }),
    createFieldGroup({
      title: 'Notifications',
      fields: [
        createSwitchField({
          name: 'emailNotifications',
          label: 'Email Notifications',
          description: 'Receive email notifications for important updates'
        }),
        createSwitchField({
          name: 'pushNotifications',
          label: 'Push Notifications',
          description: 'Receive push notifications in your browser'
        })
      ]
    })
  ]
}

// =============================================
// VALIDATION HELPERS
// =============================================

export const formValidation = {
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  url: z.string().url('Invalid URL').optional().or(z.literal('')),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number').optional(),
  tags: z.array(z.string()).default([]),
  required: (message = 'This field is required') => z.string().min(1, message),
  optional: z.string().optional(),
  positiveNumber: z.number().positive('Must be a positive number'),
  dateRange: (start: Date, end: Date) =>
    z.date().min(start, `Date must be after ${start.toDateString()}`).max(end, `Date must be before ${end.toDateString()}`)
}

export default FormFactory