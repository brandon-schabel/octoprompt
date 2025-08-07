// Core components - explicit named exports for better tree-shaking
export { Alert, AlertTitle, AlertDescription } from './components/core/alert.tsx'
export { Badge, badgeVariants } from './components/core/badge.tsx'
export {
  Button,
  buttonVariants,
  type ButtonProps,
  type ButtonVariant,
  type ButtonPropsFinal
} from './components/core/button.tsx'
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/core/card.tsx'
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
} from './components/core/dialog.tsx'
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
} from './components/core/dropdown-menu.tsx'
export { Input, type InputProps } from './components/core/input.tsx'
export { Label, labelVariants } from './components/core/label.tsx'
export { Separator } from './components/core/separator.tsx'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/core/tabs.tsx'
export { Textarea, type TextareaProps } from './components/core/textarea.tsx'
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/core/tooltip.tsx'
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from './components/core/popover.tsx'
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
} from './components/core/sheet.tsx'
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
} from './components/core/command.tsx'
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
} from './components/core/alert-dialog.tsx'
export {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  useFormField
} from './components/core/form.tsx'
export { Checkbox } from './components/core/checkbox.tsx'
export { RadioGroup, RadioGroupItem } from './components/core/radio-group.tsx'
export { Switch } from './components/core/switch.tsx'
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
} from './components/core/select.tsx'

// Brand components
export { Logo, type LogoProps } from './components/brand/logo.tsx'

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
} from './components/data/table.tsx'
export { Skeleton } from './components/data/skeleton.tsx'
export { Avatar, AvatarImage, AvatarFallback } from './components/data/avatar.tsx'
export { Progress, type ProgressProps, type ProgressVariant } from './components/data/progress.tsx'
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './components/data/accordion.tsx'
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './components/data/collapsible.tsx'
export { ScrollArea, ScrollBar } from './components/data/scroll-area.tsx'

// Interaction components
export { Slider } from './components/interaction/slider.tsx'
export { Toggle, toggleVariants } from './components/interaction/toggle.tsx'
export { ToggleGroup, ToggleGroupItem } from './components/interaction/toggle-group.tsx'
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis
} from './components/interaction/breadcrumb.tsx'
export {
  DownloadButton,
  DownloadButtonCompact,
  DownloadButtonDropdown
} from './components/interaction/download-button.tsx'
export type { DownloadPlatform } from './components/interaction/download-button.tsx'

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
} from './components/overlay/context-menu.tsx'
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
} from './components/overlay/menubar.tsx'
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
} from './components/overlay/drawer.tsx'

// Utility components
export { Toaster } from './components/utility/sonner.tsx'
export { CopyableText, CopyableCode, CopyableInline, CopyableBlock } from './components/utility/copyable-text.tsx'
export { Icons } from './components/utility/icons.tsx'
export { TokenUsageTooltip, TokenBadge, type TokenUsageData } from './components/utility/token-usage-tooltip.tsx'

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
} from './components/layout/sidebar.tsx'
export { ResponsiveContainer } from './components/layout/responsive-container.tsx'
export { useIsMobile } from './components/layout/use-mobile.tsx'
export { useClickAway } from './components/layout/use-click-away.ts'
export { useLocalStorage, createTypedLocalStorage } from './components/layout/use-local-storage.ts'

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
} from './components/resizable/resizable-panels.tsx'

// DND-based resizable components
export { DndResizablePanel, type DndResizablePanelProps } from './components/resizable/dnd-resizable-panel.tsx'
export {
  DndVerticalResizablePanel,
  type DndVerticalResizablePanelProps
} from './components/resizable/dnd-vertical-resizable-panel.tsx'
export {
  DndThreeColumnResizablePanel,
  type DndThreeColumnResizablePanelProps
} from './components/resizable/dnd-three-column-resizable-panel.tsx'
export {
  DndDraggableThreeColumnPanel,
  type DndDraggableThreeColumnPanelProps,
  type PanelConfig
} from './components/resizable/dnd-draggable-three-column-panel.tsx'
export { SortablePanel, type SortablePanelProps } from './components/resizable/sortable-panel.tsx'

// Data Table components
export { DataTable } from './components/data-table/data-table.tsx'
export { DataTableToolbar } from './components/data-table/data-table-toolbar.tsx'
export { DataTablePagination } from './components/data-table/data-table-pagination.tsx'
export { DataTableColumnHeader } from './components/data-table/data-table-column-header.tsx'
export { DataTableColumnFilter } from './components/data-table/data-table-column-filter.tsx'
export { DataTableFacetedFilter } from './components/data-table/data-table-faceted-filter.tsx'
export { DataTableViewOptions } from './components/data-table/data-table-view-options.tsx'
export type * from './components/data-table/types.ts'

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
} from './components/chart/chart.tsx'

// Surface components
export {
  GlassCard,
  GlassCardGradient,
  FloatingGlass,
  GlassPanel,
  glassCardVariants
} from './components/surface/glass-card.tsx'

