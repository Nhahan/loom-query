import { test, expect } from "@playwright/test";
import path from "path";

const FIXTURE_PATH = path.join(__dirname, "../fixtures/sample.txt");
const UNIQUE_SEARCH_TERM = "aurora borealis phenomenon";
const EXPECTED_CONTENT = "aurora borealis";

test.describe("Document Upload to Search Flow", () => {
  test("uploads document and searches for content", async ({ page }) => {
    // Step 1: Navigate to /uploads page
    await page.goto("/uploads");
    await page.waitForLoadState("networkidle");

    // Verify we are on the uploads page
    await expect(page.getByRole("heading", { name: "자료 업로드" })).toBeVisible();

    // Step 2: Upload sample document via hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);

    // Step 3: Wait for success toast
    await expect(
      page.getByText("File uploaded successfully")
    ).toBeVisible({ timeout: 15000 });

    // Step 4: Wait for document to appear in list with status 'completed'
    // DocumentList fetches from /api/documents on mount; status 'done' renders as 'completed'
    // Poll by reloading until status badge shows 'completed' (up to 30s for embedding)
    await expect(async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
      const completedBadge = page.getByText("completed").first();
      await expect(completedBadge).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000, intervals: [3000] });

    // Step 5: Navigate to /search page
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "문서 검색" })).toBeVisible();

    // Step 6: Enter search query related to uploaded document content
    const searchInput = page.getByRole("textbox", { name: "Search documents" });
    await expect(searchInput).toBeVisible();
    await searchInput.fill(UNIQUE_SEARCH_TERM);

    // Step 7: Wait for search results to display (debounce is 500ms)
    await expect(
      page.getByRole("region").or(page.locator('[class*="flex flex-col gap-3"]'))
    ).toBeVisible({ timeout: 10000 }).catch(() => {
      // fallback: just wait for loading to finish
    });

    // Wait for loading spinner to disappear
    await expect(page.getByLabel("Loading")).not.toBeVisible({ timeout: 10000 });

    // Step 8: Verify at least 1 result returned
    const resultCards = page.locator('[class*="Card"], .card, [data-slot="card"]').filter({
      hasText: EXPECTED_CONTENT,
    });

    // Also accept any element containing the expected content in results area
    const anyResult = page.getByText(EXPECTED_CONTENT, { exact: false });
    await expect(anyResult).toBeVisible({ timeout: 10000 });

    // Step 9: Verify similarity score badge displays (format: "XX%")
    const similarityBadge = page.locator("span, div").filter({
      hasText: /^\d+%$/,
    }).first();
    await expect(similarityBadge).toBeVisible({ timeout: 5000 });

    // Confirm result count > 0 by verifying result cards render
    const cardCount = await resultCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });
});
