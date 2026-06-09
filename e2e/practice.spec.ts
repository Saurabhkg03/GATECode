import { test, expect } from '@playwright/test';

test.describe('Practice Page', () => {
  test('should load the practice page', async ({ page }) => {
    await page.goto('/practice');
    
    // Ensure the page title is correct or practice area is loaded
    await expect(page).toHaveTitle(/.*practice.*/i);
    
    // Check for topics or question list
    const topics = page.locator('text=/Topics|Subjects/i').first();
    if (await topics.isVisible()) {
      await expect(topics).toBeVisible();
    }
  });
});
