# Brand Kit Package - Promptliano Design System

You are an expert designer and developer working on the @promptliano/brand-kit package. This package contains the complete brand identity system for Promptliano, including colors, typography, design tokens, and brand utilities.

## Package Overview

The @promptliano/brand-kit package provides:

- Complete color system with semantic tokens
- Typography scales and font configurations
- Design tokens for consistent styling
- Brand guidelines and usage patterns
- Color manipulation utilities
- Theme generation tools

### Architecture

```
packages/brand-kit/
├── src/
│   ├── colors/              # Color system
│   │   ├── palette.ts       # Base color palette
│   │   ├── semantic.ts      # Semantic color tokens
│   │   └── themes.ts        # Light/dark themes
│   ├── typography/          # Typography system
│   │   ├── fonts.ts         # Font families
│   │   └── scales.ts        # Type scales
│   ├── tokens/              # Design tokens
│   │   ├── spacing.ts       # Spacing system
│   │   ├── borders.ts       # Border tokens
│   │   └── shadows.ts       # Shadow tokens
│   ├── utils/               # Brand utilities
│   │   ├── color-utils.ts   # Color manipulation
│   │   └── theme-generator.ts # Theme generation
│   ├── guidelines/          # Brand guidelines
│   └── index.ts            # Package exports
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze design consistency and color accessibility
   - Ensure proper WCAG compliance and theme support

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on token organization and utility functions

3. **Package-Specific Agents**
   - Use `design-system-expert` for design token patterns
   - Use `accessibility-expert` for color contrast validation
   - Use `css-expert` for CSS variable generation
   - Use `color-theory-expert` for color palette decisions

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about design decisions
- Use multiple agents concurrently for maximum efficiency
- Document all design tokens and their usage

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Token validation schemas
2. **Storage layer** - N/A for brand kit
3. **Services** - N/A for brand kit
4. **MCP tools** - N/A for brand kit
5. **API routes** - N/A for brand kit
6. **API client** - N/A for brand kit
7. **React hooks** - N/A for brand kit
8. **UI components** - Uses brand tokens (consumer)
9. **Page integration** - N/A for brand kit
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package provides the foundational design system that ensures visual consistency across all Promptliano applications and marketing materials.

## Color System

### Base Palette

Define the core color palette:

```typescript
export const colors = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main brand color
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49'
  },

  // Secondary colors
  secondary: {
    50: '#fdf4ff',
    100: '#fae8ff',
    200: '#f5d0fe',
    300: '#f0abfc',
    400: '#e879f9',
    500: '#d946ef',
    600: '#c026d3',
    700: '#a21caf',
    800: '#86198f',
    900: '#701a75',
    950: '#4a044e'
  },

  // Neutral colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a'
  },

  // Semantic colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16'
  },

  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03'
  },

  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a'
  }
} as const
```

### Semantic Tokens

Map colors to semantic meanings:

```typescript
export const semanticColors = {
  // Background colors
  background: {
    primary: 'var(--color-neutral-50)',
    secondary: 'var(--color-neutral-100)',
    tertiary: 'var(--color-neutral-200)',
    inverse: 'var(--color-neutral-900)'
  },

  // Text colors
  text: {
    primary: 'var(--color-neutral-900)',
    secondary: 'var(--color-neutral-700)',
    tertiary: 'var(--color-neutral-500)',
    inverse: 'var(--color-neutral-50)',
    brand: 'var(--color-primary-600)'
  },

  // Border colors
  border: {
    default: 'var(--color-neutral-200)',
    subtle: 'var(--color-neutral-100)',
    strong: 'var(--color-neutral-300)'
  },

  // Interactive states
  interactive: {
    hover: 'var(--color-primary-50)',
    active: 'var(--color-primary-100)',
    focus: 'var(--color-primary-500)',
    disabled: 'var(--color-neutral-300)'
  }
} as const
```

### Theme Generation

Generate light and dark themes:

```typescript
import Color from 'color'

export class ThemeGenerator {
  static generateTheme(baseColors: ColorPalette, mode: 'light' | 'dark') {
    const theme = mode === 'light' ? this.generateLightTheme(baseColors) : this.generateDarkTheme(baseColors)

    return this.toCSSVariables(theme)
  }

  private static generateLightTheme(colors: ColorPalette) {
    return {
      // Backgrounds
      'bg-primary': colors.neutral[50],
      'bg-secondary': colors.neutral[100],
      'bg-tertiary': colors.neutral[200],

      // Text
      'text-primary': colors.neutral[900],
      'text-secondary': colors.neutral[700],
      'text-tertiary': colors.neutral[500],

      // Borders
      'border-default': colors.neutral[200],
      'border-subtle': colors.neutral[100],
      'border-strong': colors.neutral[300],

      // Brand
      'brand-primary': colors.primary[500],
      'brand-hover': colors.primary[600],
      'brand-active': colors.primary[700]
    }
  }

