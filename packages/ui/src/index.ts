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
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from './components/core/popover'
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription
} from './components/core/sheet'
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator
} from './components/core/command'
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from './components/core/alert-dialog'
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

// Data components
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
} from './components/data/table'
export { Skeleton } from './components/data/skeleton'
export { Avatar, AvatarImage, AvatarFallback } from './components/data/avatar'
export { Progress, type ProgressProps, type ProgressVariant } from './components/data/progress'
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './components/data/accordion'
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './components/data/collapsible'
export { ScrollArea, ScrollBar } from './components/data/scroll-area'

// Interaction components
export { Slider } from './components/interaction/slider'
export { Toggle, toggleVariants } from './components/interaction/toggle'
export { ToggleGroup, ToggleGroupItem } from './components/interaction/toggle-group'
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis
} from './components/interaction/breadcrumb'
export { DownloadButton, DownloadButtonCompact, DownloadButtonDropdown } from './components/interaction/download-button'
export type { DownloadPlatform } from './components/interaction/download-button'

// Overlay components
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup
} from './components/overlay/context-menu'
export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut
} from './components/overlay/menubar'
export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription
} from './components/overlay/drawer'

// Utility components
export {
  Toaster,
  CopyableText,
  CopyableCode,
  CopyableInline,
  CopyableBlock,
  Icons,
  TokenUsageTooltip,
  TokenBadge
} from './components/utility'
export type { TokenUsageData } from './components/utility/token-usage-tooltip'

// Resizable components
export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandleStyled,
  HorizontalResizable,
  VerticalResizable,
  ThreeColumnResizable,
  type ImperativePanelHandle
} from './components/resizable/resizable-panels'

// Data Table components
export {
  DataTable,
  DataTableToolbar,
  DataTablePagination,
  DataTableColumnHeader,
  DataTableColumnFilter,
  DataTableFacetedFilter,
  DataTableViewOptions
} from './components/data-table'
export type * from './components/data-table/types'

// Chart components
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
  type ChartConfig
} from './components/chart/chart'

// Surface components
export {
  GlassCard,
  GlassCardGradient,
  FloatingGlass,
  GlassPanel,
  glassCardVariants
} from './components/surface/glass-card'

// Feedback components
export { LoadingDots, LoadingSpinner, LoadingOverlay, LoadingSkeleton } from './components/feedback/loading'

// Code components
export { CodeBlock, CodeTerminal, codeBlockVariants } from './components/code/code-block'

// Motion components and utilities
export * from './components/motion/animation-utils'

// Marketing components
export { CTAButton, CTAButtonAnimated, CTAButtonOutline, CTAButtonGroup } from './components/marketing/cta-button'
export { FeatureCard, FeatureCardAnimated, FeatureGrid } from './components/marketing/feature-card'

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
export type * from './components/core/popover'
export type * from './components/core/sheet'
export type * from './components/core/command'
export type * from './components/core/alert-dialog'
export type * from './components/data/table'
export type * from './components/data/skeleton'
export type * from './components/data/avatar'
export type * from './components/data/progress'
export type * from './components/data/accordion'
export type * from './components/data/collapsible'
export type * from './components/data/scroll-area'
export type * from './components/interaction/slider'
export type * from './components/interaction/toggle'
export type * from './components/interaction/toggle-group'
export type * from './components/interaction/breadcrumb'
export type * from './components/interaction/download-button'
export type * from './components/overlay/context-menu'
export type * from './components/overlay/menubar'
export type * from './components/overlay/drawer'
export type * from './components/utility/sonner'
export type * from './components/surface/glass-card'
export type * from './components/feedback/loading'
export type * from './components/code/code-block'
export type * from './components/motion/animation-utils'
export type * from './components/marketing/cta-button'
export type * from './components/marketing/feature-card'
