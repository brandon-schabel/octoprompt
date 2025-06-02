import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('can navigate to projects page', async ({ page }) => {
    await page.goto('/')

    // Wait for the app to load
    await page.waitForLoadState('networkidle')

    // Look for projects link - could be in sidebar, navbar, or as a button
    const projectsLink = page.locator('a[href*="/projects"], button:has-text("Projects"), [data-testid="projects-link"]').first()
    
    if (await projectsLink.count() > 0) {
      await projectsLink.click()
      
      // Check if we're on the projects page
      await page.waitForURL('**/projects**', { timeout: 5000 })
      expect(page.url()).toContain('/projects')
    } else {
      // Fallback: navigate directly to projects
      await page.goto('/projects')
      await expect(page).toHaveURL(/.*projects.*/)
    }

    // Check if projects page loaded with expected content
    await page.waitForSelector('body', { timeout: 5000 })
    
    // Look for project-related content
    const hasProjectContent = await page.locator(
      'h1:has-text("Projects"), h2:has-text("Projects"), [data-testid="projects"], .projects, button:has-text("Create"), button:has-text("New Project")'
    ).count()
    expect(hasProjectContent).toBeGreaterThan(0)
  })

  test('can navigate to chat page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for chat link
    const chatLink = page.locator('a[href*="/chat"], button:has-text("Chat"), [data-testid="chat-link"]').first()
    
    if (await chatLink.count() > 0) {
      await chatLink.click()
      await page.waitForURL('**/chat**', { timeout: 5000 })
    } else {
      await page.goto('/chat')
    }

    expect(page.url()).toContain('/chat')
    
    // Check for chat interface elements
    const hasChatContent = await page.locator(
      'h1:has-text("Chat"), [data-testid="chat"], .chat, textarea, input[placeholder*="message"], input[placeholder*="chat"]'
    ).count()
    expect(hasChatContent).toBeGreaterThan(0)
  })

  test('can navigate to prompts page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for prompts link
    const promptsLink = page.locator('a[href*="/prompts"], button:has-text("Prompts"), [data-testid="prompts-link"]').first()
    
    if (await promptsLink.count() > 0) {
      await promptsLink.click()
      await page.waitForURL('**/prompts**', { timeout: 5000 })
    } else {
      await page.goto('/prompts')
    }

    expect(page.url()).toContain('/prompts')
    
    // Check for prompts page content
    const hasPromptsContent = await page.locator(
      'h1:has-text("Prompts"), [data-testid="prompts"], .prompts, button:has-text("Create"), button:has-text("New Prompt")'
    ).count()
    expect(hasPromptsContent).toBeGreaterThan(0)
  })
})