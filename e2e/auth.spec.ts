import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  test('should load the login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check if the login form is visible
    const loginHeader = page.getByRole('heading', { name: /Login|Sign In/i });
    if (await loginHeader.isVisible()) {
      await expect(loginHeader).toBeVisible();
    } else {
      // Sometimes it's a "Continue with Google" button
      const googleBtn = page.getByRole('button', { name: /Google/i });
      await expect(googleBtn).toBeVisible();
    }
  });
});
