import { test, expect } from '@playwright/test'

test.describe('Application Health', () => {
  test('loads without JavaScript errors', async ({ page }) => {
    // Track any console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Track any page errors
    const pageErrors: Error[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error)
    })

    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Check that there are no critical JavaScript errors
    // Filter out common non-critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('chunk') &&
      !error.includes('network') &&
      !error.toLowerCase().includes('warning')
    )

    expect(criticalErrors).toHaveLength(0)
    expect(pageErrors).toHaveLength(0)
  })

  test('renders main application structure', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Check that basic React app structure is present
    const rootElement = page.locator('#root')
    await expect(rootElement).toBeVisible()

    // Check that content is rendered (not just a blank page)
    const bodyText = await page.locator('body').textContent()
    expect(bodyText?.trim().length).toBeGreaterThan(0)

    // Check that the app has loaded (look for any interactive elements)
    const interactiveElements = await page.locator('button, a, input').count()
    expect(interactiveElements).toBeGreaterThan(0)
  })

  test('has responsive design', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('#root')).toBeVisible()

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('#root')).toBeVisible()

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('#root')).toBeVisible()
  })
})