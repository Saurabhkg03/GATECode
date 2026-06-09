# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: contests.spec.ts >> Contests Page >> should have dropdown filters for Branch, Difficulty, and Duration
- Location: e2e\contests.spec.ts:58:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('select').filter({ hasText: 'All Branches' })
Expected: visible
Received: hidden
Timeout:  30000ms

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('select').filter({ hasText: 'All Branches' })
    58 × locator resolved to <select class="w-full sm:w-40 pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-blue-500 cursor-pointer">…</select>
       - unexpected value "hidden"

```

```yaml
- main:
  - navigation:
    - link "GATECode Logo GATECode":
      - /url: /
      - img "GATECode Logo"
      - text: GATECode
    - button "ECE":
      - img
      - text: ECE
      - img
    - button "Toggle theme":
      - img
    - link "Login":
      - /url: /login
  - navigation:
    - link "Home":
      - /url: /
      - img
      - text: Home
    - link "Practice":
      - /url: /practice
      - img
      - text: Practice
    - link "Contests":
      - /url: /contests
      - img
      - text: Contests
    - link "Leader":
      - /url: /leaderboard
      - img
      - text: Leader
    - link "Profile":
      - /url: /login
      - img
      - text: Profile
  - heading "Contest" [level=1]
  - paragraph: Contest every week. Compete and see your ranking!
  - button "Official":
    - img
    - text: Official
  - button "Community":
    - img
    - text: Community
  - img
  - textbox "Search mock tests..."
  - button "Toggle Filters":
    - img
  - heading "Upcoming Contests" [level=2]:
    - img
    - text: Upcoming Contests
  - link "Weekly Contest 1d 35m Weekly Mock 15 Sun, 7 Jun, 10:00 am 90 min":
    - /url: /contests/weekly-15
    - img
    - img
    - text: Weekly Contest
    - img
    - text: 1d 35m
    - heading "Weekly Mock 15" [level=2]
    - paragraph:
      - img
      - text: Sun, 7 Jun, 10:00 am
    - paragraph:
      - img
      - text: 90 min
  - link "Biweekly Contest 10h 35m 38s Biweekly Mock 8 Sat, 6 Jun, 08:00 pm 120 min":
    - /url: /contests/biweekly-8
    - img
    - img
    - img
    - text: Biweekly Contest
    - img
    - text: 10h 35m 38s
    - heading "Biweekly Mock 8" [level=2]
    - paragraph:
      - img
      - text: Sat, 6 Jun, 08:00 pm
    - paragraph:
      - img
      - text: 120 min
  - heading "Live Now" [level=2]:
    - img
    - text: Live Now
  - text: "3"
  - link "Official ece Live GATE ECE Live Competition (Real) Generated from 'questions_ece'. Contains 65 real questions. 180 min 100 Marks Join Live":
    - img
    - text: Official ece Live
    - heading "GATE ECE Live Competition (Real)" [level=3]
    - paragraph: Generated from 'questions_ece'. Contains 65 real questions.
    - img
    - text: 180 min
    - img
    - text: 100 Marks
    - link "Join Live":
      - /url: /contests/1774866430581-admin-ece
      - img
      - text: Join Live
  - link "Official ece Live Official Test Generated from 'questions_ece'. Contains 65 real questions. 180 min 100 Marks Join Live":
    - img
    - text: Official ece Live
    - heading "Official Test" [level=3]
    - paragraph: Generated from 'questions_ece'. Contains 65 real questions.
    - img
    - text: 180 min
    - img
    - text: 100 Marks
    - link "Join Live":
      - /url: /contests/1774818011025-admin-ece
      - img
      - text: Join Live
  - link "Official ece Live Mock contest rating Generated from 'questions_ece'. Contains 65 real questions. 180 min 100 Marks Join Live":
    - img
    - text: Official ece Live
    - heading "Mock contest rating" [level=3]
    - paragraph: Generated from 'questions_ece'. Contains 65 real questions.
    - img
    - text: 180 min
    - img
    - text: 100 Marks
    - link "Join Live":
      - /url: /contests/1773062321882-admin-ece
      - img
      - text: Join Live
  - heading "Past Official Exams (Practice Mode)" [level=2]:
    - img
    - text: Past Official Exams (Practice Mode)
  - text: "1"
  - link "Official ece GATE ECE Live Competition (Real) Generated from 'questions_ece'. Contains 65 real questions. 180 min 100 Marks Practice":
    - img
    - text: Official ece
    - heading "GATE ECE Live Competition (Real)" [level=3]
    - paragraph: Generated from 'questions_ece'. Contains 65 real questions.
    - img
    - text: 180 min
    - img
    - text: 100 Marks
    - link "Practice":
      - /url: /contests/1774818888197-admin-ece
      - text: Practice
      - img
  - region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Contests Page', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/contests');
  6  |     // Wait for the main heading to ensure the page has loaded
  7  |     await expect(page.locator('h1', { hasText: 'Contest' })).toBeVisible();
  8  |   });
  9  | 
  10 |   test('should load the contests page and default to Official tab', async ({ page }) => {
  11 |     // Check title
  12 |     await expect(page).toHaveTitle(/.*Contests.*/i);
  13 |     
  14 |     // Check if "Official" tab is selected (via checking background color or just checking if button exists and has active classes)
  15 |     const officialTab = page.locator('button', { hasText: 'Official' });
  16 |     await expect(officialTab).toBeVisible();
  17 |     
  18 |     // There should be a "Upcoming Contests" or "No Official Contests Yet"
  19 |     const headingUpcoming = page.locator('h2', { hasText: 'Upcoming Contests' });
  20 |     const emptyState = page.locator('h3', { hasText: 'No Official Contests Yet' });
  21 |     
  22 |     // One of them must be visible
  23 |     const isUpcomingVisible = await headingUpcoming.isVisible();
  24 |     const isEmptyVisible = await emptyState.isVisible();
  25 |     expect(isUpcomingVisible || isEmptyVisible).toBeTruthy();
  26 |   });
  27 | 
  28 |   test('should switch tabs correctly to Community', async ({ page }) => {
  29 |     const communityTab = page.locator('button', { hasText: 'Community' });
  30 |     await communityTab.click();
  31 |     
  32 |     // Assuming either a grid of mock tests or the empty state for community
  33 |     const emptyState = page.locator('h3', { hasText: 'No Community Mocks Yet' });
  34 |     const grid = page.locator('.grid');
  35 |     
  36 |     // Wait for either the empty state or the grid
  37 |     await Promise.race([
  38 |       expect(emptyState).toBeVisible(),
  39 |       expect(grid.first()).toBeVisible()
  40 |     ]);
  41 |   });
  42 | 
  43 |   test('should hide My Mocks tab if not authenticated', async ({ page }) => {
  44 |     // If not authenticated, "My Mocks" tab should not be in the DOM
  45 |     const myMocksTab = page.locator('button', { hasText: 'My Mocks' });
  46 |     await expect(myMocksTab).toHaveCount(0);
  47 |   });
  48 | 
  49 |   test('should filter contests by search query', async ({ page }) => {
  50 |     const searchInput = page.getByPlaceholder('Search mock tests...');
  51 |     await searchInput.fill('Gate 2025');
  52 |     
  53 |     // We expect the list to filter. Since it's E2E and data is dynamic, 
  54 |     // we just verify the input takes value and doesn't crash the app.
  55 |     await expect(searchInput).toHaveValue('Gate 2025');
  56 |   });
  57 | 
  58 |   test('should have dropdown filters for Branch, Difficulty, and Duration', async ({ page }) => {
  59 |     const branchSelect = page.locator('select').filter({ hasText: 'All Branches' });
  60 |     const diffSelect = page.locator('select').filter({ hasText: 'All Difficulties' });
  61 |     const durSelect = page.locator('select').filter({ hasText: 'Any Duration' });
  62 | 
> 63 |     await expect(branchSelect).toBeVisible();
     |                                ^ Error: expect(locator).toBeVisible() failed
  64 |     await expect(diffSelect).toBeVisible();
  65 |     await expect(durSelect).toBeVisible();
  66 | 
  67 |     // Change value
  68 |     await branchSelect.selectOption('CS');
  69 |     await expect(branchSelect).toHaveValue('CS');
  70 |   });
  71 | });
  72 | 
```