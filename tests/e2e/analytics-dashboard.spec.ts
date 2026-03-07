import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

/**
 * Analytics Dashboard tests
 * SKIPPED: Analytics dashboard not yet implemented (part of US-404)
 * These tests will be activated once the analytics feature is complete
 */

test.describe('Analytics Dashboard', () => {
  test('loads analytics page successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Verify page title/header is present
    await expect(page.getByRole('heading', { name: /Analytics Dashboard/i })).toBeVisible({ timeout: 15000 });
  });

  test('displays document statistics cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // Check for stats cards with expected titles
    await expect(page.getByText('Total Documents')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Total Size')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Average Document Size')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Searches Performed')).toBeVisible({ timeout: 15000 });
  });

  test('displays charts and visualizations', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // Check for chart headings
    const formatDistHeader = page.getByText('Document Format Distribution');
    const searchTrendHeader = page.getByText('Top Search Queries (7 days)');

    await expect(formatDistHeader).toBeVisible({ timeout: 15000 });
    await expect(searchTrendHeader).toBeVisible({ timeout: 15000 });
  });

  test('displays activity summary section', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // Check for activity summary section
    const activityHeader = page.getByText('Activity Summary');
    await expect(activityHeader).toBeVisible({ timeout: 15000 });

    // Check for activity metrics
    await expect(page.getByText('Documents Created')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Total Searches')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Average Search Time')).toBeVisible({ timeout: 15000 });
  });

  test('analytics endpoints respond correctly', async ({ request }) => {
    // Test documents endpoint
    const docsResponse = await request.get(`${BASE_URL}/api/analytics/documents`, { timeout: 10000 });
    expect(docsResponse.ok()).toBeTruthy();
    const docsData = await docsResponse.json() as {
      data: { total_count: number; total_size: number; avg_size: number };
      response_time: number;
    };
    expect(docsData.data).toHaveProperty('total_count');
    expect(docsData.data).toHaveProperty('total_size');
    expect(docsData.data).toHaveProperty('avg_size');
    expect(typeof docsData.response_time).toBe('number');

    // Test search trends endpoint
    const trendsResponse = await request.get(`${BASE_URL}/api/analytics/search-trends?days=7`, { timeout: 10000 });
    expect(trendsResponse.ok()).toBeTruthy();
    const trendsData = await trendsResponse.json() as {
      data: Array<{ query: string; count: number }>;
      response_time: number;
    };
    expect(Array.isArray(trendsData.data)).toBeTruthy();
    expect(typeof trendsData.response_time).toBe('number');

    // Test activity endpoint
    const activityResponse = await request.get(`${BASE_URL}/api/analytics/activity`, { timeout: 10000 });
    expect(activityResponse.ok()).toBeTruthy();
    const activityData = await activityResponse.json() as {
      data: {
        documents_created: number;
        searches_performed: number;
        avg_search_time_ms: number;
      };
      response_time: number;
    };
    expect(activityData.data).toHaveProperty('documents_created');
    expect(activityData.data).toHaveProperty('searches_performed');
    expect(activityData.data).toHaveProperty('avg_search_time_ms');
    expect(typeof activityData.response_time).toBe('number');
  });

  test('analytics endpoints respond within performance target', async ({ request }) => {
    // Documents endpoint should respond in <500ms
    const docStart = Date.now();
    const docsResponse = await request.get(`${BASE_URL}/api/analytics/documents`, { timeout: 10000 });
    const docElapsed = Date.now() - docStart;

    expect(docsResponse.ok()).toBeTruthy();
    expect(docElapsed).toBeLessThan(500);

    // Search trends endpoint should respond in <500ms
    const trendStart = Date.now();
    const trendsResponse = await request.get(`${BASE_URL}/api/analytics/search-trends?days=7`, { timeout: 10000 });
    const trendElapsed = Date.now() - trendStart;

    expect(trendsResponse.ok()).toBeTruthy();
    expect(trendElapsed).toBeLessThan(500);

    // Activity endpoint should respond in <500ms
    const activityStart = Date.now();
    const activityResponse = await request.get(`${BASE_URL}/api/analytics/activity`, { timeout: 10000 });
    const activityElapsed = Date.now() - activityStart;

    expect(activityResponse.ok()).toBeTruthy();
    expect(activityElapsed).toBeLessThan(500);
  });

  test('page is responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // Check that key elements are visible in mobile view
    await expect(page.getByRole('heading', { name: /Analytics Dashboard/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Total Documents')).toBeVisible({ timeout: 15000 });
  });

  test('page is responsive on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // Check that key elements are visible in tablet view
    await expect(page.getByRole('heading', { name: /Analytics Dashboard/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Document Format Distribution')).toBeVisible({ timeout: 15000 });
  });

  test('page is responsive on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // Check that all major sections are visible
    await expect(page.getByRole('heading', { name: /Analytics Dashboard/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Document Format Distribution')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Top Search Queries')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Activity Summary')).toBeVisible({ timeout: 15000 });
  });

  test('handles missing days parameter with default value', async ({ request }) => {
    // Should default to 7 days
    const response = await request.get(`${BASE_URL}/api/analytics/search-trends`, { timeout: 10000 });
    expect(response.ok()).toBeTruthy();

    const data = await response.json() as {
      data: Array<{ query: string; count: number }>;
    };
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('rejects invalid days parameter', async ({ request }) => {
    // Days outside valid range should be rejected
    const response = await request.get(`${BASE_URL}/api/analytics/search-trends?days=200`, { timeout: 10000 });
    expect(response.status()).toBe(400);
  });
});
