// Core components - explicit named exports for better tree-shaking
export { Alert, AlertTitle, AlertDescription } from './components/core/alert'
export { Badge, badgeVariants } from './components/core/badge'
export {
  Button,
  buttonVariants,
  type ButtonProps,
  type ButtonVariant,
  type ButtonPropsFinal
} from './components/core/button'
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/core/card'
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from './components/core/dialog'
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup
} from './components/core/dropdown-menu'
export { Input, type InputProps } from './components/core/input'
export { Label, labelVariants } from './components/core/label'
export { Separator } from './components/core/separator'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/core/tabs'
export { Textarea, type TextareaProps } from './components/core/textarea'
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/core/tooltip'
export {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  useFormField
} from './components/core/form'
export { Checkbox } from './components/core/checkbox'
export { RadioGroup, RadioGroupItem } from './components/core/radio-group'
export { Switch } from './components/core/switch'
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton
} from './components/core/select'

// Brand components
export { Logo, type LogoProps } from './components/brand/logo'

// Utilities
export { cn, formatDate } from './utils'

// Types
export type * from './components/core/alert'
export type * from './components/core/badge'
export type * from './components/core/button'
export type * from './components/core/card'
export type * from './components/core/dialog'
export type * from './components/core/dropdown-menu'
export type * from './components/core/input'
export type * from './components/core/label'
export type * from './components/core/tabs'
export type * from './components/core/textarea'
export type * from './components/core/tooltip'
export type * from './components/brand/logo'
export type * from './components/core/form'
export type * from './components/core/checkbox'
export type * from './components/core/radio-group'
export type * from './components/core/switch'
export type * from './components/core/select'
