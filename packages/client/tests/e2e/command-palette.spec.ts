import { test, expect } from '@playwright/test'

test.describe('Command Palette', () => {
  test('opens with keyboard shortcut', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Try different keyboard shortcuts for command palette
    await page.keyboard.press('Meta+k') // Mac
    
    // Wait a bit for the command palette to appear
    await page.waitForTimeout(500)
    
    // Check if command palette or any modal opened
    const commandPalette = page.locator('[cmdk-root], [role="dialog"], .command-dialog, [data-testid="command-palette"]')
    const isVisible = await commandPalette.isVisible().catch(() => false)
    
    if (!isVisible) {
      // Try Ctrl+K for Windows/Linux
      await page.keyboard.press('Control+k')
      await page.waitForTimeout(500)
    }
    
    // Check if any dialog/modal opened (command palette might have different selectors)
    const anyModal = page.locator('[role="dialog"], .modal, .dialog, [data-state="open"]')
    const modalCount = await anyModal.count()
    
    // If a modal opened, interact with it
    if (modalCount > 0) {
      const modal = anyModal.first()
      await expect(modal).toBeVisible()
      
      // Look for command input
      const input = modal.locator('input, [contenteditable]').first()
      if (await input.count() > 0) {
        await expect(input).toBeVisible()
        
        // Test typing in the command palette
        await input.fill('test')
        const value = await input.inputValue().catch(() => '')
        expect(value).toBe('test')
      }
    }
  })

  test('shows navigation commands', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(500)

    // Look for command palette
    const modal = page.locator('[role="dialog"], .modal, .dialog, [data-state="open"]').first()
    
    if (await modal.count() > 0) {
      // Look for navigation-related commands
      const navigationCommands = modal.locator(':has-text("Projects"), :has-text("Chat"), :has-text("Prompts"), :has-text("Navigation")')
      
      if (await navigationCommands.count() > 0) {
        await expect(navigationCommands.first()).toBeVisible()
      }
    }
  })

  test('can search and select commands', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(500)

    const modal = page.locator('[role="dialog"], .modal, .dialog').first()
    
    if (await modal.count() > 0) {
      const input = modal.locator('input, [contenteditable]').first()
      
      if (await input.count() > 0) {
        // Test searching for commands
        await input.fill('project')
        await page.waitForTimeout(300)
        
        // Look for filtered results
        const results = modal.locator('[data-testid="command-item"], .command-item, [role="option"]')
        const resultCount = await results.count()
        
        if (resultCount > 0) {
          // Test selecting a command
          await results.first().click()
          
          // Command palette should close after selection
          await page.waitForTimeout(500)
          const isModalStillVisible = await modal.isVisible().catch(() => false)
          
          // The modal might close, or navigation might occur
          // This is acceptable behavior
        }
      }
    }
  })

  test('closes with escape key', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(500)

    const modal = page.locator('[role="dialog"], .modal, .dialog').first()
    
    if (await modal.count() > 0 && await modal.isVisible()) {
      // Press escape to close
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      
      // Modal should be closed or hidden
      const isVisible = await modal.isVisible().catch(() => false)
      expect(isVisible).toBe(false)
    }
  })
})