# Promptliano Brand Kit Summary

## Overview

This brand kit provides a comprehensive color system extracted from the Promptliano marketing website, organized for easy use across all brand materials and development projects.

## Color System Structure

### 1. Primary Brand Colors

- **Promptliano Purple** (#9333ea) - Primary brand identity
- **Promptliano Blue** (#3b82f6) - Secondary brand color
- **Promptliano Teal** (#14b8a6) - Accent color

### 2. Semantic Colors

- **Success Green** (#22c55e) - Positive states
- **Warning Amber** (#f59e0b) - Caution states
- **Error Red** (#ef4444) - Error states
- **Info Blue** (#0ea5e9) - Informational content

### 3. Extended Palette

- **Green-500** (#10b981) - Online indicators, success badges
- **Yellow-500** (#eab308) - Beta badges, in-progress states
- **Red-500** (#ef4444) - Advanced badges, destructive actions
- **Orange-500** (#f97316) - Data visualizations, summaries
- **Pink-500** (#ec4899) - Git-related features
- **Blue-500** (#3b82f6) - File types, links
- **Purple-500** (#a855f7) - AI/prompt features
- **Indigo-400** (#818cf8) - Community features

### 4. Neutral Scale

12 levels of gray from gray-50 (#fafafa) to gray-950 (#0a0a0a)

### 5. Gradients

- Primary to Secondary gradient
- Primary to Accent gradient
- Subtle overlays with 5-10% opacity
- Glassmorphism effects

## Deliverables

### 📁 Documentation

- `docs/COLOR_GUIDELINES.md` - Comprehensive usage guidelines
- `README.md` - Technical documentation and API reference
- `BRAND_KIT_SUMMARY.md` - This summary document

### 🎨 Data Files

- `src/colors.json` - Complete color data in JSON format
- `src/types.ts` - TypeScript type definitions
- `src/index.ts` - Utility functions and exports

### 🛠 Export Formats

Run `npm run generate-all` to create:

- `exports/promptliano-colors.css` - CSS variables
- `exports/promptliano-colors.scss` - SCSS variables
- `exports/tailwind-colors.js` - Tailwind configuration
- `exports/figma-tokens.json` - Figma Tokens format
- `exports/sketch-palette.sketchpalette` - Sketch palette
- `exports/promptliano-colors-ase.json` - Adobe format data
- `exports/color-preview.html` - Visual color preview

### 🧩 Components

- `src/components/ColorSwatch.tsx` - React component for color display

### 🔧 Utilities

- Color conversion functions (hex, rgb, hsl)
- Contrast checking for accessibility
- CSS variable generation
- Tailwind config generation

## Usage Quick Start

### For Developers

```bash
npm install @promptliano/brand-kit
```

```typescript
import { brandColors, checkContrast } from '@promptliano/brand-kit'
```

### For Designers

1. Import `exports/figma-tokens.json` into Figma Tokens plugin
2. Load `exports/sketch-palette.sketchpalette` into Sketch
3. Reference `exports/color-preview.html` for visual palette

### For CSS/Tailwind

```css
@import '@promptliano/brand-kit/exports/promptliano-colors.css';
```

## Key Features

### ✅ Accessibility

- All colors include WCAG contrast ratings
- Utility functions for contrast checking
- Guidelines for accessible color combinations

### 🎯 Consistency

- Single source of truth for all colors
- Consistent naming conventions
- Clear usage guidelines

### 🔄 Flexibility

- Multiple export formats
- Theme variations (dark/light)
- Programmatic color manipulation

### 📋 Documentation

- Comprehensive usage guidelines
- Color psychology insights
- Implementation examples

## Color Usage Matrix

| Color  | Primary Use              | Secondary Use     | Don't Use For     |
| ------ | ------------------------ | ----------------- | ----------------- |
| Purple | Main CTAs, Brand moments | Headers, Links    | Background colors |
| Blue   | Secondary actions        | Info states       | Primary CTAs      |
| Teal   | Success, Highlights      | Special features  | Errors            |
| Green  | Positive feedback        | Online status     | Warnings          |
| Amber  | Warnings, Beta           | In-progress       | Success           |
| Red    | Errors, Delete           | Difficulty levels | Success           |

## Next Steps

1. **Integration**: Add brand-kit to your project dependencies
2. **Testing**: Verify colors in both light and dark themes
3. **Validation**: Check accessibility compliance
4. **Distribution**: Share with design and development teams

## Maintenance

To add new colors:

1. Update `src/colors.json`
2. Document in guidelines
3. Run `npm run generate-all`
4. Test and validate
5. Version and publish updates
