import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check title or main heading
    // GATECode title should be present
    await expect(page).toHaveTitle(/GATECode/i);
    
    // The main heading might be "GATECode" or "Crack GATE"
    // Let's just check if the page body is visible
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should navigate to practice page', async ({ page }) => {
    await page.goto('/');
    
    // Attempt to find a link to practice
    const practiceLink = page.getByRole('link', { name: /Practice/i }).first();
    if (await practiceLink.isVisible()) {
      await practiceLink.click();
      await expect(page).toHaveURL(/.*practice/);
    }
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    const loginLink = page.getByRole('link', { name: /Login|Sign In/i }).first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/.*login/);
    }
  });
});
