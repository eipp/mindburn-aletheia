import { test, expect } from '@playwright/test';

test.describe('Mini App Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Telegram Web App initialization
    await page.addInitScript(() => {
      window.Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          MainButton: {
            show: () => {},
            hide: () => {},
            setText: () => {},
          },
        },
      };
    });
  });

  test('task list view matches snapshot', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveScreenshot('task-list.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('verification view matches snapshot', async ({ page }) => {
    await page.goto('/verify/test-task-id');
    await expect(page).toHaveScreenshot('verification-view.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('wallet connection modal matches snapshot', async ({ page }) => {
    await page.goto('/wallet');
    await page.click('button:text("Connect Wallet")');
    await expect(page.locator('.wallet-modal')).toHaveScreenshot('wallet-modal.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('rewards dashboard matches snapshot', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page).toHaveScreenshot('rewards-dashboard.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('dark mode theme matches snapshot', async ({ page }) => {
    await page.goto('/tasks');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await expect(page).toHaveScreenshot('dark-mode.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
