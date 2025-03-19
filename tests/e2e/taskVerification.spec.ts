import { test, expect } from '@playwright/test';
import { TelegramWebApp } from './fixtures/telegramWebApp';

test.describe('Task Verification Flow', () => {
  test.beforeEach(async ({ context }) => {
    // Initialize Telegram Mini App environment
    await TelegramWebApp.init(context);
  });

  test('should complete full verification flow', async ({ page }) => {
    // Navigate to tasks page
    await page.goto('/tasks');

    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-list"]');

    // Click on available task
    await page.click('[data-testid="task-card"]:first-child');

    // Verify task details are shown
    await expect(page.locator('[data-testid="task-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-reward"]')).toBeVisible();

    // Accept task
    await page.click('[data-testid="accept-task-button"]');

    // Verify task is in progress
    await expect(page.locator('[data-testid="task-status"]')).toHaveText('In Progress');

    // Submit verification (true case)
    await page.click('[data-testid="verify-true-button"]');
    await page.fill('[data-testid="confidence-input"]', '0.9');
    await page.click('[data-testid="submit-verification-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Check payment status
    await page.goto('/payments');
    await expect(page.locator('[data-testid="payment-status"]')).toHaveText('Success');
  });

  test('should handle verification rejection', async ({ page }) => {
    await page.goto('/tasks');
    
    // Accept and reject task
    await page.click('[data-testid="task-card"]:first-child');
    await page.click('[data-testid="accept-task-button"]');
    await page.click('[data-testid="verify-false-button"]');
    await page.fill('[data-testid="confidence-input"]', '0.8');
    await page.click('[data-testid="submit-verification-button"]');

    // Verify rejection flow
    await expect(page.locator('[data-testid="rejection-reason"]')).toBeVisible();
    await page.fill('[data-testid="rejection-reason"]', 'Image is unclear');
    await page.click('[data-testid="confirm-rejection-button"]');

    // Verify partial payment
    await page.goto('/payments');
    await expect(page.locator('[data-testid="payment-amount"]')).toContainText('0.5');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    
    await page.goto('/tasks');
    await page.click('[data-testid="task-card"]:first-child');
    await page.click('[data-testid="accept-task-button"]');

    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Retry after going online
    await page.context().setOffline(false);
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="task-status"]')).toHaveText('In Progress');
  });

  test('should validate inputs', async ({ page }) => {
    await page.goto('/tasks');
    await page.click('[data-testid="task-card"]:first-child');
    await page.click('[data-testid="accept-task-button"]');

    // Try submitting without confidence
    await page.click('[data-testid="verify-true-button"]');
    await page.click('[data-testid="submit-verification-button"]');
    await expect(page.locator('[data-testid="confidence-error"]')).toBeVisible();

    // Try invalid confidence value
    await page.fill('[data-testid="confidence-input"]', '2.0');
    await expect(page.locator('[data-testid="confidence-error"]')).toHaveText(
      'Confidence must be between 0 and 1'
    );
  });

  test('should update wallet balance', async ({ page }) => {
    // Get initial balance
    await page.goto('/wallet');
    const initialBalance = await page.locator('[data-testid="wallet-balance"]').innerText();

    // Complete verification task
    await page.goto('/tasks');
    await page.click('[data-testid="task-card"]:first-child');
    await page.click('[data-testid="accept-task-button"]');
    await page.click('[data-testid="verify-true-button"]');
    await page.fill('[data-testid="confidence-input"]', '0.9');
    await page.click('[data-testid="submit-verification-button"]');

    // Wait for payment processing
    await page.waitForTimeout(2000);

    // Check updated balance
    await page.goto('/wallet');
    const newBalance = await page.locator('[data-testid="wallet-balance"]').innerText();
    expect(parseFloat(newBalance)).toBeGreaterThan(parseFloat(initialBalance));
  });
}); 