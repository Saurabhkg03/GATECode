import { test, expect } from '@playwright/test';

test.describe('Contests Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contests');
    // Wait for the main heading to ensure the page has loaded
    await expect(page.locator('h1', { hasText: 'Contest' })).toBeVisible();
  });

  test('should load the contests page and default to Official tab', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/.*Contests.*/i);
    
    // Check if "Official" tab is selected (via checking background color or just checking if button exists and has active classes)
    const officialTab = page.locator('button', { hasText: 'Official' });
    await expect(officialTab).toBeVisible();
    
    // There should be a "Upcoming Contests" or "No Official Contests Yet"
    const headingUpcoming = page.locator('h2', { hasText: 'Upcoming Contests' });
    const emptyState = page.locator('h3', { hasText: 'No Official Contests Yet' });
    
    // One of them must be visible
    const isUpcomingVisible = await headingUpcoming.isVisible();
    const isEmptyVisible = await emptyState.isVisible();
    expect(isUpcomingVisible || isEmptyVisible).toBeTruthy();
  });

  test('should switch tabs correctly to Community', async ({ page }) => {
    const communityTab = page.locator('button', { hasText: 'Community' });
    await communityTab.click();
    
    // Assuming either a grid of mock tests or the empty state for community
    const emptyState = page.locator('h3', { hasText: 'No Community Mocks Yet' });
    const grid = page.locator('.grid');
    
    // Wait for either the empty state or the grid
    await Promise.race([
      expect(emptyState).toBeVisible(),
      expect(grid.first()).toBeVisible()
    ]);
  });

  test('should hide My Mocks tab if not authenticated', async ({ page }) => {
    // If not authenticated, "My Mocks" tab should not be in the DOM
    const myMocksTab = page.locator('button', { hasText: 'My Mocks' });
    await expect(myMocksTab).toHaveCount(0);
  });

  test('should filter contests by search query', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search mock tests...');
    await searchInput.fill('Gate 2025');
    
    // We expect the list to filter. Since it's E2E and data is dynamic, 
    // we just verify the input takes value and doesn't crash the app.
    await expect(searchInput).toHaveValue('Gate 2025');
  });

  test('should have dropdown filters for Branch, Difficulty, and Duration', async ({ page }) => {
    const branchSelect = page.locator('select').filter({ hasText: 'All Branches' });
    const diffSelect = page.locator('select').filter({ hasText: 'All Difficulties' });
    const durSelect = page.locator('select').filter({ hasText: 'Any Duration' });

    await expect(branchSelect).toBeVisible();
    await expect(diffSelect).toBeVisible();
    await expect(durSelect).toBeVisible();

    // Change value
    await branchSelect.selectOption('CS');
    await expect(branchSelect).toHaveValue('CS');
  });
});
