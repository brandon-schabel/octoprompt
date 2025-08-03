# @promptliano/ui

Shared UI component library for Promptliano applications, built on top of [shadcn/ui](https://ui.shadcn.com/).

## Installation

```bash
# Using bun
bun add @promptliano/ui

# Using npm
npm install @promptliano/ui

# Using yarn
yarn add @promptliano/ui
```

## Usage

### Basic Component Usage

```tsx
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example Component</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex gap-2'>
          <Button>Default Button</Button>
          <Button variant='gradient'>Gradient Button</Button>
          <Badge>New Feature</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Logo Component

```tsx
import { Logo } from '@promptliano/ui'

// Compact variant (default for client)
<Logo size="md" />

// Expanded variant (for website)
<Logo size="lg" variant="expanded" showGlow />

// Custom logo source
<Logo src="/custom-logo.png" alt="Custom Logo" />
```

### Utility Functions

```tsx
import { cn, formatDate } from '@promptliano/ui'

// Merge class names
const className = cn('base-class', condition && 'conditional-class', 'final-class')

// Format dates consistently
const formatted = formatDate(new Date()) // "Jan 15, 2024, 14:30:45"
```

## Styling

### Importing Global Styles

Add this to your app's main CSS file:

```css
@import '@promptliano/ui/dist/styles/globals.css';
```

### Tailwind Configuration

Extend your `tailwind.config.js` with the UI package configuration:

```js
const uiConfig = require('@promptliano/ui/tailwind.config.js')

module.exports = {
  ...uiConfig,
  content: [...uiConfig.content, './src/**/*.{js,ts,jsx,tsx}', './node_modules/@promptliano/ui/dist/**/*.js']
  // Your custom configuration
}
```

## Available Components

### Core Components

- `Alert`, `AlertTitle`, `AlertDescription` - Display important messages
- `Badge` - Small status indicators with variants
- `Button` - Interactive buttons with multiple variants including gradient
- `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` - Container components
- `Dialog` - Modal dialogs with all sub-components
- `DropdownMenu` - Dropdown menus with all sub-components
- `Input` - Form input fields
- `Label` - Form labels
- `Separator` - Visual dividers
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - Tab navigation
- `Textarea` - Multi-line text inputs
- `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` - Hover tooltips

### Brand Components

- `Logo` - Promptliano logo with size and variant options

## Component Variants

### Button Variants

- `default` - Primary action button
- `secondary` - Secondary action button
- `destructive` - Dangerous actions
- `outline` - Bordered button
- `ghost` - Minimal button
- `link` - Text link style
- `gradient` - Special gradient button

### Badge Variants

- `default` - Standard badge
- `secondary` - Secondary badge
- `destructive` - Error/danger badge
- `outline` - Bordered badge
- `count` - Numeric count badge
- `warning` - Warning badge
- `high` - High priority badge

## Development

### Building the Package

```bash
# Build for production
bun run build

# Build in watch mode
bun run dev

# Type check
bun run typecheck
```

### Peer Dependencies

This package requires the following peer dependencies:

- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `class-variance-authority` >= 0.7.0
- `clsx` >= 2.1.0
- `tailwind-merge` >= 2.2.0
- Various `@radix-ui` components

## Migration Guide

### From Local Components

1. Remove local UI components from `src/components/ui`
2. Update imports:

   ```tsx
   // Before
   import { Button } from '@/components/ui/button'

   // After
   import { Button } from '@promptliano/ui'
   ```

3. Remove local `lib/utils.ts` and use the package version
4. Update your Tailwind config to extend the UI package config

## Contributing

When adding new components:

1. Follow the existing component structure
2. Export from appropriate barrel files
3. Include TypeScript types
4. Follow shadcn/ui patterns
5. Test in both client and website contexts

## License

Internal Promptliano package - see root LICENSE file
