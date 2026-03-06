import { test, expect } from "@playwright/test";

test.describe("Sidebar State Persistence (Zustand Hydration)", () => {
  test("should persist collapsed state across page reload", async ({ page }) => {
    // Navigate to app
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Initially sidebar should be expanded (default state)
    const sidebar = page.locator("aside");
    let classValue = await sidebar.getAttribute("class");
    expect(classValue).toContain("w-56");

    // Click collapse button
    const collapseButton = page.getByRole("button", { name: /사이드바 접기|collapse/i });
    await collapseButton.click({ force: true });
    await page.waitForTimeout(400);

    // Verify sidebar is now collapsed
    classValue = await sidebar.getAttribute("class");
    expect(classValue).toContain("w-14");

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify sidebar remains collapsed after reload
    const sidebarAfterReload = page.locator("aside");
    const classValueAfterReload = await sidebarAfterReload.getAttribute("class");
    expect(classValueAfterReload).toContain("w-14");
  });

  test("sidebar has collapse and expand button controls", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Collapse button should be available
    const collapseButton = page.getByRole("button", { name: /사이드바 접기|collapse/i });
    await expect(collapseButton).toBeVisible();
    await expect(collapseButton).toBeEnabled();

    // Button should be clickable
    await collapseButton.click({ force: true });
    await page.waitForTimeout(500);

    // After click, expand button should become available
    const expandButton = page.getByRole("button", { name: /사이드바 펼치기|expand/i });
    await expect(expandButton).toBeVisible();
  });

  test("nav items are accessible in sidebar", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify nav items are accessible as links in sidebar
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

    for (const linkName of navItems) {
      const link = sidebar.getByRole("link", { name: linkName });
      await expect(link).toBeVisible();
    }
  });

  test("sidebar navigation links are accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const sidebar = page.locator("aside");
    const libraryLink = sidebar.getByRole("link", { name: "자료실" });
    const chatLink = sidebar.getByRole("link", { name: "AI 질문하기" });
    const settingsLink = sidebar.getByRole("link", { name: "설정" });

    // All navigation links should be visible and clickable
    await expect(libraryLink).toBeVisible();
    await expect(libraryLink).toHaveAttribute("href", /\/library/);

    await expect(chatLink).toBeVisible();
    await expect(chatLink).toHaveAttribute("href", /\/chat/);

    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toHaveAttribute("href", /\/settings/);
  });
});
