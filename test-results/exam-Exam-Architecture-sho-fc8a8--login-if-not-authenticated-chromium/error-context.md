# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: exam.spec.ts >> Exam Architecture >> should protect /exam/[id]/intro and redirect to login if not authenticated
- Location: e2e\exam.spec.ts:10:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*login.*/i
Received string:  "http://localhost:3000/exam/test-contest-id/intro"
Timeout: 30000ms

Call log:
  - Expect "toHaveURL" with timeout 30000ms
    59 × unexpected value "http://localhost:3000/exam/test-contest-id/intro"

```

```yaml
- main:
  - img: "404"
  - heading "Page Not Found" [level=1]
  - paragraph: Oops! The page you're looking for seems to have gotten lost in space.
  - link "Go to Homepage":
    - /url: /
    - img
    - text: Go to Homepage
  - region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Exam Architecture', () => {
  4  |   test('should redirect /exam to /contests', async ({ page }) => {
  5  |     await page.goto('/exam');
  6  |     await expect(page).toHaveURL(/.*contests/);
  7  |     await expect(page).toHaveTitle(/.*Contests.*/i);
  8  |   });
  9  | 
  10 |   test('should protect /exam/[id]/intro and redirect to login if not authenticated', async ({ page }) => {
  11 |     await page.goto('/exam/test-contest-id/intro');
  12 |     // It should redirect to login
> 13 |     await expect(page).toHaveURL(/.*login.*/i);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  14 |   });
  15 | 
  16 |   test('should protect /exam/[id]/live and redirect to login if not authenticated', async ({ page }) => {
  17 |     await page.goto('/exam/test-contest-id/live');
  18 |     // It should redirect to login
  19 |     await expect(page).toHaveURL(/.*login.*/i);
  20 |   });
  21 | 
  22 |   test('should protect /exam/[id]/result and redirect to login if not authenticated', async ({ page }) => {
  23 |     await page.goto('/exam/test-contest-id/result');
  24 |     // It should redirect to login
  25 |     await expect(page).toHaveURL(/.*login.*/i);
  26 |   });
  27 | 
  28 |   test.describe('Authenticated Flow', () => {
  29 |     // We skip this block if test credentials are not provided
  30 |     test.skip(
  31 |       !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 
  32 |       'Missing TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables. Skipping authenticated exam tests.'
  33 |     );
  34 | 
  35 |     test.beforeEach(async ({ page }) => {
  36 |       // Login flow
  37 |       await page.goto('/login');
  38 |       await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  39 |       await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  40 |       await page.click('button[type="submit"]');
  41 |       // Wait for navigation
  42 |       await page.waitForURL('/');
  43 |     });
  44 | 
  45 |     test('should allow entering the live exam UI when logged in', async ({ page }) => {
  46 |       // Assuming 'test-contest-id' is a valid contest in the DB.
  47 |       // In a real pipeline, we'd inject a contest ID via setup scripts.
  48 |       await page.goto('/exam/test-contest-id/live');
  49 |       
  50 |       // We expect the loader to eventually disappear and show the Exam Header
  51 |       const header = page.locator('header');
  52 |       await expect(header).toBeVisible({ timeout: 15000 });
  53 | 
  54 |       // Verify the presence of specific buttons
  55 |       await expect(page.locator('button', { hasText: /Save & Next/i })).toBeVisible();
  56 |       await expect(page.locator('button', { hasText: /Mark for Review/i })).toBeVisible();
  57 |       await expect(page.locator('button', { hasText: /Clear Response/i })).toBeVisible();
  58 |       await expect(page.locator('button', { hasText: /Submit/i })).toBeVisible();
  59 |     });
  60 | 
  61 |     test('should allow selecting an option and clearing it', async ({ page }) => {
  62 |       await page.goto('/exam/test-contest-id/live');
  63 |       const header = page.locator('header');
  64 |       await expect(header).toBeVisible({ timeout: 15000 });
  65 | 
  66 |       // If it's an MCQ, click an option
  67 |       const option = page.locator('.group').first(); // Using the option wrapper class
  68 |       if (await option.isVisible()) {
  69 |         await option.click();
  70 |         
  71 |         // Ensure it's selected (checking for background class)
  72 |         await expect(option).toHaveClass(/bg-blue-50/);
  73 | 
  74 |         // Click Clear Response
  75 |         const clearBtn = page.locator('button', { hasText: /Clear Response/i });
  76 |         await clearBtn.click();
  77 | 
  78 |         // Ensure it's cleared
  79 |         await expect(option).not.toHaveClass(/bg-blue-50/);
  80 |       }
  81 |     });
  82 |   });
  83 | });
  84 | 
```