  private static generateDarkTheme(colors: ColorPalette) {
    return {
      // Backgrounds (inverted)
      'bg-primary': colors.neutral[900],
      'bg-secondary': colors.neutral[800],
      'bg-tertiary': colors.neutral[700],

      // Text (inverted)
      'text-primary': colors.neutral[50],
      'text-secondary': colors.neutral[200],
      'text-tertiary': colors.neutral[400],

      // Borders (adjusted)
      'border-default': colors.neutral[700],
      'border-subtle': colors.neutral[800],
      'border-strong': colors.neutral[600],

      // Brand (adjusted for dark)
      'brand-primary': colors.primary[400],
      'brand-hover': colors.primary[300],
      'brand-active': colors.primary[200]
    }
  }

  private static toCSSVariables(theme: Record<string, string>): string {
    return Object.entries(theme)
      .map(([key, value]) => `--${key}: ${value};`)
      .join('\n')
  }
}
```

## Typography System

### Font Families

Define typography stack:

```typescript
export const fonts = {
  // Font families
  sans: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    weights: {
      thin: 100,
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900
    }
  },

  mono: {
    family: 'JetBrains Mono, Consolas, Monaco, monospace',
    weights: {
      regular: 400,
      medium: 500,
      bold: 700
    }
  },

  // Font imports
  imports: [
    '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@100;300;400;500;600;700;800;900&display=swap");',
    '@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap");'
  ]
} as const
```

### Type Scale

Define consistent type scales:

```typescript
export const typeScale = {
  // Display sizes
  display: {
    '2xl': { fontSize: '72px', lineHeight: '90px', letterSpacing: '-0.02em' },
    xl: { fontSize: '60px', lineHeight: '72px', letterSpacing: '-0.02em' },
    lg: { fontSize: '48px', lineHeight: '60px', letterSpacing: '-0.02em' },
    md: { fontSize: '36px', lineHeight: '44px', letterSpacing: '-0.02em' },
    sm: { fontSize: '30px', lineHeight: '36px', letterSpacing: '-0.01em' },
    xs: { fontSize: '24px', lineHeight: '32px', letterSpacing: '-0.01em' }
  },

  // Text sizes
  text: {
    xl: { fontSize: '20px', lineHeight: '30px', letterSpacing: '0' },
    lg: { fontSize: '18px', lineHeight: '28px', letterSpacing: '0' },
    md: { fontSize: '16px', lineHeight: '24px', letterSpacing: '0' },
    sm: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0' },
    xs: { fontSize: '12px', lineHeight: '16px', letterSpacing: '0' }
  },

  // Code sizes
  code: {
    lg: { fontSize: '16px', lineHeight: '24px', letterSpacing: '0' },
    md: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0' },
    sm: { fontSize: '13px', lineHeight: '18px', letterSpacing: '0' },
    xs: { fontSize: '12px', lineHeight: '16px', letterSpacing: '0' }
  }
} as const
```

## Design Tokens

### Spacing System

Consistent spacing scale:

```typescript
export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px'
} as const
```

### Border Tokens

Border styles and radii:

```typescript
export const borders = {
  width: {
    none: '0px',
    thin: '1px',
    medium: '2px',
    thick: '4px'
  },

  radius: {
    none: '0px',
    sm: '2px',
    md: '4px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    '3xl': '24px',
    full: '9999px'
  },

  style: {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted'
  }
} as const
```

### Shadow Tokens

Elevation shadows:

```typescript
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',

  // Colored shadows
  primary: '0 4px 14px 0 rgb(14 165 233 / 0.3)',
  success: '0 4px 14px 0 rgb(34 197 94 / 0.3)',
  error: '0 4px 14px 0 rgb(239 68 68 / 0.3)'
} as const
```

## Color Utilities

### Color Manipulation

Utility functions for colors:

```typescript
import Color from 'color'

export class ColorUtils {
  static lighten(color: string, amount: number): string {
    return Color(color).lighten(amount).hex()
  }

  static darken(color: string, amount: number): string {
    return Color(color).darken(amount).hex()
  }

  static alpha(color: string, alpha: number): string {
    return Color(color).alpha(alpha).string()
  }

  static mix(color1: string, color2: string, weight = 0.5): string {
    return Color(color1).mix(Color(color2), weight).hex()
  }

  static contrast(color: string): string {
    const luminosity = Color(color).luminosity()
    return luminosity > 0.5 ? '#000000' : '#ffffff'
  }

