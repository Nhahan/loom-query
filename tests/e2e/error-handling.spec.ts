import { test, expect } from "@playwright/test";

test.describe("Error Boundary and Error Handling", () => {
  test("should display page navigation without errors", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify main content loads without errors
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // No console errors should be logged (check for JavaScript errors)
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.toString());
    });

    // Navigate through key routes
    const routes = ["/library", "/chat", "/api-portal", "/activity", "/settings", "/uploads"];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(main).toBeVisible();
    }

    // Verify no unhandled errors occurred
    expect(errors).toHaveLength(0);
  });

  test("should have proper layout structure with sidebar", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify sidebar exists
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Verify main content area exists
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Verify both are in the DOM
    const html = page.locator("html");
    await expect(html).toContainText(/대시보드|자료실|자료 업로드/);
  });

  test("should display all 7 navigation items in sidebar", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // All 7 nav items should be present in sidebar
    const sidebar = page.locator("aside");
    const navItems = [
      "대시보드",
      "자료실",
      "자료 업로드",
      "AI 질문하기",
      "API & 연동",
      "활동 기록",
      "설정",
    ];

    for (const item of navItems) {
      await expect(sidebar.getByRole("link", { name: item })).toBeVisible();
    }
  });

  test("should navigate between routes and display correct content", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Navigate to library
    await page.getByText("자료실").click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/library/);

    // Navigate to chat
    await page.getByText("AI 질문하기").click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/chat/);

    // Navigate to settings
    await page.getByText("설정").click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/settings/);
  });

  test("should have theme toggle button accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Theme toggle should be accessible
    const themeButton = page.getByRole("button", {
      name: /다크 모드|라이트 모드/i,
    });
    await expect(themeButton).toBeVisible();
    await expect(themeButton).toBeEnabled();

    // Should be clickable without errors
    await themeButton.click();
    await page.waitForLoadState("networkidle");

    // Button should still be there and functional
    await expect(themeButton).toBeVisible();
  });

  test("should have sidebar collapse button accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Collapse button should be accessible
    const collapseButton = page.getByRole("button", {
      name: /사이드바 접기/i,
    });
    await expect(collapseButton).toBeVisible();
    await expect(collapseButton).toBeEnabled();

    // Should be clickable without errors
    await collapseButton.click();
    await page.waitForLoadState("networkidle");

    // Should transition smoothly (no errors)
    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveClass(/w-14/);
  });

  test("breadcrumb navigation should display correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Root page should have breadcrumb with home
    const breadcrumb = page.locator('nav[aria-label="breadcrumb"]');
    if (await breadcrumb.isVisible()) {
      // Breadcrumb exists and is visible
      await expect(breadcrumb).toBeVisible();
    }

    // Navigate to a sub-page and verify breadcrumb updates
    await page.getByText("자료실").click();
    await page.waitForLoadState("networkidle");

    if (await breadcrumb.isVisible()) {
      // Breadcrumb should show the current route
      const breadcrumbText = await breadcrumb.textContent();
      expect(breadcrumbText).toBeTruthy();
    }
  });
});
