import { test, expect } from '@playwright/test';

test.describe('Profile Page', () => {
  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/profile');
    
    // Check if we are redirected to login
    await expect(page).toHaveURL(/.*login/);
  });
});
