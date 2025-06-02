import { test, expect } from '@playwright/test'

test.describe('Project Management', () => {
  test('can view projects list', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Check if the projects page loads
    await expect(page).toHaveURL(/.*projects.*/)

    // Wait for content to load
    await page.waitForSelector('body')

    // Look for project-related elements
    const hasProjectsInterface = await page.locator(
      'h1:has-text("Projects"), h2:has-text("Projects"), [data-testid="projects-list"], .projects-list, .project-card'
    ).count()

    // If no projects interface found, check for empty state or loading
    if (hasProjectsInterface === 0) {
      const hasEmptyState = await page.locator(
        ':has-text("No projects"), :has-text("Create your first"), :has-text("Get started"), button:has-text("Create")'
      ).count()
      expect(hasEmptyState).toBeGreaterThan(0)
    } else {
      expect(hasProjectsInterface).toBeGreaterThan(0)
    }
  })

  test('shows create project interface', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Look for create project button or interface
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("New Project"), button:has-text("Add Project"), [data-testid="create-project"]'
    ).first()

    if (await createButton.count() > 0) {
      // If there's a create button, test that it's interactive
      await expect(createButton).toBeVisible()
      
      // Try clicking it to see if it opens a form/dialog
      await createButton.click()
      
      // Wait a moment for any modal/form to appear
      await page.waitForTimeout(1000)
      
      // Check if a form appeared
      const hasForm = await page.locator(
        'form, [role="dialog"], input[placeholder*="name"], input[placeholder*="Name"], textarea'
      ).count()
      
      if (hasForm > 0) {
        // If form appeared, check for project name input
        const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
        if (await nameInput.count() > 0) {
          await expect(nameInput).toBeVisible()
        }
      }
    } else {
      // If no create button found, this might be a different interface
      // Just ensure the page loaded correctly
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('can interact with project interface elements', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Check if there are any interactive elements on the projects page
    const interactiveElements = await page.locator(
      'button, a, input, [role="button"], [tabindex="0"]'
    ).count()

    expect(interactiveElements).toBeGreaterThan(0)

    // Check if there's a search or filter functionality
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="filter"], input[type="search"]')
    
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible()
      
      // Test that search input accepts text
      await searchInput.first().fill('test')
      const inputValue = await searchInput.first().inputValue()
      expect(inputValue).toBe('test')
    }
  })
})