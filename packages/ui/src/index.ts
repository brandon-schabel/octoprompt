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
  TableCaption,
  Skeleton,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Progress,
  type ProgressProps,
  type ProgressVariant,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  ScrollArea,
  ScrollBar
} from './components/data'

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
export { Toaster } from './components/utility/sonner'
export { CopyableText, CopyableCode, CopyableInline, CopyableBlock } from './components/utility/copyable-text'
export { Icons } from './components/utility/icons'
export { TokenUsageTooltip, TokenBadge, type TokenUsageData } from './components/utility/token-usage-tooltip'

// Layout components
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
} from './components/layout/sidebar'
export { ResponsiveContainer } from './components/layout/responsive-container'
export { useIsMobile } from './components/layout/use-mobile'
export { useClickAway } from './components/layout/use-click-away'
export { useLocalStorage, createTypedLocalStorage } from './components/layout/use-local-storage'

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

// DND-based resizable components
export { DndResizablePanel, type DndResizablePanelProps } from './components/resizable/dnd-resizable-panel'
export {
  DndVerticalResizablePanel,
  type DndVerticalResizablePanelProps
} from './components/resizable/dnd-vertical-resizable-panel'
export {
  DndThreeColumnResizablePanel,
  type DndThreeColumnResizablePanelProps
} from './components/resizable/dnd-three-column-resizable-panel'
export {
  DndDraggableThreeColumnPanel,
  type DndDraggableThreeColumnPanelProps,
  type PanelConfig
} from './components/resizable/dnd-draggable-three-column-panel'
export { SortablePanel, type SortablePanelProps } from './components/resizable/sortable-panel'

// Data Table components
export { DataTable } from './components/data-table/data-table'
export { DataTableToolbar } from './components/data-table/data-table-toolbar'
export { DataTablePagination } from './components/data-table/data-table-pagination'
export { DataTableColumnHeader } from './components/data-table/data-table-column-header'
export { DataTableColumnFilter } from './components/data-table/data-table-column-filter'
export { DataTableFacetedFilter } from './components/data-table/data-table-faceted-filter'
export { DataTableViewOptions } from './components/data-table/data-table-view-options'
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

// File components
export { DiffViewer } from './components/file/diff-viewer'
export {
  FileUploadInput,
  FileUploadButton,
  type FileUploadInputProps,
  type FileUploadButtonProps
} from './components/file/file-upload-input'
export { computeLineDiff, type DiffChunk } from './components/file/compute-line-diff'

// Motion components and utilities
export {
  // Animation variants
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  rotateIn,
  staggerContainer,
  staggerItem,

  // Hover animations
  hoverScale,
  hoverRotate,
  hoverGlow,

  // Components
  AnimateOnScroll,
  Parallax,
  AnimatedText,
  PageTransition
} from './components/motion/animation-utils'
export { motion, AnimatePresence } from 'framer-motion'

// Marketing components
export { CTAButton, CTAButtonAnimated, CTAButtonOutline, CTAButtonGroup } from './components/marketing/cta-button'
export { FeatureCard, FeatureCardAnimated, FeatureGrid } from './components/marketing/feature-card'

// Markdown components
export { MarkdownRenderer } from './components/markdown/markdown-renderer'
export { MarkdownPreview } from './components/markdown/markdown-preview'
export { MarkdownInlinePreview } from './components/markdown/markdown-inline-preview'

// Editor components
export { MonacoEditorWrapper } from './components/editors/monaco-editor-wrapper'
export { MonacoDiffViewer } from './components/editors/monaco-diff-viewer'
export { LazyMonacoEditor } from './components/editors/lazy-monaco-editor'
export { LazyMonacoDiffViewer } from './components/editors/lazy-monaco-diff-viewer'

// Error components
export { ErrorBoundary } from './components/errors/error-boundary'
export { ComponentErrorBoundary } from './components/errors/component-error-boundary'
export { AIErrorDisplay } from './components/errors/ai-error-display'
export { parseAIError, extractProviderName } from './components/errors/error-utils'

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
export type * from './components/data'
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
export type { Variants, MotionProps } from 'framer-motion'
export type * from './components/marketing/cta-button'
export type * from './components/marketing/feature-card'
export type * from './components/layout/sidebar'
export type * from './components/layout/responsive-container'
export type * from './components/layout/use-local-storage'
export type { MarkdownRendererProps } from './components/markdown/markdown-renderer'
export type { MarkdownPreviewProps } from './components/markdown/markdown-preview'
export type { MarkdownInlinePreviewProps } from './components/markdown/markdown-inline-preview'
export type { MonacoEditorWrapperProps } from './components/editors/monaco-editor-wrapper'
export type { MonacoDiffViewerProps } from './components/editors/monaco-diff-viewer'
export type { LazyMonacoEditorProps } from './components/editors/lazy-monaco-editor'
export type { LazyMonacoDiffViewerProps } from './components/editors/lazy-monaco-diff-viewer'
export type { AIErrorType, AIErrorDisplayProps } from './components/errors/ai-error-display'
