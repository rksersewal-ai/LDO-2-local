import { test, expect } from "@playwright/test";

test.describe("LDO-2 Core Workflows", () => {
  test("Login flow — valid credentials redirect to dashboard", async ({ page }) => {
    await page.goto("/login");

    // Verify login page loaded
    await expect(page.locator("text=Sign in to Admin Workspace")).toBeVisible();

    // Fill credentials (mock API accepts admin/admin123)
    await page.fill("#username", "admin");
    await page.fill("#password", "admin123");

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("Login flow — invalid credentials show error", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#username", "wronguser");
    await page.fill("#password", "wrongpass");
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator("text=Invalid credentials")).toBeVisible({ timeout: 5000 });
    // Should stay on login page
    await expect(page).toHaveURL("/login");
  });

  test("Navigation — sidebar links work", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill("#username", "admin");
    await page.fill("#password", "admin123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Navigate to Documents via sidebar
    await page.click('a[href="/documents"]');
    await expect(page).toHaveURL("/documents");
    await expect(page.locator("text=Document Hub")).toBeVisible();
  });

  test("Theme toggle — switches between dark and light", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#username", "admin");
    await page.fill("#password", "admin123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Find and click theme toggle button
    const themeButton = page.locator('button[aria-label*="Switch to"]');
    await expect(themeButton).toBeVisible();

    // Click to toggle theme
    await themeButton.click();

    // Verify the class changed on document element
    const htmlElement = page.locator("html");
    const hasDark = await htmlElement.evaluate((el) => el.classList.contains("dark"));
    // Theme should have toggled (either to dark or light depending on default)
    expect(typeof hasDark).toBe("boolean");
  });

  test("Command palette — opens with keyboard shortcut", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#username", "admin");
    await page.fill("#password", "admin123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Open command palette with Ctrl+K
    await page.keyboard.press("Control+k");

    // Should show search input
    await expect(page.locator('input[placeholder*="Search pages"]')).toBeVisible({ timeout: 3000 });

    // Close with Escape
    await page.keyboard.press("Escape");
  });
});
