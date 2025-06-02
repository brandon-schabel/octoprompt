# Playwright E2E Tests

This directory contains end-to-end tests for the OctoPrompt client application using Playwright.

## Setup

The tests are automatically configured to:
- Start the development server on `http://localhost:5173`
- Use MSW (Mock Service Worker) for API mocking
- Run tests across Chrome, Firefox, and Safari browsers

## Running Tests

### Prerequisites
```bash
# Install dependencies (from packages/client)
npm install

# Install Playwright browsers
npm run playwright:install
```

### Running Tests
```bash
# Run all tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug
```

## Test Structure

- `app.spec.ts` - Basic application loading and functionality tests
- `navigation.spec.ts` - Navigation between different pages
- `projects.spec.ts` - Project management functionality
- `mocks/server.ts` - MSW server setup for API mocking

## Writing Tests

Tests use MSW to mock API responses, ensuring reliable and fast test execution without depending on a real backend server.

### Example Test Pattern
```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/feature')
    
    // Your test assertions here
    await expect(page.locator('button')).toBeVisible()
  })
})
```

## CI/CD

Tests run automatically on:
- Push to main branch
- Pull requests that modify client code
- GitHub Actions workflow: `.github/workflows/playwright.yml`

## Troubleshooting

If tests fail:
1. Check that the development server starts correctly
2. Verify API mocks in `mocks/server.ts` match actual API responses
3. Use headed mode to visually debug: `npm run test:e2e:headed`
4. Check Playwright reports in `playwright-report/` directory