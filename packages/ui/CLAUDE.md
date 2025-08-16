# UI Package - Promptliano Component Library

You are an expert React component library developer working on the @promptliano/ui package. This is a comprehensive component library built on top of shadcn/ui, providing reusable React components for all Promptliano applications.

## Package Overview

The @promptliano/ui package is a shared component library that:

- Provides a consistent design system across Promptliano applications
- Extends shadcn/ui components with custom functionality
- Includes specialized components for code editing, data visualization, and AI interactions
- Maintains accessibility standards and responsive design
- Exports fully styled, production-ready components

### Architecture

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── core/          # Core UI primitives (Button, Input, etc.)
│   │   ├── data/          # Data display (Table, Accordion, etc.)
│   │   ├── data-table/    # Advanced data table with filtering
│   │   ├── chart/         # Data visualization components
│   │   ├── code/          # Code display and editing
│   │   ├── editors/       # Monaco editor integrations
│   │   ├── markdown/      # Markdown rendering components
│   │   ├── layout/        # Layout components (Sidebar, Container)
│   │   ├── overlay/       # Overlays (Dialog, Drawer, Tooltip)
│   │   ├── feedback/      # User feedback (Loading, Toast)
│   │   ├── errors/        # Error boundaries and displays
│   │   ├── file/          # File handling (Upload, Diff viewer)
│   │   ├── interaction/   # Interactive elements (Toggle, Slider)
│   │   ├── resizable/     # Resizable panels and layouts
│   │   ├── surface/       # Surface components (Card, GlassCard)
│   │   ├── motion/        # Animation utilities
│   │   ├── brand/         # Brand-specific (Logo)
│   │   ├── marketing/     # Marketing components
│   │   └── utility/       # Utility components
│   ├── utils/             # Component utilities
│   ├── styles/            # Global styles and CSS
│   └── index.ts           # Package exports
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze component quality, accessibility, and reusability
   - Ensure proper TypeScript types and prop interfaces

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on component composition and separation of concerns

3. **Package-Specific Agents**
   - Use `promptliano-ui-architect` for shadcn/ui patterns and best practices
   - Use `react-component-architect` for component architecture
   - Use `accessibility-expert` for WCAG compliance
   - Use `css-tailwind-expert` for styling patterns
   - Use `storybook-expert` if implementing component documentation
   - Use `promptliano-ui-architect` for Promptliano-specific patterns

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about component requirements
- Use multiple agents concurrently for maximum efficiency
- Document all component props and usage examples

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define prop validation schemas if needed
2. **Storage layer** - N/A for UI library
3. **Services** - N/A for UI library
4. **MCP tools** - N/A for UI library
5. **API routes** - N/A for UI library
6. **API client** - N/A for UI library
7. **React hooks** - Component-specific hooks
8. **UI components** - Core development (this package)
9. **Page integration** - Used by other packages
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package provides the foundational UI components for all Promptliano applications, ensuring consistency, accessibility, and reusability across the ecosystem.

## Component Development Patterns

### Base Component Structure

Every component follows this pattern:

```typescript
import * as React from 'react'
import { cn } from '@/utils'
import { cva, type VariantProps } from 'class-variance-authority'

// Define variants using CVA
const componentVariants = cva(
  'base-classes-here',
  {
    variants: {
      variant: {
        default: 'default-variant-classes',
        secondary: 'secondary-variant-classes'
      },
      size: {
        sm: 'text-sm h-8',
        md: 'text-base h-10',
        lg: 'text-lg h-12'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

// Define prop types
export interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Additional props
  isLoading?: boolean
  icon?: React.ReactNode
}

// Forward ref component
export const Component = React.forwardRef<
  HTMLDivElement,
  ComponentProps
>(({ className, variant, size, isLoading, icon, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(componentVariants({ variant, size }), className)}
      {...props}
    >
      {isLoading && <Spinner />}
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </div>
  )
})

Component.displayName = 'Component'
```

### Compound Components Pattern

For complex components with multiple parts:

