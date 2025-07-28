export interface ColorValue {
  name: string
  hex: string
  rgb: string
  hsl: string
  usage: string
  accessibility?: {
    onWhite: string
    onBlack: string
  }
  contexts?: string[]
}

export interface NeutralColor {
  hex: string
  rgb: string
  hsl: string
}

export interface GradientDefinition {
  name: string
  from: string
  to: string
  via?: string
  direction: string
  usage: string
}

export interface GlassmorphismDefinition {
  name: string
  background: string
  backdropBlur: string
  border: string
  usage: string
}

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  muted: string
  mutedForeground: string
  border: string
}

export interface BrandColors {
  primary: ColorValue
  secondary: ColorValue
  accent: ColorValue
}

export interface SemanticColors {
  success: ColorValue
  warning: ColorValue
  error: ColorValue
  info: ColorValue
}

export interface ExtendedColors {
  [key: string]: ColorValue
}

export interface NeutralColors {
  [key: string]: NeutralColor
}

export interface ColorPalette {
  brand: BrandColors
  semantic: SemanticColors
  extended: ExtendedColors
  neutrals: NeutralColors
  gradients: Record<string, GradientDefinition | GlassmorphismDefinition>
  themes: {
    dark: ThemeColors
    light: ThemeColors
  }
}
