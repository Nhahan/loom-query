import { test, expect } from "@playwright/test";

test.describe("Theme State Persistence", () => {
  test("should persist dark mode toggle across page reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Get initial theme state
    const html = page.locator("html");

    // Initially should not have dark class
    const initialClasses = await html.getAttribute("class");
    const isDarkInitially = initialClasses?.includes("dark") ?? false;

    // Click theme toggle button
    const themeButton = page.getByRole("button", {
      name: /다크 모드|라이트 모드/i,
    });
    await themeButton.click();

    // Verify theme changed
    const classesAfterToggle = await html.getAttribute("class");
    const isDarkAfterToggle = classesAfterToggle?.includes("dark") ?? false;
    expect(isDarkAfterToggle).toBe(!isDarkInitially);

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify theme persists after reload
    const classesAfterReload = await html.getAttribute("class");
    const isDarkAfterReload = classesAfterReload?.includes("dark") ?? false;
    expect(isDarkAfterReload).toBe(!isDarkInitially);
  });

  test("should toggle between light and dark mode correctly", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const html = page.locator("html");
    const themeButton = page.getByRole("button", {
      name: /다크 모드|라이트 모드/i,
    });

    // Get initial state
    let currentClasses = await html.getAttribute("class");
    let isDark = currentClasses?.includes("dark") ?? false;

    // Toggle multiple times and verify button label changes
    for (let i = 0; i < 3; i++) {
      const buttonName = isDark ? /라이트 모드/i : /다크 모드/i;
      await expect(themeButton).toHaveAccessibleName(buttonName);

      await themeButton.click();

      currentClasses = await html.getAttribute("class");
      const isNowDark = currentClasses?.includes("dark") ?? false;
      expect(isNowDark).toBe(!isDark);
      isDark = isNowDark;
    }
  });

  test("dark mode preference persists across multiple page navigations", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Toggle to dark mode
    const themeButton = page.getByRole("button", {
      name: /다크 모드|라이트 모드/i,
    });
    await themeButton.click();

    const html = page.locator("html");
    let classes = await html.getAttribute("class");
    expect(classes?.includes("dark")).toBe(true);

    // Navigate to different routes
    const routes = ["/library", "/chat", "/settings"];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      classes = await html.getAttribute("class");
      expect(classes?.includes("dark")).toBe(true);
    }

    // Navigate back to home
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    classes = await html.getAttribute("class");
    expect(classes?.includes("dark")).toBe(true);
  });
});