```typescript
// Parent component
export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  onRowSelect?: (row: TData) => void
}

export function DataTable<TData>({
  columns,
  data,
  onRowSelect
}: DataTableProps<TData>) {
  return (
    <DataTableProvider value={{ columns, data, onRowSelect }}>
      <div className="space-y-4">
        <DataTableToolbar />
        <DataTableContent />
        <DataTablePagination />
      </div>
    </DataTableProvider>
  )
}

// Child components
DataTable.Toolbar = DataTableToolbar
DataTable.Content = DataTableContent
DataTable.Pagination = DataTablePagination

// Usage
<DataTable columns={columns} data={data}>
  <DataTable.Toolbar />
  <DataTable.Content />
  <DataTable.Pagination />
</DataTable>
```

### Polymorphic Components

Components that can render as different elements:

```typescript
type PolymorphicRef<C extends React.ElementType> =
  React.ComponentPropsWithRef<C>['ref']

type PolymorphicProps<
  C extends React.ElementType,
  Props = {}
> = Props & {
  as?: C
} & Omit<React.ComponentPropsWithRef<C>, keyof Props | 'as'>

export const Box = React.forwardRef(
  <C extends React.ElementType = 'div'>(
    { as, ...props }: PolymorphicProps<C>,
    ref?: PolymorphicRef<C>
  ) => {
    const Component = as || 'div'
    return <Component ref={ref} {...props} />
  }
)

// Usage
<Box as="section" className="container">
  <Box as="h1">Title</Box>
  <Box as="button" onClick={handleClick}>Click me</Box>
</Box>
```

## Shadcn/UI Integration

### Extending Shadcn Components

Build on top of shadcn primitives:

```typescript
import { Button as ShadcnButton } from './core/button'
import { Loader2 } from 'lucide-react'

export interface LoadingButtonProps
  extends React.ComponentProps<typeof ShadcnButton> {
  isLoading?: boolean
  loadingText?: string
}

export function LoadingButton({
  isLoading,
  loadingText = 'Loading...',
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <ShadcnButton
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </ShadcnButton>
  )
}
```

### Custom Shadcn Themes

Define custom theme variations:

```typescript
// In tailwind.config.js or CSS variables
export const customTheme = {
  colors: {
    border: 'hsl(var(--border))',
    input: 'hsl(var(--input))',
    ring: 'hsl(var(--ring))',
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    primary: {
      DEFAULT: 'hsl(var(--primary))',
      foreground: 'hsl(var(--primary-foreground))'
    },
    // Custom Promptliano colors
    promptliano: {
      DEFAULT: 'hsl(var(--promptliano))',
      foreground: 'hsl(var(--promptliano-foreground))'
    }
  }
}
```

## Specialized Components

### Monaco Editor Integration

Lazy-loaded code editor components:

```typescript
import { lazy, Suspense } from 'react'
import { Skeleton } from './core/skeleton'

const MonacoEditor = lazy(() => import('./editors/monaco-editor-wrapper'))

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  theme?: 'vs-dark' | 'vs-light'
  options?: Monaco.IStandaloneEditorConstructionOptions
}

export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={<Skeleton className="h-[400px]" />}>
      <MonacoEditor {...props} />
    </Suspense>
  )
}
```

### Data Table with Advanced Features

Complete data table implementation:

```typescript
export function DataTable<TData>({
  columns,
  data,
  filterableColumns = [],
  searchableColumns = [],
  onRowClick,
  onSelectionChange
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection
    }
  })

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        filterableColumns={filterableColumns}
        searchableColumns={searchableColumns}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {/* Header implementation */}
          </TableHeader>
          <TableBody>
            {/* Body implementation */}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
```

### Markdown Components