// Feedback components
export { LoadingDots, LoadingSpinner, LoadingOverlay, LoadingSkeleton } from './components/feedback/loading.tsx'

// Code components
export { CodeBlock, CodeTerminal, codeBlockVariants } from './components/code/code-block.tsx'

// File components
export { DiffViewer } from './components/file/diff-viewer.tsx'
export {
  FileUploadInput,
  FileUploadButton,
  type FileUploadInputProps,
  type FileUploadButtonProps
} from './components/file/file-upload-input.tsx'
export { computeLineDiff, type DiffChunk } from './components/file/compute-line-diff.tsx'

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
} from './components/motion/animation-utils.tsx'
export { motion, AnimatePresence } from 'framer-motion'

// Marketing components
export { CTAButton, CTAButtonAnimated, CTAButtonOutline, CTAButtonGroup } from './components/marketing/cta-button.tsx'
export { FeatureCard, FeatureCardAnimated, FeatureGrid } from './components/marketing/feature-card.tsx'

// Markdown components
export { MarkdownRenderer } from './components/markdown/markdown-renderer.tsx'
export { MarkdownPreview } from './components/markdown/markdown-preview.tsx'
export { MarkdownInlinePreview } from './components/markdown/markdown-inline-preview.tsx'

// Editor components
export { MonacoEditorWrapper } from './components/editors/monaco-editor-wrapper.tsx'
export { MonacoDiffViewer } from './components/editors/monaco-diff-viewer.tsx'
export { LazyMonacoEditor } from './components/editors/lazy-monaco-editor.tsx'
export { LazyMonacoDiffViewer } from './components/editors/lazy-monaco-diff-viewer.tsx'

// Error components
export { ErrorBoundary } from './components/errors/error-boundary.tsx'
export { ComponentErrorBoundary } from './components/errors/component-error-boundary.tsx'
export { AIErrorDisplay } from './components/errors/ai-error-display.tsx'
export { parseAIError, extractProviderName } from './components/errors/error-utils.ts'

// Utilities
export { cn, formatDate } from './utils'

// Types
export type * from './components/core/alert.tsx'
export type * from './components/core/badge.tsx'
export type * from './components/core/button.tsx'
export type * from './components/core/card.tsx'
export type * from './components/core/dialog.tsx'
export type * from './components/core/dropdown-menu.tsx'
export type * from './components/core/input.tsx'
export type * from './components/core/label.tsx'
export type * from './components/core/tabs.tsx'
export type * from './components/core/textarea.tsx'
export type * from './components/core/tooltip.tsx'
export type * from './components/brand/logo.tsx'
export type * from './components/core/form.tsx'
export type * from './components/core/checkbox.tsx'
export type * from './components/core/radio-group.tsx'
export type * from './components/core/switch.tsx'
export type * from './components/core/select.tsx'
export type * from './components/core/popover.tsx'
export type * from './components/core/sheet.tsx'
export type * from './components/core/command.tsx'
export type * from './components/core/alert-dialog.tsx'
export type * from './components/data/table.tsx'
export type * from './components/data/skeleton.tsx'
export type * from './components/data/avatar.tsx'
export type * from './components/data/progress.tsx'
export type * from './components/data/accordion.tsx'
export type * from './components/data/collapsible.tsx'
export type * from './components/data/scroll-area.tsx'
export type * from './components/interaction/slider.tsx'
export type * from './components/interaction/toggle.tsx'
export type * from './components/interaction/toggle-group.tsx'
export type * from './components/interaction/breadcrumb.tsx'
export type * from './components/interaction/download-button.tsx'
export type * from './components/overlay/context-menu.tsx'
export type * from './components/overlay/menubar.tsx'
export type * from './components/overlay/drawer.tsx'
export type * from './components/utility/sonner.tsx'
export type * from './components/surface/glass-card.tsx'
export type * from './components/feedback/loading.tsx'
export type * from './components/code/code-block.tsx'
export type { Variants, MotionProps } from 'framer-motion'
export type * from './components/marketing/cta-button.tsx'
export type * from './components/marketing/feature-card.tsx'
export type * from './components/layout/sidebar.tsx'
export type * from './components/layout/responsive-container.tsx'
export type * from './components/layout/use-local-storage.ts'
export type { MarkdownRendererProps } from './components/markdown/markdown-renderer.tsx'
export type { MarkdownPreviewProps } from './components/markdown/markdown-preview.tsx'
export type { MarkdownInlinePreviewProps } from './components/markdown/markdown-inline-preview.tsx'
export type { MonacoEditorWrapperProps } from './components/editors/monaco-editor-wrapper.tsx'
export type { MonacoDiffViewerProps } from './components/editors/monaco-diff-viewer.tsx'
export type { LazyMonacoEditorProps } from './components/editors/lazy-monaco-editor.tsx'
export type { LazyMonacoDiffViewerProps } from './components/editors/lazy-monaco-diff-viewer.tsx'
export type { AIErrorType, AIErrorDisplayProps } from './components/errors/ai-error-display.tsx'
