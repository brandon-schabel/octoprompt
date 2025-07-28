import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals'

interface PerformanceMetrics {
  CLS?: number
  FCP?: number
  FID?: number
  INP?: number
  LCP?: number
  TTFB?: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {}
  private reportCallback?: (metrics: PerformanceMetrics) => void
  private reportThreshold = 5000 // Report after 5 seconds
  private reportTimer?: number

  init(reportCallback?: (metrics: PerformanceMetrics) => void) {
    this.reportCallback = reportCallback

    // Collect Web Vitals
    onCLS((metric) => this.recordMetric('CLS', metric.value))
    onFCP((metric) => this.recordMetric('FCP', metric.value))
    onFID((metric) => this.recordMetric('FID', metric.value))
    onINP((metric) => this.recordMetric('INP', metric.value))
    onLCP((metric) => this.recordMetric('LCP', metric.value))
    onTTFB((metric) => this.recordMetric('TTFB', metric.value))

    // Set up reporting
    this.scheduleReport()

    // Report on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.report()
      }
    })
  }

  private recordMetric(name: keyof PerformanceMetrics, value: number) {
    this.metrics[name] = value

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${value.toFixed(2)}`)
    }
  }

  private scheduleReport() {
    this.reportTimer = window.setTimeout(() => {
      this.report()
    }, this.reportThreshold)
  }

  private report() {
    if (this.reportTimer) {
      clearTimeout(this.reportTimer)
    }

    if (this.reportCallback && Object.keys(this.metrics).length > 0) {
      this.reportCallback(this.metrics)
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }
}

export const performanceMonitor = new PerformanceMonitor()

// Resource hints utilities
export function addResourceHints() {
  const head = document.head

  // Preconnect to external domains
  const preconnectDomains = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']

  preconnectDomains.forEach((domain) => {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = domain
    link.crossOrigin = 'anonymous'
    head.appendChild(link)
  })

  // DNS prefetch for potential external resources
  const dnsPrefetchDomains = ['https://api.promptliano.com']

  dnsPrefetchDomains.forEach((domain) => {
    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = domain
    head.appendChild(link)
  })
}

// Critical CSS extraction helper
export function extractCriticalCSS(selector: string = 'body'): string {
  const element = document.querySelector(selector)
  if (!element) return ''

  const criticalRules: string[] = []
  const styleSheets = Array.from(document.styleSheets)

  styleSheets.forEach((sheet) => {
    try {
      const rules = Array.from(sheet.cssRules || [])
      rules.forEach((rule) => {
        if (rule instanceof CSSStyleRule) {
          if (element.matches(rule.selectorText)) {
            criticalRules.push(rule.cssText)
          }
        }
      })
    } catch (e) {
      // Ignore cross-origin stylesheets
    }
  })

  return criticalRules.join('\n')
}

// Prefetch utilities
export function prefetchRoute(url: string) {
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  link.as = 'document'
  document.head.appendChild(link)
}

export function preloadResource(url: string, as: string) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = url
  link.as = as

  if (as === 'font') {
    link.crossOrigin = 'anonymous'
  }

  document.head.appendChild(link)
}

// Service Worker registration
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js')

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('New service worker available. Refresh to update.')

            // You can show a notification to the user here
            if (confirm('New version available! Refresh to update?')) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
              window.location.reload()
            }
          }
        })
      })

      console.log('Service Worker registered successfully')
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }
}

// Lazy component loader with retry
export async function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): Promise<{ default: T }> {
  try {
    return await importFn()
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return lazyWithRetry(importFn, retries - 1, delay * 2)
    }
    throw error
  }
}

// Performance budgets
export interface PerformanceBudget {
  metric: keyof PerformanceMetrics
  threshold: number
}

export const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  { metric: 'LCP', threshold: 2500 }, // 2.5s
  { metric: 'FID', threshold: 100 }, // 100ms
  { metric: 'CLS', threshold: 0.1 }, // 0.1
  { metric: 'FCP', threshold: 1800 }, // 1.8s
  { metric: 'INP', threshold: 200 }, // 200ms
  { metric: 'TTFB', threshold: 800 } // 800ms
]

export function checkPerformanceBudgets(metrics: PerformanceMetrics): {
  passed: boolean
  violations: Array<{ metric: string; value: number; threshold: number }>
} {
  const violations: Array<{ metric: string; value: number; threshold: number }> = []

  PERFORMANCE_BUDGETS.forEach((budget) => {
    const value = metrics[budget.metric]
    if (value !== undefined && value > budget.threshold) {
      violations.push({
        metric: budget.metric,
        value,
        threshold: budget.threshold
      })
    }
  })

  return {
    passed: violations.length === 0,
    violations
  }
}