Rich markdown rendering:

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
      }}
      className="prose prose-invert max-w-none"
    >
      {content}
    </ReactMarkdown>
  )
}
```

## Accessibility Standards

### ARIA Patterns

Implement proper ARIA attributes:

```typescript
export function Modal({
  isOpen,
  onClose,
  title,
  children
}: ModalProps) {
  const titleId = useId()
  const descId = useId()

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
        </DialogHeader>
        <div id={descId}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Keyboard Navigation

Support full keyboard navigation:

```typescript
export function Menu({ items }: MenuProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev < items.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev > 0 ? prev - 1 : items.length - 1
        )
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        items[focusedIndex]?.onClick?.()
        break
      case 'Escape':
        onClose?.()
        break
    }
  }

  return (
    <ul role="menu" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <li
          key={item.id}
          role="menuitem"
          tabIndex={focusedIndex === index ? 0 : -1}
          aria-selected={focusedIndex === index}
        >
          {item.label}
        </li>
      ))}
    </ul>
  )
}
```

## Testing Components

### Unit Testing Pattern

Test component behavior and props:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    fireEvent.click(screen.getByText('Click'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies variant classes', () => {
    const { container } = render(
      <Button variant="destructive">Delete</Button>
    )
    expect(container.firstChild).toHaveClass('bg-destructive')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Button</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
```

### Accessibility Testing

Test for accessibility compliance:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accessible Dialog</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            This dialog should be accessible
          </DialogDescription>
        </DialogContent>
      </Dialog>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

## Bundle Optimization

### Tree Shaking Setup

Ensure proper tree shaking in the build:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PromptlianoUI',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    rollupOptions: {
      external: ['react', 'react-dom', /^@radix-ui/, /^@tanstack/, 'framer-motion'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    }
  }
})
```

### Component Code Splitting

Export components individually for better tree shaking:

```typescript
// src/index.ts
// Core components
export { Button } from './components/core/button'
export { Input } from './components/core/input'
export { Card } from './components/core/card'

// Data components
export { DataTable } from './components/data-table/data-table'
export { Chart } from './components/chart/chart'

// Lazy-loaded components
export { LazyMonacoEditor } from './components/editors/lazy-monaco-editor'
export { LazyMonacoDiffViewer } from './components/editors/lazy-monaco-diff-viewer'

// Types
export type { ButtonProps } from './components/core/button'
export type { DataTableProps } from './components/data-table/types'
```

## Documentation

### Component Documentation Pattern

Document each component thoroughly:

````typescript
/**
 * Button component with multiple variants and sizes
 *
 * @example
 * ```tsx
 * <Button variant="default" size="md" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 *
 * @example Loading state
 * ```tsx
 * <Button isLoading loadingText="Saving...">
 *   Save
 * </Button>
 * ```
 */
export interface ButtonProps {
  /**
   * Visual style variant
   * @default "default"
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'

  /**
   * Button size
   * @default "md"
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Loading state - disables button and shows spinner
   */
  isLoading?: boolean

  /**
   * Text to display when loading
   * @default "Loading..."
   */
  loadingText?: string
}
````

## Best Practices

### 1. Component Design

- Keep components small and focused (Single Responsibility)
- Use composition over inheritance
- Make components fully controlled when possible
- Provide sensible defaults for all props
- Export prop types for TypeScript consumers

### 2. Performance

- Use React.memo for expensive components
- Implement proper key props for lists
- Lazy load heavy components (Monaco, Charts)
- Minimize re-renders with proper deps
- Use CSS for animations when possible

### 3. Accessibility

- Include proper ARIA labels
- Support keyboard navigation
- Maintain focus management
- Provide screen reader descriptions
- Test with accessibility tools

### 4. Styling

- Use Tailwind utilities consistently
- Support dark/light themes
- Allow className overrides
- Use CSS variables for theming
- Maintain responsive design

### 5. Testing

- Write unit tests for all components
- Test accessibility compliance
- Test keyboard interactions
- Test error states
- Document with examples

## Common Pitfalls to Avoid

1. **Prop Drilling** - Use context or composition patterns
2. **Inline Functions** - Memoize callbacks with useCallback
3. **Missing ForwardRef** - Always forward refs for DOM components
4. **Hard-coded Values** - Use theme variables and props
5. **Breaking Changes** - Version properly and deprecate gracefully
6. **Missing TypeScript Types** - Export all prop interfaces
7. **Inaccessible Components** - Test with screen readers

## Package Exports

The package exports should be organized and tree-shakeable:

```typescript
// Main exports
export * from './components/core'
export * from './components/data'
export * from './components/data-table'
export * from './components/chart'
export * from './components/layout'

// Utility exports
export { cn } from './utils'
export { cva } from 'class-variance-authority'

// Type exports
export type * from './types'
```

## Integration with Other Packages

- Used by **@promptliano/client** for the main application UI
- Used by **@promptliano/website** for the marketing site
- Uses **@promptliano/brand-kit** for color system and brand assets
- Maintains zero runtime dependencies on other Promptliano packages

The UI package is the foundation of Promptliano's visual identity and user experience. Every component should be crafted with care, thoroughly tested, and designed for maximum reusability across the ecosystem.