  static isAccessible(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean {
    const contrast = Color(foreground).contrast(Color(background))
    return level === 'AA' ? contrast >= 4.5 : contrast >= 7
  }

  static generatePalette(baseColor: string, steps = 11): string[] {
    const base = Color(baseColor)
    const palette: string[] = []

    for (let i = 0; i < steps; i++) {
      const lightness = 95 - i * 9
      palette.push(base.lightness(lightness).hex())
    }

    return palette
  }
}
```

## CSS Generation

### Generate CSS Variables

Export as CSS custom properties:

```typescript
export function generateCSSVariables(): string {
  const variables: string[] = []

  // Color variables
  Object.entries(colors).forEach(([name, shades]) => {
    Object.entries(shades).forEach(([shade, value]) => {
      variables.push(`--color-${name}-${shade}: ${value};`)
    })
  })

  // Spacing variables
  Object.entries(spacing).forEach(([key, value]) => {
    variables.push(`--spacing-${key}: ${value};`)
  })

  // Typography variables
  Object.entries(typeScale).forEach(([category, sizes]) => {
    Object.entries(sizes).forEach(([size, props]) => {
      variables.push(`--font-${category}-${size}: ${props.fontSize};`)
      variables.push(`--line-${category}-${size}: ${props.lineHeight};`)
    })
  })

  // Border variables
  Object.entries(borders.radius).forEach(([key, value]) => {
    variables.push(`--radius-${key}: ${value};`)
  })

  // Shadow variables
  Object.entries(shadows).forEach(([key, value]) => {
    variables.push(`--shadow-${key}: ${value};`)
  })

  return `:root {\n  ${variables.join('\n  ')}\n}`
}
```

### Tailwind Config Export

Export for Tailwind CSS:

```typescript
export function getTailwindConfig() {
  return {
    theme: {
      extend: {
        colors: {
          primary: colors.primary,
          secondary: colors.secondary,
          success: colors.success,
          warning: colors.warning,
          error: colors.error,
          neutral: colors.neutral
        },
        fontFamily: {
          sans: fonts.sans.family.split(','),
          mono: fonts.mono.family.split(',')
        },
        fontSize: Object.entries(typeScale.text).reduce((acc, [key, value]) => {
          acc[key] = [value.fontSize, { lineHeight: value.lineHeight }]
          return acc
        }, {}),
        spacing: spacing,
        borderRadius: borders.radius,
        boxShadow: shadows
      }
    }
  }
}
```

## Brand Guidelines

### Logo Usage

Define logo specifications:

```typescript
export const logoGuidelines = {
  // Minimum sizes
  minWidth: {
    icon: 24, // px
    wordmark: 120, // px
    full: 160 // px
  },

  // Clear space (multiple of logo height)
  clearSpace: 0.5,

  // Acceptable backgrounds
  backgrounds: {
    light: ['#ffffff', '#fafafa', '#f5f5f5'],
    dark: ['#171717', '#262626', '#404040']
  },

  // Color variations
  variations: {
    primary: colors.primary[500],
    mono: '#000000',
    inverse: '#ffffff'
  }
}
```

## Testing Brand Compliance

### Color Contrast Testing

Validate accessibility:

```typescript
import { describe, test, expect } from 'bun:test'
import { ColorUtils } from '../utils/color-utils'

describe('Color Accessibility', () => {
  test('text colors meet WCAG AA standards', () => {
    const textColor = colors.neutral[900]
    const bgColor = colors.neutral[50]

    expect(ColorUtils.isAccessible(textColor, bgColor, 'AA')).toBe(true)
  })

  test('button colors meet contrast requirements', () => {
    const buttonText = '#ffffff'
    const buttonBg = colors.primary[500]

    expect(ColorUtils.isAccessible(buttonText, buttonBg, 'AA')).toBe(true)
  })

  test('error colors are accessible', () => {
    const errorText = colors.error[600]
    const errorBg = colors.error[50]

    expect(ColorUtils.isAccessible(errorText, errorBg, 'AA')).toBe(true)
  })
})
```

## Best Practices

### 1. Color Usage

- Always use semantic tokens
- Check color contrast
- Support dark mode
- Use consistent opacity
- Test with color blindness

### 2. Typography

- Use type scale consistently
- Maintain readability
- Responsive font sizes
- Proper line heights
- Consistent font weights

### 3. Spacing

- Use spacing scale only
- Consistent padding/margins
- Maintain rhythm
- Visual hierarchy
- Responsive spacing

### 4. Maintenance

- Document all tokens
- Version changes
- Deprecate gracefully
- Test integrations
- Update guidelines

## Common Pitfalls to Avoid

1. **Hardcoded Values** - Always use design tokens
2. **Poor Contrast** - Test all color combinations
3. **Inconsistent Spacing** - Use the spacing scale
4. **Missing Dark Mode** - Support both themes
5. **Breaking Changes** - Version and deprecate properly
6. **Undocumented Tokens** - Document everything
7. **Accessibility Issues** - Test with tools

## Integration with Other Packages

- Used by **@promptliano/ui** for component styling
- Used by **@promptliano/website** for marketing design
- Used by **@promptliano/client** for application theming
- Provides CSS variables for all packages

The brand kit package is the visual foundation of Promptliano, ensuring consistent, accessible, and beautiful design across all touchpoints.
