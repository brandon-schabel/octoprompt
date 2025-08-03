# UI Components Migration Audit

## Current State

### Components Already in @promptliano/ui

- ✅ alert (with AlertTitle, AlertDescription)
- ✅ badge
- ✅ button (with gradient variant)
- ✅ card (with CardHeader, CardFooter, CardTitle, CardDescription, CardContent)
- ✅ dialog (with all sub-components)
- ✅ dropdown-menu (with all sub-components)
- ✅ input
- ✅ label
- ✅ separator
- ✅ tabs (with TabsList, TabsTrigger, TabsContent)
- ✅ textarea
- ✅ tooltip (with TooltipProvider, TooltipTrigger, TooltipContent)
- ✅ logo (custom brand component)

### Missing Core shadcn Components

#### Form Components (Priority: HIGH)

- ❌ **form.tsx** - Requires react-hook-form, @hookform/resolvers
- ❌ **checkbox.tsx** - Requires @radix-ui/react-checkbox
- ❌ **radio-group.tsx** - Requires @radix-ui/react-radio-group
- ❌ **switch.tsx** - Requires @radix-ui/react-switch
- ❌ **select.tsx** - Requires @radix-ui/react-select

#### Overlay Components (Priority: HIGH)

- ❌ **popover.tsx** - Requires @radix-ui/react-popover
- ❌ **sheet.tsx** - Uses dialog primitives
- ❌ **command.tsx** - Requires cmdk
- ❌ **context-menu.tsx** - Requires @radix-ui/react-context-menu
- ❌ **menubar.tsx** - Requires @radix-ui/react-menubar
- ❌ **drawer.tsx** - Requires vaul

#### Data Display Components (Priority: MEDIUM)

- ❌ **table.tsx** - Basic table component
- ❌ **data-table/** - Complex data table with sorting, filtering (requires @tanstack/react-table)
- ❌ **avatar.tsx** - Requires @radix-ui/react-avatar
- ❌ **skeleton.tsx** - Loading skeleton
- ❌ **progress.tsx** - Requires @radix-ui/react-progress
- ❌ **accordion.tsx** - Requires @radix-ui/react-accordion
- ❌ **collapsible.tsx** - Requires @radix-ui/react-collapsible
- ❌ **scroll-area.tsx** - Requires @radix-ui/react-scroll-area

#### Interaction Components (Priority: MEDIUM)

- ❌ **slider.tsx** - Requires @radix-ui/react-slider
- ❌ **toggle.tsx** - Requires @radix-ui/react-toggle
- ❌ **toggle-group.tsx** - Requires @radix-ui/react-toggle-group
- ❌ **alert-dialog.tsx** - Requires @radix-ui/react-alert-dialog
- ❌ **breadcrumb.tsx** - Navigation component

#### Utility Components (Priority: LOW)

- ❌ **sonner.tsx** - Toast notifications (requires sonner)
- ❌ **chart.tsx** - Chart component (requires recharts)
- ❌ **sidebar.tsx** - Navigation sidebar

### Custom Components (Evaluate for inclusion)

- ❓ **copyable-text.tsx** - Custom utility component
- ❓ **icons.tsx** - Icon definitions
- ❓ **resizable-panel.tsx** - Requires react-resizable-panels
- ❓ **responsive-container.tsx** - Custom layout component
- ❓ **sortable-panel.tsx** - DnD functionality
- ❓ **token-usage-tooltip.tsx** - Domain-specific component
- ❓ **draggable-three-column-panel.tsx** - Complex layout
- ❓ **three-column-resizable-panel.tsx** - Complex layout
- ❓ **vertical-resizable-panel.tsx** - Complex layout

## Migration Order

### Phase 1: Core Form Components

1. form.tsx (foundation for other form components)
2. checkbox.tsx
3. radio-group.tsx
4. switch.tsx
5. select.tsx

### Phase 2: Essential Overlays

1. popover.tsx
2. sheet.tsx
3. command.tsx
4. alert-dialog.tsx

### Phase 3: Data Display

1. table.tsx
2. skeleton.tsx
3. avatar.tsx
4. progress.tsx
5. accordion.tsx
6. collapsible.tsx
7. scroll-area.tsx

### Phase 4: Interactions & Utilities

1. slider.tsx
2. toggle.tsx
3. toggle-group.tsx
4. breadcrumb.tsx
5. sonner.tsx

### Phase 5: Complex Components

1. data-table/ (directory with multiple files)
2. menubar.tsx
3. context-menu.tsx
4. drawer.tsx
5. sidebar.tsx
6. chart.tsx

### Phase 6: Custom Components (Evaluate)

- Determine which custom components should be in the shared library

## Website Package Components to Replace

### Components to Replace with @promptliano/ui

- badge.tsx → Use @promptliano/ui Badge
- button.tsx → Use @promptliano/ui Button
- card.tsx → Use @promptliano/ui Card
- logo.tsx → Use @promptliano/ui Logo
- tabs.tsx → Use @promptliano/ui Tabs

### Website-Specific Components (Keep Local)

- animation-utils.tsx
- code-terminal.tsx
- cta-button.tsx (extends Button)
- download-button.tsx (extends Button)
- feature-card.tsx (extends Card)
- feature-screenshot.tsx
- glass-card.tsx (extends Card)
- hero.tsx
- screenshot-carousel.tsx
- screenshot-gallery.tsx

## Dependencies to Update

### Current peerDependencies (Good)

- react, react-dom
- class-variance-authority, clsx, tailwind-merge
- Basic Radix components already in peer deps

### Need to Add to peerDependencies

- @radix-ui/react-checkbox
- @radix-ui/react-radio-group
- @radix-ui/react-switch
- @radix-ui/react-select
- @radix-ui/react-popover
- @radix-ui/react-context-menu
- @radix-ui/react-menubar
- @radix-ui/react-avatar
- @radix-ui/react-progress
- @radix-ui/react-accordion
- @radix-ui/react-collapsible
- @radix-ui/react-scroll-area
- @radix-ui/react-slider
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-alert-dialog

### Keep as dependencies

- Complex third-party libs: cmdk, sonner, vaul, recharts, @tanstack/react-table
- These are less common and can stay as direct dependencies

## Special Considerations

1. **Form Component**: Central to many other components, needs careful migration
2. **Data Table**: Complex multi-file component, consider creating a separate export
3. **Chart Component**: Heavy dependency (recharts), might want to make optional
4. **Custom Layout Components**: Evaluate if they belong in shared library or are app-specific
5. **Icon System**: Need to decide on a unified approach for icons

## Next Steps

1. Start with Phase 1 (Core Form Components)
2. Update package.json dependencies before each phase
3. Test each component after migration
4. Update exports in src/index.ts
5. Document any breaking changes or API differences
