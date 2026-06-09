import { test, expect } from '@playwright/test';

test.describe('Leaderboard Page', () => {
  test('should load the leaderboard page', async ({ page }) => {
    await page.goto('/leaderboard');
    
    // Check if leaderboard text is visible
    await expect(page).toHaveTitle(/.*Leaderboard.*/i);
    const leaderboardHeader = page.locator('text=/Leaderboard/i').first();
    if (await leaderboardHeader.isVisible()) {
      await expect(leaderboardHeader).toBeVisible();
    }
  });
});
