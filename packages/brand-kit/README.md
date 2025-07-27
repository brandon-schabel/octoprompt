# Promptliano Brand Kit

A comprehensive brand kit containing all colors, guidelines, and utilities for the Promptliano brand.

## Contents

- **Color Palette**: Complete color system with primary, secondary, semantic, and extended colors
- **Design Guidelines**: Best practices for color usage and accessibility
- **Export Formats**: Multiple file formats for various design tools
- **Utilities**: Helper functions for color manipulation and theme generation

## Quick Start

```bash
# Install dependencies
npm install

# Generate all export files
npm run generate-exports
```

## Color System Overview

### Brand Colors

- **Primary (Purple)**: `#9333ea` - Main brand color for CTAs and key elements
- **Secondary (Blue)**: `#3b82f6` - Supporting color for secondary actions
- **Accent (Teal)**: `#14b8a6` - Highlight color for special features

### Semantic Colors

- **Success**: `#22c55e` - Positive states and confirmations
- **Warning**: `#f59e0b` - Caution states and alerts
- **Error**: `#ef4444` - Error states and destructive actions
- **Info**: `#0ea5e9` - Informational content

### Extended Palette

Additional colors for specific features and contexts, including colors for Git integration, AI features, data visualization, and more.

## Usage

### In JavaScript/TypeScript

```typescript
import { brandColors, semanticColors, checkContrast } from '@promptliano/brand-kit'

// Access color values
console.log(brandColors.primary.hex) // #9333ea

// Check accessibility
const contrast = checkContrast('#9333ea', '#ffffff')
console.log(contrast.aa) // true
```

### In CSS

```css
@import '@promptliano/brand-kit/exports/promptliano-colors.css';

.button {
  background: hsl(var(--color-primary));
  color: hsl(var(--color-white));
}
```

### In Tailwind

```javascript
// tailwind.config.js
const brandColors = require('@promptliano/brand-kit/exports/tailwind-colors')

module.exports = {
  theme: {
    extend: {
      colors: brandColors.theme.extend.colors
    }
  }
}
```

## Available Exports

After running `npm run generate-exports`, you'll find:

- `exports/promptliano-colors.css` - CSS variables
- `exports/promptliano-colors.scss` - SCSS variables
- `exports/tailwind-colors.js` - Tailwind configuration
- `exports/figma-tokens.json` - Figma Tokens plugin format
- `exports/sketch-palette.sketchpalette` - Sketch palette
- `exports/promptliano-colors-ase.json` - Adobe Swatch Exchange data

## API Reference

### Functions

#### `getColorByName(name: string): ColorValue | undefined`

Find a color by its name across all color categories.

#### `hexToRgb(hex: string): { r: number; g: number; b: number } | null`

Convert hex color to RGB values.

#### `hexToHsl(hex: string): { h: number; s: number; l: number } | null`

Convert hex color to HSL values.

#### `generateCSSVariables(theme: 'dark' | 'light'): string`

Generate CSS custom properties for a theme.

#### `generateTailwindColors(): object`

Generate Tailwind-compatible color configuration.

#### `checkContrast(foreground: string, background: string): ContrastResult`

Check WCAG contrast compliance between two colors.

## Guidelines

See `docs/COLOR_GUIDELINES.md` for comprehensive usage guidelines, including:

- Color combinations
- Accessibility requirements
- Theme variations
- Do's and don'ts

## Contributing

When adding new colors:

1. Update `src/colors.json` with the new color data
2. Document usage in the guidelines
3. Run `npm run generate-exports` to update all export files
4. Test accessibility compliance
