# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> Home Page >> should navigate to practice page
- Location: e2e\home.spec.ts:17:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: /Practice/i }).first()
    - locator resolved to <a href="/practice" class="relative flex flex-col items-center justify-center gap-1 h-full flex-1 min-w-[64px] rounded-2xl transition-colors duration-300 z-10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">…</a>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    103 × waiting for element to be visible, enabled and stable
        - element is visible, enabled and stable
        - scrolling into view if needed
        - done scrolling
        - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
      - retrying click action
        - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - navigation [ref=e4]:
      - generic [ref=e6]:
        - link "GATECode Logo GATECode" [ref=e7] [cursor=pointer]:
          - /url: /
          - img "GATECode Logo" [ref=e8]
          - generic [ref=e9]: GATECode
        - generic [ref=e10]:
          - button "ECE" [ref=e11] [cursor=pointer]:
            - img
            - generic [ref=e12]: ECE
            - img
          - button "Toggle theme" [ref=e13] [cursor=pointer]:
            - img
          - link "Login" [ref=e14] [cursor=pointer]:
            - /url: /login
    - navigation [ref=e15]:
      - link "Home" [ref=e16] [cursor=pointer]:
        - /url: /
        - img [ref=e19]
        - generic [ref=e25]: Home
      - link "Practice" [ref=e26] [cursor=pointer]:
        - /url: /practice
        - img [ref=e28]
        - generic [ref=e32]: Practice
      - link "Contests" [ref=e33] [cursor=pointer]:
        - /url: /contests
        - img [ref=e35]
        - generic [ref=e38]: Contests
      - link "Leader" [ref=e39] [cursor=pointer]:
        - /url: /leaderboard
        - img [ref=e41]
        - generic [ref=e47]: Leader
      - link "Profile" [ref=e48] [cursor=pointer]:
        - /url: /login
        - img [ref=e50]
        - generic [ref=e53]: Profile
    - generic [ref=e55]:
      - generic [ref=e56]:
        - heading "Practice. Analyze. Master GATE." [level=1] [ref=e57]
        - paragraph [ref=e58]: Your complete platform for GATE ECE preparation, with curated questions, performance tracking, and community leaderboards.
      - generic [ref=e59]:
        - generic [ref=e60]:
          - heading "Subjects Overview (ECE)" [level=2] [ref=e61]
          - generic [ref=e62]:
            - link "Analog Circuits 244 questions" [ref=e63] [cursor=pointer]:
              - /url: /practice?subject=Analog%20Circuits
              - generic [ref=e64]:
                - img [ref=e66]
                - generic [ref=e68]:
                  - heading "Analog Circuits" [level=3] [ref=e69]
                  - paragraph [ref=e70]: 244 questions
                - img [ref=e71]
            - link "Communication Systems 258 questions" [ref=e73] [cursor=pointer]:
              - /url: /practice?subject=Communication%20Systems
              - generic [ref=e74]:
                - img [ref=e76]
                - generic [ref=e78]:
                  - heading "Communication Systems" [level=3] [ref=e79]
                  - paragraph [ref=e80]: 258 questions
                - img [ref=e81]
            - link "Control Systems 206 questions" [ref=e83] [cursor=pointer]:
              - /url: /practice?subject=Control%20Systems
              - generic [ref=e84]:
                - img [ref=e86]
                - generic [ref=e88]:
                  - heading "Control Systems" [level=3] [ref=e89]
                  - paragraph [ref=e90]: 206 questions
                - img [ref=e91]
            - link "Digital Circuits 192 questions" [ref=e93] [cursor=pointer]:
              - /url: /practice?subject=Digital%20Circuits
              - generic [ref=e94]:
                - img [ref=e96]
                - generic [ref=e98]:
                  - heading "Digital Circuits" [level=3] [ref=e99]
                  - paragraph [ref=e100]: 192 questions
                - img [ref=e101]
            - link "Electromagnetics 197 questions" [ref=e103] [cursor=pointer]:
              - /url: /practice?subject=Electromagnetics
              - generic [ref=e104]:
                - img [ref=e106]
                - generic [ref=e108]:
                  - heading "Electromagnetics" [level=3] [ref=e109]
                  - paragraph [ref=e110]: 197 questions
                - img [ref=e111]
            - link "Electronic Devices 190 questions" [ref=e113] [cursor=pointer]:
              - /url: /practice?subject=Electronic%20Devices
              - generic [ref=e114]:
                - img [ref=e116]
                - generic [ref=e118]:
                  - heading "Electronic Devices" [level=3] [ref=e119]
                  - paragraph [ref=e120]: 190 questions
                - img [ref=e121]
            - link "Engineering Mathematics 249 questions" [ref=e123] [cursor=pointer]:
              - /url: /practice?subject=Engineering%20Mathematics
              - generic [ref=e124]:
                - img [ref=e126]
                - generic [ref=e128]:
                  - heading "Engineering Mathematics" [level=3] [ref=e129]
                  - paragraph [ref=e130]: 249 questions
                - img [ref=e131]
            - link "General Aptitude 50 questions" [ref=e133] [cursor=pointer]:
              - /url: /practice?subject=General%20Aptitude
              - generic [ref=e134]:
                - img [ref=e136]
                - generic [ref=e138]:
                  - heading "General Aptitude" [level=3] [ref=e139]
                  - paragraph [ref=e140]: 50 questions
                - img [ref=e141]
            - link "Microprocessors 36 questions" [ref=e143] [cursor=pointer]:
              - /url: /practice?subject=Microprocessors
              - generic [ref=e144]:
                - img [ref=e146]
                - generic [ref=e148]:
                  - heading "Microprocessors" [level=3] [ref=e149]
                  - paragraph [ref=e150]: 36 questions
                - img [ref=e151]
            - link "Network Theory 202 questions" [ref=e153] [cursor=pointer]:
              - /url: /practice?subject=Network%20Theory
              - generic [ref=e154]:
                - img [ref=e156]
                - generic [ref=e158]:
                  - heading "Network Theory" [level=3] [ref=e159]
                  - paragraph [ref=e160]: 202 questions
                - img [ref=e161]
            - link "Signals and Systems 229 questions" [ref=e163] [cursor=pointer]:
              - /url: /practice?subject=Signals%20and%20Systems
              - generic [ref=e164]:
                - img [ref=e166]
                - generic [ref=e168]:
                  - heading "Signals and Systems" [level=3] [ref=e169]
                  - paragraph [ref=e170]: 229 questions
                - img [ref=e171]
        - generic [ref=e173]:
          - generic [ref=e174]:
            - heading "Top Performers" [level=2] [ref=e175]
            - link "View All" [ref=e176] [cursor=pointer]:
              - /url: /leaderboard
          - paragraph [ref=e178]: No users yet.
      - generic [ref=e179]:
        - generic [ref=e182]:
          - generic [ref=e184]: L
          - generic [ref=e186]:
            - generic [ref=e187]: "1"
            - generic [ref=e188]: "2"
            - generic [ref=e189]: "3"
            - generic [ref=e190]: "4"
            - generic [ref=e191]: "5"
            - generic [ref=e192]: "6"
            - generic [ref=e193]: "7"
            - generic [ref=e194]: "8"
        - generic [ref=e201]:
          - generic [ref=e202]:
            - img [ref=e203]
            - text: Realistic Interface
          - heading "Experience the exact TCS iON interface." [level=2] [ref=e205]
          - paragraph [ref=e206]: Don't let the exam UI be a surprise on test day. Practice with our pixel-perfect replica of the official GATE computer-based test interface.
          - list [ref=e207]:
            - listitem [ref=e208]:
              - img [ref=e209]
              - text: Virtual Calculator included
            - listitem [ref=e212]:
              - img [ref=e213]
              - text: Exact color-coded question palette
            - listitem [ref=e216]:
              - img [ref=e217]
              - text: Mark for Review workflows
            - listitem [ref=e220]:
              - img [ref=e221]
              - text: Keyboard navigation support
      - generic [ref=e224]:
        - generic [ref=e225]:
          - generic [ref=e226]:
            - img [ref=e227]
            - text: Global Elo Ratings
          - heading "Climb the ranks from Novice to Grandmaster." [level=2] [ref=e233]
          - paragraph [ref=e234]: Every mock test affects your global rating. Track your progress against thousands of aspirants nationwide and compete on the real-time leaderboard.
          - link "Start Climbing" [ref=e235] [cursor=pointer]:
            - /url: /login
            - text: Start Climbing
            - img [ref=e236]
        - generic [ref=e238]:
          - generic [ref=e240]:
            - generic [ref=e241]: "8"
            - generic [ref=e245]: "2400"
          - generic [ref=e246]:
            - generic [ref=e247]: "7"
            - generic [ref=e251]: "2200"
          - generic [ref=e252]:
            - generic [ref=e253]: "6"
            - generic [ref=e257]: "2000"
      - generic [ref=e262]:
        - heading "Ready to crack GATE?" [level=3] [ref=e263]
        - paragraph [ref=e264]: Join thousands of students practicing with GATECode. Track your progress, identify weak subjects, and master your branch today.
        - link "Create Free Account" [ref=e265] [cursor=pointer]:
          - /url: /login
          - text: Create Free Account
          - img [ref=e266]
    - region "Notifications alt+T"
  - generic [ref=e272] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e273]:
      - img [ref=e274]
    - generic [ref=e277]:
      - button "Open issues overlay" [ref=e278]:
        - generic [ref=e279]:
          - generic [ref=e280]: "3"
          - generic [ref=e281]: "4"
        - generic [ref=e282]:
          - text: Issue
          - generic [ref=e283]: s
      - button "Collapse issues badge" [ref=e284]:
        - img [ref=e285]
  - alert [ref=e287]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Home Page', () => {
  4  |   test('should load the home page successfully', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     
  7  |     // Check title or main heading
  8  |     // GATECode title should be present
  9  |     await expect(page).toHaveTitle(/GATECode/i);
  10 |     
  11 |     // The main heading might be "GATECode" or "Crack GATE"
  12 |     // Let's just check if the page body is visible
  13 |     const body = page.locator('body');
  14 |     await expect(body).toBeVisible();
  15 |   });
  16 | 
  17 |   test('should navigate to practice page', async ({ page }) => {
  18 |     await page.goto('/');
  19 |     
  20 |     // Attempt to find a link to practice
  21 |     const practiceLink = page.getByRole('link', { name: /Practice/i }).first();
  22 |     if (await practiceLink.isVisible()) {
> 23 |       await practiceLink.click();
     |                          ^ Error: locator.click: Test timeout of 120000ms exceeded.
  24 |       await expect(page).toHaveURL(/.*practice/);
  25 |     }
  26 |   });
  27 | 
  28 |   test('should navigate to login page', async ({ page }) => {
  29 |     await page.goto('/');
  30 |     
  31 |     const loginLink = page.getByRole('link', { name: /Login|Sign In/i }).first();
  32 |     if (await loginLink.isVisible()) {
  33 |       await loginLink.click();
  34 |       await expect(page).toHaveURL(/.*login/);
  35 |     }
  36 |   });
  37 | });
  38 | 
```