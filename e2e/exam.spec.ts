import { test, expect } from '@playwright/test';

test.describe('Exam Architecture', () => {
  test('should redirect /exam to /contests', async ({ page }) => {
    await page.goto('/exam');
    await expect(page).toHaveURL(/.*contests/);
    await expect(page).toHaveTitle(/.*Contests.*/i);
  });

  test('should protect /exam/[id]/intro and redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/exam/test-contest-id/intro');
    // It should redirect to login
    await expect(page).toHaveURL(/.*login.*/i);
  });

  test('should protect /exam/[id]/live and redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/exam/test-contest-id/live');
    // It should redirect to login
    await expect(page).toHaveURL(/.*login.*/i);
  });

  test('should protect /exam/[id]/result and redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/exam/test-contest-id/result');
    // It should redirect to login
    await expect(page).toHaveURL(/.*login.*/i);
  });

  test.describe('Authenticated Flow', () => {
    // We skip this block if test credentials are not provided
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 
      'Missing TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables. Skipping authenticated exam tests.'
    );

    test.beforeEach(async ({ page }) => {
      // Login flow
      await page.goto('/login');
      await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
      await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
      await page.click('button[type="submit"]');
      // Wait for navigation
      await page.waitForURL('/');
    });

    test('should allow entering the live exam UI when logged in', async ({ page }) => {
      // Assuming 'test-contest-id' is a valid contest in the DB.
      // In a real pipeline, we'd inject a contest ID via setup scripts.
      await page.goto('/exam/test-contest-id/live');
      
      // We expect the loader to eventually disappear and show the Exam Header
      const header = page.locator('header');
      await expect(header).toBeVisible({ timeout: 15000 });

      // Verify the presence of specific buttons
      await expect(page.locator('button', { hasText: /Save & Next/i })).toBeVisible();
      await expect(page.locator('button', { hasText: /Mark for Review/i })).toBeVisible();
      await expect(page.locator('button', { hasText: /Clear Response/i })).toBeVisible();
      await expect(page.locator('button', { hasText: /Submit/i })).toBeVisible();
    });

    test('should allow selecting an option and clearing it', async ({ page }) => {
      await page.goto('/exam/test-contest-id/live');
      const header = page.locator('header');
      await expect(header).toBeVisible({ timeout: 15000 });

      // If it's an MCQ, click an option
      const option = page.locator('.group').first(); // Using the option wrapper class
      if (await option.isVisible()) {
        await option.click();
        
        // Ensure it's selected (checking for background class)
        await expect(option).toHaveClass(/bg-blue-50/);

        // Click Clear Response
        const clearBtn = page.locator('button', { hasText: /Clear Response/i });
        await clearBtn.click();

        // Ensure it's cleared
        await expect(option).not.toHaveClass(/bg-blue-50/);
      }
    });
  });
});
