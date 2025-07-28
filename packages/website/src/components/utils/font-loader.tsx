import { useEffect } from 'react'

interface FontConfig {
  family: string
  source: string
  descriptors?: FontFaceDescriptors
}

const FONT_CONFIGS: FontConfig[] = [
  {
    family: 'Inter',
    source: 'url("/fonts/inter-var.woff2") format("woff2-variations")',
    descriptors: {
      weight: '100 900',
      display: 'swap',
      style: 'normal'
    }
  },
  {
    family: 'JetBrains Mono',
    source: 'url("/fonts/jetbrains-mono.woff2") format("woff2")',
    descriptors: {
      weight: '400',
      display: 'swap',
      style: 'normal'
    }
  }
]

export function FontLoader() {
  useEffect(() => {
    if ('fonts' in document) {
      const fontPromises = FONT_CONFIGS.map(async ({ family, source, descriptors }) => {
        try {
          const fontFace = new FontFace(family, source, descriptors)
          await fontFace.load()
          document.fonts.add(fontFace)
        } catch (error) {
          console.error(`Failed to load font ${family}:`, error)
        }
      })

      Promise.all(fontPromises).then(() => {
        document.documentElement.classList.add('fonts-loaded')
      })
    }
  }, [])

  return null
}

// CSS to handle font loading states
export const fontLoadingStyles = `
  /* Default font stack while loading */
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Apply custom fonts when loaded */
  .fonts-loaded body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .fonts-loaded code,
  .fonts-loaded pre {
    font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  }

  /* Prevent layout shift */
  body {
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Font loading animation */
  body:not(.fonts-loaded) {
    opacity: 0.95;
    transition: opacity 0.3s ease-in-out;
  }

  .fonts-loaded body {
    opacity: 1;
  }
`

// Preload critical fonts
export function preloadFonts() {
  const link1 = document.createElement('link')
  link1.rel = 'preload'
  link1.as = 'font'
  link1.type = 'font/woff2'
  link1.href = '/fonts/inter-var.woff2'
  link1.crossOrigin = 'anonymous'

  const link2 = document.createElement('link')
  link2.rel = 'preload'
  link2.as = 'font'
  link2.type = 'font/woff2'
  link2.href = '/fonts/jetbrains-mono.woff2'
  link2.crossOrigin = 'anonymous'

  document.head.appendChild(link1)
  document.head.appendChild(link2)
}
