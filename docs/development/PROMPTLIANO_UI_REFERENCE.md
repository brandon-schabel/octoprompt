# @promptliano/ui Component Reference

A comprehensive guide to all components available in the @promptliano/ui package - a modern React component library built on top of shadcn/ui with additional features and enhancements.

## Table of Contents

- [Installation & Setup](#installation--setup)
- [Core Components](#core-components)
- [Layout Components](#layout-components)
- [Data Components](#data-components)
- [Interaction Components](#interaction-components)
- [Overlay Components](#overlay-components)
- [Utility Components](#utility-components)
- [Surface Components](#surface-components)
- [Motion Components](#motion-components)
- [Chart Components](#chart-components)
- [Editor Components](#editor-components)
- [Error Components](#error-components)
- [File Components](#file-components)
- [Markdown Components](#markdown-components)
- [Brand Components](#brand-components)
- [Feedback Components](#feedback-components)
- [Code Components](#code-components)
- [Marketing Components](#marketing-components)
- [Utilities](#utilities)
- [Advanced Usage](#advanced-usage)

## Installation & Setup

### Installing the Package

```bash
# Using bun
bun add @promptliano/ui

# Using npm
npm install @promptliano/ui

# Using yarn
yarn add @promptliano/ui
```

### Importing Global Styles

Add this to your app's main CSS file:

```css
@import '@promptliano/ui/dist/styles/globals.css';
```

### Tailwind Configuration

Extend your `tailwind.config.js`:

```js
const uiConfig = require('@promptliano/ui/tailwind.config.js')

module.exports = {
  ...uiConfig,
  content: [...uiConfig.content, './src/**/*.{js,ts,jsx,tsx}', './node_modules/@promptliano/ui/dist/**/*.js']
}
```

## Core Components

Core components are the fundamental building blocks of your UI. They follow shadcn/ui patterns with additional features.

### Button

A versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@promptliano/ui'

// Basic usage
<Button>Click me</Button>

// Variants
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="gradient">Gradient</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
<Button size="icon"><IconComponent /></Button>

// As child (for custom components)
<Button asChild>
  <a href="/home">Home</a>
</Button>
```

**Props:**

- `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gradient"
- `size`: "default" | "sm" | "lg" | "xl" | "icon"
- `asChild`: boolean - Renders as child component
- All standard button HTML attributes

### Badge

Small status indicators with various styles.

```tsx
import { Badge } from '@promptliano/ui'

// Variants
<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="count">42</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="high">High Priority</Badge>
```

### Card

Container component for grouping related content.

```tsx
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@promptliano/ui'

;<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Dialog

Modal dialog for important interactions.

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@promptliano/ui'

;<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>This is a dialog description.</DialogDescription>
    </DialogHeader>
    <div>Dialog content here</div>
    <DialogFooter>
      <Button>Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Alert

Display important messages to users.

```tsx
import { Alert, AlertTitle, AlertDescription } from '@promptliano/ui'

;<Alert>
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>You can add components to your app using the cli.</AlertDescription>
</Alert>
```

### Form

Advanced form handling with react-hook-form integration.

```tsx
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField
} from '@promptliano/ui'
import { useForm } from 'react-hook-form'

const form = useForm()

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input placeholder="Enter username" {...field} />
          </FormControl>
          <FormDescription>
            This is your public display name.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

### Input

Text input field with consistent styling.

```tsx
import { Input } from '@promptliano/ui'

<Input type="text" placeholder="Enter text..." />
<Input type="email" placeholder="Email" />
<Input type="password" placeholder="Password" />
<Input disabled placeholder="Disabled input" />
```

### Textarea

Multi-line text input.

```tsx
import { Textarea } from '@promptliano/ui'

<Textarea placeholder="Type your message here." />
<Textarea disabled />
```

### Label

Form labels with proper accessibility.

```tsx
import { Label } from '@promptliano/ui'

<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />
```

### Separator

Visual divider between sections.

```tsx
import { Separator } from '@promptliano/ui'

<div>
  <div>Section 1</div>
  <Separator />
  <div>Section 2</div>
</div>

// Vertical separator
<Separator orientation="vertical" />
```

### Tabs

Tab navigation for organizing content.

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@promptliano/ui'

;<Tabs defaultValue='account'>
  <TabsList>
    <TabsTrigger value='account'>Account</TabsTrigger>
    <TabsTrigger value='password'>Password</TabsTrigger>
  </TabsList>
  <TabsContent value='account'>Account settings here</TabsContent>
  <TabsContent value='password'>Password settings here</TabsContent>
</Tabs>
```

### Checkbox

Checkbox input with label support.

```tsx
import { Checkbox } from '@promptliano/ui'

;<div className='flex items-center space-x-2'>
  <Checkbox id='terms' />
  <Label htmlFor='terms'>Accept terms and conditions</Label>
</div>
```

### Radio Group

Radio button group for single selection.

```tsx
import { RadioGroup, RadioGroupItem } from '@promptliano/ui'

;<RadioGroup defaultValue='option-one'>
  <div className='flex items-center space-x-2'>
    <RadioGroupItem value='option-one' id='option-one' />
    <Label htmlFor='option-one'>Option One</Label>
  </div>
  <div className='flex items-center space-x-2'>
    <RadioGroupItem value='option-two' id='option-two' />
    <Label htmlFor='option-two'>Option Two</Label>
  </div>
</RadioGroup>
```

### Switch

Toggle switch for boolean values.

```tsx
import { Switch } from '@promptliano/ui'

;<div className='flex items-center space-x-2'>
  <Switch id='airplane-mode' />
  <Label htmlFor='airplane-mode'>Airplane Mode</Label>
</div>
```

### Select

Dropdown selection component.

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'

;<Select>
  <SelectTrigger>
    <SelectValue placeholder='Select a fruit' />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value='apple'>Apple</SelectItem>
    <SelectItem value='banana'>Banana</SelectItem>
    <SelectItem value='orange'>Orange</SelectItem>
  </SelectContent>
</Select>
```

### Popover

Floating content panel.

```tsx
import { Popover, PopoverContent, PopoverTrigger } from '@promptliano/ui'

;<Popover>
  <PopoverTrigger asChild>
    <Button variant='outline'>Open popover</Button>
  </PopoverTrigger>
  <PopoverContent>
    <div>Popover content</div>
  </PopoverContent>
</Popover>
```

### Sheet

Slide-out panel from screen edges.

```tsx
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@promptliano/ui'

;<Sheet>
  <SheetTrigger asChild>
    <Button>Open Sheet</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Sheet Title</SheetTitle>
      <SheetDescription>Sheet description here.</SheetDescription>
    </SheetHeader>
    <div>Sheet content</div>
  </SheetContent>
</Sheet>
```

### Command

Command palette for search and actions.

```tsx
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator
} from '@promptliano/ui'

;<Command>
  <CommandInput placeholder='Type a command or search...' />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading='Suggestions'>
      <CommandItem>Calendar</CommandItem>
      <CommandItem>Search Emoji</CommandItem>
      <CommandItem>Calculator</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading='Settings'>
      <CommandItem>Profile</CommandItem>
      <CommandItem>Billing</CommandItem>
      <CommandItem>Settings</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

### Alert Dialog

Confirmation dialogs for destructive actions.

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@promptliano/ui'

;<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant='destructive'>Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete your account.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Continue</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Tooltip

Hover tooltips for additional information.

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'

;<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant='outline'>Hover me</Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Add to library</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## Layout Components

Layout components help structure your application with responsive, collapsible sidebars and resizable panels.

### Sidebar

A comprehensive sidebar system with mobile support, keyboard shortcuts, and multiple variants.

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from '@promptliano/ui'

function App() {
  return (
    <SidebarProvider>
      <div className='flex h-screen'>
        <Sidebar>
          <SidebarHeader>
            <h2>My App</h2>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <HomeIcon />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <SettingsIcon />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <UserProfile />
          </SidebarFooter>
        </Sidebar>
        <main className='flex-1'>
          <SidebarTrigger />
          <div>Main content</div>
        </main>
      </div>
    </SidebarProvider>
  )
}

// Using sidebar state
function MyComponent() {
  const { open, setOpen, toggleSidebar } = useSidebar()

  return <Button onClick={toggleSidebar}>{open ? 'Close' : 'Open'} Sidebar</Button>
}
```

**Sidebar Features:**

- Mobile responsive (becomes sheet on mobile)
- Keyboard shortcut (Cmd/Ctrl + B)
- Collapsible modes: "offcanvas", "icon", "none"
- Variants: "sidebar", "floating", "inset"
- Persistent state with localStorage
- Tooltip support for collapsed state

### Resizable Panels

Multiple resizable panel implementations for different use cases.

#### Standard Resizable Panels

```tsx
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  HorizontalResizable,
  VerticalResizable,
  ThreeColumnResizable
} from '@promptliano/ui'

// Basic resizable panels
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={50}>
    Left panel
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={50}>
    Right panel
  </ResizablePanel>
</ResizablePanelGroup>

// Convenience components
<HorizontalResizable
  leftPanel={<div>Left content</div>}
  rightPanel={<div>Right content</div>}
  defaultSize={40}
  minSize={20}
  maxSize={80}
  storageKey="my-layout"
/>

<VerticalResizable
  topPanel={<div>Top content</div>}
  bottomPanel={<div>Bottom content</div>}
  defaultSize={60}
/>

<ThreeColumnResizable
  leftPanel={<div>Left</div>}
  middlePanel={<div>Middle</div>}
  rightPanel={<div>Right</div>}
  defaultLeftSize={25}
  defaultRightSize={25}
/>
```

#### DND-Based Resizable Panels

For drag-and-drop functionality:

```tsx
import {
  DndResizablePanel,
  DndVerticalResizablePanel,
  DndThreeColumnResizablePanel,
  DndDraggableThreeColumnPanel
} from '@promptliano/ui'

// Draggable three-column layout
;<DndDraggableThreeColumnPanel
  panels={[
    { id: 'left', content: <LeftPanel />, title: 'Explorer' },
    { id: 'middle', content: <Editor />, title: 'Editor' },
    { id: 'right', content: <Preview />, title: 'Preview' }
  ]}
  defaultSizes={{ left: 20, middle: 50, right: 30 }}
  onOrderChange={(newOrder) => console.log('New order:', newOrder)}
/>
```

### Responsive Container

Container that adapts to screen size.

```tsx
import { ResponsiveContainer } from '@promptliano/ui'

;<ResponsiveContainer>
  <div>Content that adapts to container width</div>
</ResponsiveContainer>
```

### Layout Hooks

Utility hooks for responsive design:

```tsx
import { useIsMobile, useClickAway, useLocalStorage } from '@promptliano/ui'

// Detect mobile viewport
const isMobile = useIsMobile()

// Click outside detection
const ref = useRef(null)
useClickAway(ref, () => {
  console.log('Clicked outside!')
})

// Type-safe localStorage
const [theme, setTheme] = useLocalStorage('theme', 'light')
```

## Data Components

Components for displaying and organizing data.

### Table

Basic table structure components.

```tsx
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@promptliano/ui'

;<Table>
  <TableCaption>A list of recent invoices.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Method</TableHead>
      <TableHead className='text-right'>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell>Credit Card</TableCell>
      <TableCell className='text-right'>$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### DataTable

Advanced data table with sorting, filtering, pagination, and more.

```tsx
import { DataTable, DataTableColumnHeader } from '@promptliano/ui'
import { ColumnDef } from '@tanstack/react-table'

// Define columns
const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.getValue("status") === "active" ? "default" : "secondary"}>
        {row.getValue("status")}
      </Badge>
    ),
  },
]

// Use the DataTable
<DataTable
  columns={columns}
  data={users}
  // Pagination
  pagination={pagination}
  onPaginationChange={setPagination}
  pageCount={pageCount}
  // Sorting
  sorting={sorting}
  onSortingChange={setSorting}
  // Filtering
  columnFilters={filters}
  onColumnFiltersChange={setFilters}
  // Selection
  enableRowSelection
  onRowSelectionChange={setRowSelection}
  // Loading state
  isLoading={isLoading}
  // Custom empty message
  emptyMessage="No users found."
  // Click handler
  onRowClick={(row) => console.log('Clicked:', row.original)}
/>
```

**DataTable Features:**

- Column sorting
- Column filtering
- Global search
- Pagination
- Row selection
- Column visibility toggle
- Loading states
- Faceted filters
- Keyboard navigation

### Skeleton

Loading placeholder animations.

```tsx
import { Skeleton } from '@promptliano/ui'

// Basic skeleton
<Skeleton className="h-4 w-full" />
<Skeleton className="h-4 w-3/4" />
<Skeleton className="h-10 w-10 rounded-full" />

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-4 w-3/4" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-20 w-full" />
  </CardContent>
</Card>
```

### Avatar

User avatar with fallback support.

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@promptliano/ui'

;<Avatar>
  <AvatarImage src='https://github.com/username.png' alt='@username' />
  <AvatarFallback>CN</AvatarFallback>
</Avatar>
```

### Progress

Progress indicators with variants.

```tsx
import { Progress } from '@promptliano/ui'

<Progress value={66} />
<Progress value={33} variant="gradient" />
<Progress value={100} variant="success" />
```

### Accordion

Collapsible content sections.

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@promptliano/ui'

;<Accordion type='single' collapsible>
  <AccordionItem value='item-1'>
    <AccordionTrigger>Is it accessible?</AccordionTrigger>
    <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
  </AccordionItem>
  <AccordionItem value='item-2'>
    <AccordionTrigger>Is it styled?</AccordionTrigger>
    <AccordionContent>Yes. It comes with default styles that match the other components.</AccordionContent>
  </AccordionItem>
</Accordion>
```

### Collapsible

Simple collapsible container.

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@promptliano/ui'

const [isOpen, setIsOpen] = useState(false)

<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger asChild>
    <Button variant="ghost">
      Toggle
      <ChevronDownIcon className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div>Collapsible content here</div>
  </CollapsibleContent>
</Collapsible>
```

### ScrollArea

Custom scrollbar container.

```tsx
import { ScrollArea, ScrollBar } from '@promptliano/ui'

;<ScrollArea className='h-72 w-48 rounded-md border'>
  <div className='p-4'>{/* Long content here */}</div>
  <ScrollBar orientation='vertical' />
</ScrollArea>
```

## Interaction Components

Components for user interactions and controls.

### Slider

Range input slider.

```tsx
import { Slider } from '@promptliano/ui'

<Slider
  defaultValue={[50]}
  max={100}
  step={1}
  onValueChange={(value) => console.log(value)}
/>

// Multiple values
<Slider defaultValue={[25, 75]} max={100} step={1} />
```

### Toggle

Toggle button with variants.

```tsx
import { Toggle } from '@promptliano/ui'

<Toggle>Toggle</Toggle>
<Toggle variant="outline">Outline</Toggle>
<Toggle size="sm">Small</Toggle>
<Toggle size="lg">Large</Toggle>
```

### Toggle Group

Group of toggle buttons.

```tsx
import { ToggleGroup, ToggleGroupItem } from '@promptliano/ui'

<ToggleGroup type="single">
  <ToggleGroupItem value="bold" aria-label="Toggle bold">
    <Bold className="h-4 w-4" />
  </ToggleGroupItem>
  <ToggleGroupItem value="italic" aria-label="Toggle italic">
    <Italic className="h-4 w-4" />
  </ToggleGroupItem>
  <ToggleGroupItem value="underline" aria-label="Toggle underline">
    <Underline className="h-4 w-4" />
  </ToggleGroupItem>
</ToggleGroup>

// Multiple selection
<ToggleGroup type="multiple">
  {/* items */}
</ToggleGroup>
```

### Breadcrumb

Navigation breadcrumbs.

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@promptliano/ui'

;<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href='/'>Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href='/products'>Products</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Laptop</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### Download Button

Specialized download buttons with platform detection.

```tsx
import { DownloadButton, DownloadButtonCompact, DownloadButtonDropdown } from '@promptliano/ui'

// Simple download button
<DownloadButton href="/download" />

// Compact version
<DownloadButtonCompact href="/download" />

// Multi-platform dropdown
<DownloadButtonDropdown
  downloads={{
    mac: "/download/mac",
    windows: "/download/windows",
    linux: "/download/linux"
  }}
/>
```

## Overlay Components

Components that appear above other content.

### Context Menu

Right-click context menus.

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger
} from '@promptliano/ui'

;<ContextMenu>
  <ContextMenuTrigger className='border-2 border-dashed rounded-md p-8'>Right click here</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Profile</ContextMenuItem>
    <ContextMenuItem>Billing</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuSub>
      <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem>Settings</ContextMenuItem>
        <ContextMenuItem>Help</ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  </ContextMenuContent>
</ContextMenu>
```

### Menubar

Application menu bar.

```tsx
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger
} from '@promptliano/ui'

;<Menubar>
  <MenubarMenu>
    <MenubarTrigger>File</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        New Tab <MenubarShortcut>⌘T</MenubarShortcut>
      </MenubarItem>
      <MenubarItem>
        New Window <MenubarShortcut>⌘N</MenubarShortcut>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem>Print</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Edit</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>Undo</MenubarItem>
      <MenubarItem>Redo</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>
```

### Drawer

Slide-out drawer from screen edges.

```tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@promptliano/ui'

;<Drawer>
  <DrawerTrigger asChild>
    <Button>Open Drawer</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Are you sure?</DrawerTitle>
      <DrawerDescription>This action cannot be undone.</DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <Button>Submit</Button>
      <DrawerClose asChild>
        <Button variant='outline'>Cancel</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

### Dropdown Menu

Dropdown menus with nested items.

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@promptliano/ui'

;<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant='outline'>Open</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Billing</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem checked>Show Status Bar</DropdownMenuCheckboxItem>
    <DropdownMenuSeparator />
    <DropdownMenuRadioGroup value='bottom'>
      <DropdownMenuRadioItem value='top'>Top</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value='bottom'>Bottom</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>
```

## Utility Components

Helper components for common UI patterns.

### Toast (Sonner)

Toast notifications using Sonner.

```tsx
import { Toaster } from '@promptliano/ui'
import { toast } from 'sonner'

// Add Toaster to your app root
function App() {
  return (
    <>
      <Routes />
      <Toaster />
    </>
  )
}

// Use toast anywhere
;<Button onClick={() => toast.success('Changes saved!')}>Save</Button>

// Toast variants
toast('Default notification')
toast.success('Success!')
toast.error('Something went wrong')
toast.warning('Be careful')
toast.info('For your information')
toast.loading('Loading...')
```

### Copyable Text

Text with copy-to-clipboard functionality.

```tsx
import { CopyableText, CopyableCode, CopyableInline, CopyableBlock } from '@promptliano/ui'

// Basic copyable text
<CopyableText text="Copy this text" />

// Code block with syntax highlighting
<CopyableCode
  code={`function hello() {
  console.log('Hello World')
}`}
  language="javascript"
/>

// Inline copyable
<CopyableInline>npm install @promptliano/ui</CopyableInline>

// Block copyable
<CopyableBlock>
  This entire block can be copied
  Including multiple lines
</CopyableBlock>
```

### Icons

Icon component with common icons.

```tsx
import { Icons } from '@promptliano/ui'

<Icons.spinner className="animate-spin" />
<Icons.check />
<Icons.close />
<Icons.chevronLeft />
<Icons.chevronRight />
// ... many more icons available
```

### Token Usage Tooltip

Display AI token usage information.

```tsx
import { TokenUsageTooltip, TokenBadge } from '@promptliano/ui'

// Tooltip with detailed usage
<TokenUsageTooltip
  data={{
    inputTokens: 1500,
    outputTokens: 500,
    totalTokens: 2000,
    cost: 0.04
  }}
>
  <Button>Hover for usage</Button>
</TokenUsageTooltip>

// Simple badge
<TokenBadge tokens={2000} />
```

## Surface Components

Components for creating depth and visual hierarchy.

### Glass Card

Glassmorphism effect cards.

```tsx
import { GlassCard, GlassCardGradient, FloatingGlass, GlassPanel } from '@promptliano/ui'

// Basic glass card
<GlassCard>
  <p>Content with glass effect</p>
</GlassCard>

// Variants
<GlassCard variant="dark" blur="xl" border glow>
  Dark glass with glow
</GlassCard>

// Animated gradient glass
<GlassCardGradient animate>
  <h3>Animated Gradient</h3>
  <p>Beautiful gradient animation</p>
</GlassCardGradient>

// Floating animation
<FloatingGlass delay={0.2}>
  <p>This card floats!</p>
</FloatingGlass>

// Simple glass panel
<GlassPanel variant="subtle">
  Subtle glass background
</GlassPanel>
```

**Glass Card Variants:**

- `variant`: "default" | "dark" | "light" | "colorful"
- `blur`: "none" | "sm" | "md" | "lg" | "xl"
- `border`: boolean
- `glow`: boolean

## Motion Components

Animation utilities and components using Framer Motion.

### Animation Variants

Pre-defined animation variants:

```tsx
import {
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  rotateIn,
  staggerContainer,
  staggerItem
} from '@promptliano/ui'

// Use with motion components
<motion.div variants={fadeInUp} initial="hidden" animate="visible">
  Fade in from bottom
</motion.div>

// Stagger children
<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  <motion.div variants={staggerItem}>Item 1</motion.div>
  <motion.div variants={staggerItem}>Item 2</motion.div>
  <motion.div variants={staggerItem}>Item 3</motion.div>
</motion.div>
```

### Animation Components

```tsx
import { AnimateOnScroll, Parallax, AnimatedText, PageTransition } from '@promptliano/ui'

// Animate when scrolled into view
<AnimateOnScroll>
  <Card>This animates on scroll</Card>
</AnimateOnScroll>

// Custom animation and delay
<AnimateOnScroll
  variants={scaleIn}
  threshold={0.5}
  delay={0.2}
>
  <div>Delayed scale animation</div>
</AnimateOnScroll>

// Parallax scrolling
<Parallax speed={0.5}>
  <img src="background.jpg" alt="Parallax background" />
</Parallax>

// Animated text (word by word)
<AnimatedText
  text="This text animates word by word"
  delay={0.1}
/>

// Page transitions
<PageTransition>
  <div>Page content with transition</div>
</PageTransition>
```

### Hover Animations

```tsx
import { motion, hoverScale, hoverRotate, hoverGlow } from '@promptliano/ui'

// Scale on hover
<motion.div {...hoverScale}>
  Hover to scale
</motion.div>

// Rotate on hover
<motion.div {...hoverRotate}>
  Hover to rotate
</motion.div>

// Glow effect on hover
<motion.div {...hoverGlow}>
  Hover for glow
</motion.div>
```

## Chart Components

Data visualization components using Recharts.

```tsx
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from '@promptliano/ui'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis } from 'recharts'

// Define chart config
const chartConfig: ChartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
  mobile: {
    label: "Mobile",
    color: "hsl(var(--chart-2))",
  },
}

// Line chart example
<ChartContainer config={chartConfig}>
  <LineChart data={data}>
    <XAxis dataKey="month" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Line
      type="monotone"
      dataKey="desktop"
      stroke="var(--color-desktop)"
    />
    <Line
      type="monotone"
      dataKey="mobile"
      stroke="var(--color-mobile)"
    />
  </LineChart>
</ChartContainer>

// Bar chart example
<ChartContainer config={chartConfig}>
  <BarChart data={data}>
    <XAxis dataKey="month" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" />
    <Bar dataKey="mobile" fill="var(--color-mobile)" />
  </BarChart>
</ChartContainer>
```

## Editor Components

Monaco editor integration components.

### Monaco Editor

```tsx
import { MonacoEditorWrapper, LazyMonacoEditor } from '@promptliano/ui'

// Basic editor
<MonacoEditorWrapper
  value={code}
  onChange={setCode}
  language="typescript"
  height="400px"
  options={{
    minimap: { enabled: false },
    fontSize: 14,
  }}
/>

// Lazy loaded editor (better performance)
<LazyMonacoEditor
  value={code}
  onChange={setCode}
  language="javascript"
  theme="vs-dark"
/>
```

### Monaco Diff Viewer

```tsx
import { MonacoDiffViewer, LazyMonacoDiffViewer } from '@promptliano/ui'

// Diff viewer
<MonacoDiffViewer
  original={originalCode}
  modified={modifiedCode}
  language="typescript"
  height="500px"
/>

// Lazy loaded diff viewer
<LazyMonacoDiffViewer
  original={originalCode}
  modified={modifiedCode}
  language="javascript"
  options={{
    readOnly: true,
    renderSideBySide: true,
  }}
/>
```

## Error Components

Specialized error handling components.

### Error Boundary

Catch React errors gracefully.

```tsx
import { ErrorBoundary, ComponentErrorBoundary } from '@promptliano/ui'

// Wrap entire app
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Component-specific error boundary
<ComponentErrorBoundary componentName="UserProfile">
  <UserProfile />
</ComponentErrorBoundary>
```

### AI Error Display

Display AI provider errors with appropriate UI.

```tsx
import { AIErrorDisplay } from '@promptliano/ui'

;<AIErrorDisplay
  error={{
    type: 'RATE_LIMIT',
    message: 'Too many requests',
    provider: 'OpenAI',
    details: 'Rate limit will reset in 60 seconds',
    retryable: true
  }}
  onRetry={() => retryRequest()}
  onDismiss={() => clearError()}
/>

// Error types available:
// - MISSING_API_KEY
// - RATE_LIMIT
// - CONTEXT_LENGTH_EXCEEDED
// - INVALID_MODEL
// - NETWORK_ERROR
// - PROVIDER_ERROR
// - UNKNOWN
```

### Error Utilities

```tsx
import { parseAIError, extractProviderName } from '@promptliano/ui'

// Parse error from AI providers
const errorInfo = parseAIError(error)

// Extract provider name from error
const provider = extractProviderName(error)
```

## File Components

Components for file handling and display.

### File Upload

```tsx
import { FileUploadInput, FileUploadButton } from '@promptliano/ui'

// Input style file upload
<FileUploadInput
  accept="image/*"
  multiple
  onFilesSelected={(files) => {
    console.log('Selected files:', files)
  }}
  maxSize={5 * 1024 * 1024} // 5MB
/>

// Button style file upload
<FileUploadButton
  accept=".pdf,.doc,.docx"
  onFileSelect={(file) => {
    console.log('Selected file:', file)
  }}
>
  Upload Document
</FileUploadButton>
```

### Diff Viewer

Display file differences.

```tsx
import { DiffViewer, computeLineDiff } from '@promptliano/ui'

// Show diff between two texts
;<DiffViewer oldText={originalContent} newText={modifiedContent} language='typescript' />

// Compute diff programmatically
const chunks = computeLineDiff(oldText, newText)
```

## Markdown Components

Markdown rendering with syntax highlighting.

### Markdown Renderer

```tsx
import { MarkdownRenderer } from '@promptliano/ui'

;<MarkdownRenderer
  content={markdownContent}
  isDarkMode={theme === 'dark'}
  codeTheme='atomOneDark'
  copyToClipboard={(text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied!')
  }}
/>
```

### Markdown Preview

Styled markdown preview component.

```tsx
import { MarkdownPreview, MarkdownInlinePreview } from '@promptliano/ui'

// Full markdown preview
<MarkdownPreview content={markdownContent} />

// Inline markdown (no code blocks)
<MarkdownInlinePreview content={inlineMarkdown} />
```

## Brand Components

Promptliano brand elements.

### Logo

```tsx
import { Logo } from '@promptliano/ui'

// Default logo
<Logo />

// Size variants
<Logo size="sm" /> // 24px
<Logo size="md" /> // 32px (default)
<Logo size="lg" /> // 48px
<Logo size="xl" /> // 64px

// Expanded variant (includes text)
<Logo variant="expanded" />

// With glow effect
<Logo showGlow />

// Custom logo
<Logo
  src="/custom-logo.png"
  alt="My Company"
  className="custom-class"
/>
```

## Feedback Components

Loading and feedback indicators.

### Loading States

```tsx
import { LoadingDots, LoadingSpinner, LoadingOverlay, LoadingSkeleton } from '@promptliano/ui'

// Animated dots
<LoadingDots />

// Spinner
<LoadingSpinner size="sm" />
<LoadingSpinner size="md" />
<LoadingSpinner size="lg" />

// Full screen overlay
<LoadingOverlay />

// Skeleton loader
<LoadingSkeleton count={3} height={20} />
```

## Code Components

Code display components.

### Code Block

```tsx
import { CodeBlock, CodeTerminal } from '@promptliano/ui'

// Syntax highlighted code block
<CodeBlock
  code={javascriptCode}
  language="javascript"
  showLineNumbers
  highlightLines={[3, 5, 7]}
/>

// Terminal style
<CodeTerminal
  command="npm install @promptliano/ui"
  output="Successfully installed!"
/>
```

## Marketing Components

Components for marketing pages.

### CTA Buttons

```tsx
import { CTAButton, CTAButtonAnimated, CTAButtonOutline, CTAButtonGroup } from '@promptliano/ui'

// Standard CTA
<CTAButton href="/signup">Get Started</CTAButton>

// Animated CTA
<CTAButtonAnimated href="/demo">
  Try Demo
</CTAButtonAnimated>

// Outline variant
<CTAButtonOutline href="/learn-more">
  Learn More
</CTAButtonOutline>

// Button group
<CTAButtonGroup>
  <CTAButton href="/signup">Sign Up</CTAButton>
  <CTAButtonOutline href="/demo">View Demo</CTAButtonOutline>
</CTAButtonGroup>
```

### Feature Cards

```tsx
import { FeatureCard, FeatureCardAnimated, FeatureGrid } from '@promptliano/ui'

// Basic feature card
<FeatureCard
  icon={<RocketIcon />}
  title="Fast Performance"
  description="Lightning fast load times"
/>

// Animated on hover
<FeatureCardAnimated
  icon={<ShieldIcon />}
  title="Secure by Default"
  description="Enterprise-grade security"
/>

// Feature grid layout
<FeatureGrid>
  <FeatureCard {...feature1} />
  <FeatureCard {...feature2} />
  <FeatureCard {...feature3} />
</FeatureGrid>
```

## Utilities

### cn (Class Names)

Merge class names with conflict resolution.

```tsx
import { cn } from '@promptliano/ui'

// Merge classes
const className = cn('base-class', condition && 'conditional-class', 'final-class', props.className)

// Handles conflicts (later classes win)
cn('text-red-500', 'text-blue-500') // => 'text-blue-500'
```

### formatDate

Consistent date formatting.

```tsx
import { formatDate } from '@promptliano/ui'

formatDate(new Date()) // "Jan 15, 2024, 14:30:45"
formatDate('2024-01-15') // "Jan 15, 2024, 00:00:00"
```

## Advanced Usage

### Theming

All components support theming through CSS variables:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... more variables */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode variables */
}
```

### Composition

Components are designed to be composed together:

```tsx
<Card>
  <CardHeader>
    <div className='flex items-center justify-between'>
      <CardTitle>Users</CardTitle>
      <Badge variant='secondary'>{users.length}</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <DataTable columns={columns} data={users} />
  </CardContent>
  <CardFooter className='flex justify-between'>
    <Button variant='outline'>Cancel</Button>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>
```

### Responsive Design

Use responsive utilities with components:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card className="col-span-full lg:col-span-2">
    {/* Spans full width on mobile, 2 columns on desktop */}
  </Card>
</div>

// Responsive sidebar
<SidebarProvider defaultOpen={!isMobile}>
  {/* Sidebar content */}
</SidebarProvider>
```

### Accessibility

All components follow WAI-ARIA guidelines:

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- Focus management
- Color contrast compliance

### Performance

Components are optimized for performance:

- Lazy loading for heavy components (Monaco, Charts)
- Memoization where appropriate
- Efficient re-renders
- Code splitting support

## Best Practices

1. **Import only what you need** - Components are tree-shakeable
2. **Use semantic HTML** - Components render appropriate HTML elements
3. **Provide accessible labels** - Always include aria-labels for interactive elements
4. **Handle loading states** - Use skeletons and loading indicators
5. **Compose, don't duplicate** - Build complex UIs by composing primitives
6. **Follow the variant system** - Use provided variants instead of custom styles
7. **Leverage TypeScript** - All components are fully typed

## Migration from Local Components

If migrating from local shadcn/ui components:

1. Remove `components/ui` folder
2. Update imports:

   ```tsx
   // Before
   import { Button } from '@/components/ui/button'

   // After
   import { Button } from '@promptliano/ui'
   ```

3. Remove `lib/utils.ts` and update imports
4. Update Tailwind config to extend the UI package config
5. Test thoroughly - some props may have changed

## Contributing

When adding new components:

1. Follow the existing component structure
2. Include comprehensive TypeScript types
3. Add all necessary sub-components
4. Export from appropriate category index
5. Update this documentation
6. Test in both light and dark modes
7. Ensure accessibility compliance

## Support

For issues or questions:

- Check the component source code for detailed prop types
- Review the examples in this document
- Look at usage in the Promptliano codebase
- File an issue in the repository

---

This component library is actively maintained and new components are added regularly. Check back for updates!
