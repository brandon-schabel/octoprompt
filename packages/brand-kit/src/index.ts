import colorsData from './colors.json'
import { ColorValue, BrandColors, ColorPalette, GradientDefinition } from './types'

export * from './types'
export { colorsData }

// Re-export structured data
export const brandColors = colorsData.brand
export const semanticColors = colorsData.semantic
export const extendedColors = colorsData.extended
export const neutralColors = colorsData.neutrals
export const gradients = colorsData.gradients
export const themes = colorsData.themes

// Utility functions
export function getColorByName(name: string): ColorValue | undefined {
  // Search in all color categories
  const allColors = {
    ...colorsData.brand,
    ...colorsData.semantic,
    ...colorsData.extended,
    ...colorsData.neutrals
  }

  return Object.values(allColors).find((color: any) => color.name?.toLowerCase() === name.toLowerCase())
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null

  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

// CSS variable generator
export function generateCSSVariables(theme: 'dark' | 'light' = 'dark'): string {
  const themeColors = colorsData.themes[theme]
  let css = ':root {\n'

  // Brand colors
  Object.entries(colorsData.brand).forEach(([key, color]) => {
    const hsl = hexToHsl(color.hex)
    if (hsl) {
      css += `  --color-${key}: ${hsl.h} ${hsl.s}% ${hsl.l}%;\n`
    }
  })

  // Semantic colors
  Object.entries(colorsData.semantic).forEach(([key, color]) => {
    const hsl = hexToHsl(color.hex)
    if (hsl) {
      css += `  --color-${key}: ${hsl.h} ${hsl.s}% ${hsl.l}%;\n`
    }
  })

  // Neutral colors
  Object.entries(colorsData.neutrals).forEach(([key, color]) => {
    const hsl = hexToHsl(color.hex)
    if (hsl) {
      css += `  --color-${key}: ${hsl.h} ${hsl.s}% ${hsl.l}%;\n`
    }
  })

  // Theme-specific mappings
  css += `\n  /* Theme: ${theme} */\n`
  Object.entries(themeColors).forEach(([key, value]) => {
    const hsl = hexToHsl(value)
    if (hsl) {
      css += `  --${key}: ${hsl.h} ${hsl.s}% ${hsl.l}%;\n`
    }
  })

  css += '}\n'
  return css
}

// Tailwind config generator
export function generateTailwindColors() {
  const colors: Record<string, any> = {}

  // Add brand colors
  Object.entries(colorsData.brand).forEach(([key, color]) => {
    colors[key] = color.hex
  })

  // Add semantic colors
  Object.entries(colorsData.semantic).forEach(([key, color]) => {
    colors[key] = color.hex
  })

  // Add extended colors as color-shade format
  Object.entries(colorsData.extended).forEach(([key, color]) => {
    const [colorName, shade] = key.split('-')
    if (!colors[colorName]) colors[colorName] = {}
    colors[colorName][shade] = color.hex
  })

  // Add gray scale
  colors.gray = {}
  Object.entries(colorsData.neutrals).forEach(([key, color]) => {
    const shade = key.split('-')[1]
    colors.gray[shade] = color.hex
  })

  return colors
}

// Accessibility checker
export function checkContrast(
  foreground: string,
  background: string
): {
  ratio: number
  aa: boolean
  aaa: boolean
  largeAA: boolean
  largeAAA: boolean
} {
  const getLuminance = (hex: string): number => {
    const rgb = hexToRgb(hex)
    if (!rgb) return 0

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
      val = val / 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    largeAA: ratio >= 3,
    largeAAA: ratio >= 4.5
  }
}
