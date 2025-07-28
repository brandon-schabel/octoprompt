import fs from 'fs'
import path from 'path'
import { colorsData, generateCSSVariables, generateTailwindColors } from '../index'

const EXPORTS_DIR = path.join(__dirname, '../../exports')

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true })
}

// Generate CSS variables file
function generateCSSFile() {
  const darkCSS = generateCSSVariables('dark')
  const lightCSS = generateCSSVariables('light')

  const cssContent = `/* Promptliano Brand Colors - CSS Variables */
/* Generated on ${new Date().toISOString()} */

/* Dark Theme (Default) */
${darkCSS}

/* Light Theme */
.light {
${lightCSS.split('\n').slice(1, -1).join('\n')}
}`

  fs.writeFileSync(path.join(EXPORTS_DIR, 'promptliano-colors.css'), cssContent)
  console.log('✅ Generated CSS variables file')
}

// Generate SCSS variables file
function generateSCSSFile() {
  let scssContent = `// Promptliano Brand Colors - SCSS Variables
// Generated on ${new Date().toISOString()}

// Brand Colors
`

  Object.entries(colorsData.brand).forEach(([key, color]) => {
    scssContent += `$color-${key}: ${color.hex};\n`
  })

  scssContent += '\n// Semantic Colors\n'
  Object.entries(colorsData.semantic).forEach(([key, color]) => {
    scssContent += `$color-${key}: ${color.hex};\n`
  })

  scssContent += '\n// Extended Palette\n'
  Object.entries(colorsData.extended).forEach(([key, color]) => {
    scssContent += `$color-${key}: ${color.hex};\n`
  })

  scssContent += '\n// Neutral Colors\n'
  Object.entries(colorsData.neutrals).forEach(([key, color]) => {
    scssContent += `$color-${key}: ${color.hex};\n`
  })

  fs.writeFileSync(path.join(EXPORTS_DIR, 'promptliano-colors.scss'), scssContent)
  console.log('✅ Generated SCSS variables file')
}

// Generate Tailwind config
function generateTailwindConfigFile() {
  const colors = generateTailwindColors()

  const configContent = `// Promptliano Brand Colors - Tailwind Config
// Generated on ${new Date().toISOString()}

module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 2)}
    }
  }
};`

  fs.writeFileSync(path.join(EXPORTS_DIR, 'tailwind-colors.js'), configContent)
  console.log('✅ Generated Tailwind config file')
}

// Generate Figma tokens (JSON format that Figma plugins can import)
function generateFigmaTokens() {
  const figmaTokens: any = {
    global: {
      brand: {},
      semantic: {},
      neutral: {}
    }
  }

  // Brand colors
  Object.entries(colorsData.brand).forEach(([key, color]) => {
    figmaTokens.global.brand[key] = {
      value: color.hex,
      type: 'color',
      description: color.usage
    }
  })

  // Semantic colors
  Object.entries(colorsData.semantic).forEach(([key, color]) => {
    figmaTokens.global.semantic[key] = {
      value: color.hex,
      type: 'color',
      description: color.usage
    }
  })

  // Neutral colors
  Object.entries(colorsData.neutrals).forEach(([key, color]) => {
    figmaTokens.global.neutral[key] = {
      value: color.hex,
      type: 'color'
    }
  })

  fs.writeFileSync(path.join(EXPORTS_DIR, 'figma-tokens.json'), JSON.stringify(figmaTokens, null, 2))
  console.log('✅ Generated Figma tokens file')
}

// Generate Adobe Swatch Exchange (.ase) format
function generateASEFile() {
  // Note: This generates a JSON representation of ASE data
  // A proper ASE file would need binary encoding
  const aseData = {
    version: '1.0',
    groups: [
      {
        name: 'Promptliano Brand',
        colors: Object.entries(colorsData.brand).map(([key, color]) => ({
          name: color.name,
          hex: color.hex,
          model: 'RGB'
        }))
      },
      {
        name: 'Semantic',
        colors: Object.entries(colorsData.semantic).map(([key, color]) => ({
          name: color.name,
          hex: color.hex,
          model: 'RGB'
        }))
      }
    ]
  }

  fs.writeFileSync(path.join(EXPORTS_DIR, 'promptliano-colors-ase.json'), JSON.stringify(aseData, null, 2))
  console.log('✅ Generated ASE format data (JSON representation)')
}

// Generate Sketch palette
function generateSketchPalette() {
  const sketchPalette = {
    compatibleVersion: '2.0',
    pluginVersion: '2.22',
    colors: [
      ...Object.values(colorsData.brand).map((color) => ({
        name: color.name,
        red: parseInt(color.hex.slice(1, 3), 16) / 255,
        green: parseInt(color.hex.slice(3, 5), 16) / 255,
        blue: parseInt(color.hex.slice(5, 7), 16) / 255,
        alpha: 1
      })),
      ...Object.values(colorsData.semantic).map((color) => ({
        name: color.name,
        red: parseInt(color.hex.slice(1, 3), 16) / 255,
        green: parseInt(color.hex.slice(3, 5), 16) / 255,
        blue: parseInt(color.hex.slice(5, 7), 16) / 255,
        alpha: 1
      }))
    ]
  }

  fs.writeFileSync(path.join(EXPORTS_DIR, 'sketch-palette.sketchpalette'), JSON.stringify(sketchPalette, null, 2))
  console.log('✅ Generated Sketch palette file')
}

// Run all generators
function generateAll() {
  console.log('🎨 Generating Promptliano brand color exports...\n')

  generateCSSFile()
  generateSCSSFile()
  generateTailwindConfigFile()
  generateFigmaTokens()
  generateASEFile()
  generateSketchPalette()

  console.log('\n✨ All export files generated successfully!')
  console.log(`📁 Files saved to: ${EXPORTS_DIR}`)
}

generateAll()
