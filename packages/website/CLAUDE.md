# Website Package - Marketing Site for Promptliano

You are an expert React/TypeScript developer working on the Promptliano marketing website. This package is a modern React application built with TanStack Router, Framer Motion for animations, and components from the @promptliano/ui package.

## Architecture Overview

### Core Stack

- **React 19** with TypeScript
- **TanStack Router** for file-based routing with type-safe search params
- **TanStack Query** for data fetching
- **@promptliano/ui** for component library (our own shadcn-based components)
- **Framer Motion** for animations and interactions
- **Tailwind CSS** for styling
- **Vite** for build tooling and dev server
- **PWA Support** via vite-plugin-pwa
- **react-markdown** for documentation rendering

### Project Structure

```
packages/website/
├── src/
│   ├── components/        # Website-specific components
│   │   ├── landing/      # Landing page sections
│   │   ├── docs/         # Documentation components
│   │   ├── pricing/      # Pricing components
│   │   └── layout/       # Layout components
│   ├── routes/           # File-based routing (TanStack Router)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and configurations
│   ├── content/          # Markdown content and documentation
│   ├── assets/           # Images and static assets
│   └── styles/           # Global styles and themes
├── public/               # Static assets and PWA manifest
└── scripts/              # Build and optimization scripts
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure SEO best practices, performance optimizations, and accessibility

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on component reusability and performance

3. **Package-Specific Agents**
   - Use `promptliano-ui-architect` for React component development
   - Use `tanstack-router-expert` for routing implementation
   - Use `framer-motion-expert` for animations and interactions
   - Use `seo-optimization-expert` for search engine optimization
   - Use `performance-expert` for Core Web Vitals optimization
   - Use `promptliano-ui-architect` for using @promptliano/ui components

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about marketing goals and user experience
- Use multiple agents concurrently for maximum efficiency
- Include performance metrics and SEO considerations

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define form validation schemas
2. **Storage layer** - N/A (static site)
3. **Services** - N/A (static site)
4. **MCP tools** - N/A (static site)
5. **API routes** - N/A (uses external APIs if needed)
6. **API client** - Minimal API integration if needed
7. **React hooks** - Custom hooks for website functionality
8. **UI components** - Import from @promptliano/ui (this package)
9. **Page integration** - Marketing pages and routes (this package)
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles the marketing website, documentation, and public-facing content for Promptliano, focusing on performance, SEO, and user engagement.

## Using @promptliano/ui Components

### Import Pattern

Always import components from @promptliano/ui:

```typescript
import {
  Button,
  Card,
  Dialog,
  GlassCard,
  Logo,
  DataTable,
  MarkdownPreview
} from '@promptliano/ui'

// Use in your components
export function HeroSection() {
  return (
    <GlassCard className="p-8">
      <Logo size="large" />
      <h1 className="text-4xl font-bold">Welcome to Promptliano</h1>
      <Button size="lg" variant="default">
        Get Started
      </Button>
    </GlassCard>
  )
}
```

### Component Composition

Compose marketing components using UI primitives:

```typescript
import { Card, Button, Badge } from '@promptliano/ui'
import { motion } from 'framer-motion'

export function FeatureCard({
  title,
  description,
  icon,
  badge
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="p-6 hover:shadow-lg transition-shadow">
        {badge && <Badge variant="secondary">{badge}</Badge>}
        <div className="flex items-center gap-4 mb-4">
          {icon}
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>
        <p className="text-muted-foreground">{description}</p>
        <Button variant="ghost" className="mt-4">
          Learn More →
        </Button>
      </Card>
    </motion.div>
  )
}
```

## Animation Patterns with Framer Motion

### Page Transitions

Implement smooth page transitions:

```typescript
import { motion, AnimatePresence } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0, x: -20 },
  enter: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
}

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### Scroll Animations

Use intersection observer for scroll-triggered animations:

```typescript
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

export function ScrollReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
```

## SEO Optimization

### Meta Tags Management

Use proper meta tags for each page:

```typescript
export function SEOHead({
  title,
  description,
  image,
  url
}: SEOProps) {
  return (
    <>
      <title>{title} | Promptliano</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Schema.org */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Promptliano",
          "description": description,
          "url": url,
          "applicationCategory": "DeveloperApplication"
        })}
      </script>
    </>
  )
}
```

### Sitemap Generation

Generate dynamic sitemaps:

```typescript
export async function generateSitemap() {
  const routes = [
    { url: '/', priority: 1.0, changefreq: 'daily' },
    { url: '/features', priority: 0.9, changefreq: 'weekly' },
    { url: '/pricing', priority: 0.9, changefreq: 'weekly' },
    { url: '/docs', priority: 0.8, changefreq: 'daily' },
    { url: '/blog', priority: 0.7, changefreq: 'daily' }
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${routes
        .map(
          (route) => `
        <url>
          <loc>https://promptliano.com${route.url}</loc>
          <changefreq>${route.changefreq}</changefreq>
          <priority>${route.priority}</priority>
        </url>
      `
        )
        .join('')}
    </urlset>`

  return sitemap
}
```

## Performance Optimization

### Code Splitting

Implement route-based code splitting:

```typescript
// routes/docs.lazy.tsx
export const Route = createLazyFileRoute('/docs')({
  component: lazy(() => import('../components/docs/DocsPage'))
})
```

### Image Optimization

Use optimized images with lazy loading:

```typescript
import { useState, useEffect } from 'react'

export function OptimizedImage({
  src,
  alt,
  placeholder,
  sizes
}: ImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholder)
  const [imageRef, setImageRef] = useState<HTMLImageElement>()

  useEffect(() => {
    if (!imageRef) return

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setImageSrc(src)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )

    observer.observe(imageRef)

    return () => observer.disconnect()
  }, [imageRef, src])

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      sizes={sizes}
      loading="lazy"
      decoding="async"
    />
  )
}
```

### Bundle Optimization

Configure Vite for optimal bundles:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['@tanstack/react-router'],
          'ui-vendor': ['@promptliano/ui'],
          'animation-vendor': ['framer-motion']
        }
      }
    },
    // Enable compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // Enable build analysis
  plugins: [
    visualizer({
      open: process.env.ANALYZE === 'true'
    })
  ]
})
```

## PWA Configuration

### Service Worker Setup

Configure PWA with vite-plugin-pwa:

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Promptliano',
        short_name: 'Promptliano',
        description: 'AI Toolkit for Context Engineering',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ]
}
```

## Documentation System

### Markdown Rendering

Use react-markdown with syntax highlighting:

```typescript
import { MarkdownPreview } from '@promptliano/ui'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export function DocContent({ content }: { content: string }) {
  return (
    <MarkdownPreview
      content={content}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className="prose prose-invert max-w-none"
    />
  )
}
```

### Documentation Structure

Organize documentation content:

```
src/content/docs/
├── getting-started/
│   ├── installation.md
│   ├── quick-start.md
│   └── configuration.md
├── guides/
│   ├── mcp-setup.md
│   ├── editor-integration.md
│   └── ai-providers.md
└── api-reference/
    ├── cli-commands.md
    └── mcp-tools.md
```

## Testing Marketing Pages

### Visual Regression Testing

Test UI consistency:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('hero section renders correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveScreenshot('hero-section.png')
  })

  test('features section is visible', async ({ page }) => {
    await page.goto('/')
    const features = page.locator('[data-testid="features-section"]')
    await expect(features).toBeVisible()
    await expect(features).toHaveScreenshot('features-section.png')
  })
})
```

### Performance Testing

Monitor Core Web Vitals:

```typescript
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals'

export function reportWebVitals() {
  onCLS(console.log)
  onFID(console.log)
  onLCP(console.log)
  onFCP(console.log)
  onTTFB(console.log)
}

// In production, send to analytics
export function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id
  })

  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/analytics', body)
  }
}
```

## Content Management

### Blog System

Implement a simple blog with markdown:

```typescript
export async function getBlogPosts() {
  const posts = import.meta.glob('/src/content/blog/*.md')

  const postData = await Promise.all(
    Object.entries(posts).map(async ([path, resolver]) => {
      const content = await resolver()
      const slug = path.split('/').pop()?.replace('.md', '')

      return {
        slug,
        ...content.frontmatter,
        content: content.default
      }
    })
  )

  return postData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
```

## Best Practices

### 1. Performance First

- Lazy load components and routes
- Optimize images and assets
- Minimize JavaScript bundle size
- Use resource hints (preload, prefetch)
- Monitor Core Web Vitals

### 2. SEO Excellence

- Server-side rendering or static generation
- Proper meta tags and structured data
- XML sitemap generation
- Semantic HTML structure
- Mobile-first responsive design

### 3. Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Proper ARIA labels
- Color contrast requirements

### 4. User Experience

- Smooth animations and transitions
- Fast page loads (< 3s)
- Clear call-to-actions
- Intuitive navigation
- Mobile-optimized interactions

### 5. Content Strategy

- Clear value proposition
- Compelling copywriting
- Regular blog updates
- Comprehensive documentation
- Social proof and testimonials

## Common Pitfalls to Avoid

1. **Over-animating** - Keep animations subtle and purposeful
2. **Ignoring Mobile** - Always test on mobile devices
3. **Poor SEO** - Missing meta tags or structured data
4. **Slow Loading** - Unoptimized images or large bundles
5. **Accessibility Issues** - Missing alt text or ARIA labels
6. **Browser Compatibility** - Test across different browsers
7. **Dead Links** - Regularly check all links

## Integration with Other Packages

- **@promptliano/ui** - All UI components come from this package
- **@promptliano/brand-kit** - Brand colors and design tokens
- Uses minimal external dependencies for performance

The website package is the public face of Promptliano, crucial for user acquisition and providing documentation. Focus on performance, SEO, and user experience to maximize engagement and conversion.
