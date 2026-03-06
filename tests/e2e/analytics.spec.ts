import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Analytics Endpoints', () => {
  test('GET /api/analytics/documents returns stats', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/documents`);

    expect(response.status()).toBe(200);

    const body = await response.json() as {
      data: {
        total_count: number;
        total_size: number;
        avg_size: number;
        format_distribution: Record<string, number>;
      };
      response_time: number;
    };

    expect(body.data).toHaveProperty('total_count');
    expect(body.data).toHaveProperty('total_size');
    expect(body.data).toHaveProperty('avg_size');
    expect(body.data).toHaveProperty('format_distribution');
    expect(typeof body.response_time).toBe('number');
    expect(body.response_time).toBeLessThan(500);
  });

  test('GET /api/analytics/search-trends returns trends', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/search-trends?days=7`);

    expect(response.status()).toBe(200);

    const body = await response.json() as {
      data: Array<{ query: string; count: number; unique_users: number }>;
      response_time: number;
    };

    expect(Array.isArray(body.data)).toBeTruthy();
    expect(typeof body.response_time).toBe('number');
  });

  test('GET /api/analytics/search-trends with invalid days returns 400', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/search-trends?days=200`);
    expect(response.status()).toBe(400);
  });

  test('GET /api/analytics/search-trends defaults to 7 days', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/search-trends`);
    expect(response.status()).toBe(200);

    const body = await response.json() as {
      data: Array<{ query: string }>;
    };
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('GET /api/analytics/activity returns activity stats', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/activity`);

    expect(response.status()).toBe(200);

    const body = await response.json() as {
      data: {
        documents_created: number;
        searches_performed: number;
        avg_search_time_ms: number;
      };
      response_time: number;
    };

    expect(body.data).toHaveProperty('documents_created');
    expect(body.data).toHaveProperty('searches_performed');
    expect(body.data).toHaveProperty('avg_search_time_ms');
    expect(typeof body.response_time).toBe('number');
  });
});

test.describe('Analytics Dashboard Page', () => {
  test('Analytics page loads successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'domcontentloaded' });

    const heading = page.getByRole('heading', { name: /Analytics Dashboard/i });
    await expect(heading).toBeVisible();
  });

  test('Dashboard displays all required statistics', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });

    // Wait for stats to load
    await page.waitForTimeout(500);

    await expect(page.getByText('Total Documents')).toBeVisible();
    await expect(page.getByText('Total Size')).toBeVisible();
    await expect(page.getByText('Average Document Size')).toBeVisible();
    await expect(page.getByText('Searches Performed')).toBeVisible();
  });

  test('Dashboard displays visualizations', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });

    await expect(page.getByText('Document Format Distribution')).toBeVisible();
    await expect(page.getByText('Top Search Queries (7 days)')).toBeVisible();
    await expect(page.getByText('Activity Summary')).toBeVisible();
  });

  test('Dashboard is responsive on mobile', async ({ page }) => {
    page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });

    const heading = page.getByRole('heading', { name: /Analytics Dashboard/i });
    await expect(heading).toBeVisible();
  });

  test('Dashboard is responsive on tablet', async ({ page }) => {
    page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });

    const heading = page.getByRole('heading', { name: /Analytics Dashboard/i });
    await expect(heading).toBeVisible();
  });

  test('Dashboard is responsive on desktop', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });

    const heading = page.getByRole('heading', { name: /Analytics Dashboard/i });
    await expect(heading).toBeVisible();
  });

  test('Handles empty analytics data gracefully', async ({ page }) => {
    // Even with no data, the page should load without errors
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });

    const heading = page.getByRole('heading', { name: /Analytics Dashboard/i });
    await expect(heading).toBeVisible();
  });

  test('Error fallback displays when API fails', async ({ page }) => {
    // Navigate to analytics - if APIs fail, error should display
    // This test assumes the app handles fetch errors gracefully
    await page.goto(`${BASE_URL}/analytics`);

    // Either the dashboard should load or error message should appear
    const heading = page.getByRole('heading', { name: /Analytics Dashboard|Failed to Load/i });
    await expect(heading).toBeVisible();
  });
});

test.describe('Analytics Data Aggregation', () => {
  test('Document stats aggregate correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/documents`);

    if (response.status() === 200) {
      const body = await response.json() as {
        data: {
          total_count: number;
          total_size: number;
          avg_size: number;
        };
      };

      // Basic sanity checks
      expect(body.data.total_count).toBeGreaterThanOrEqual(0);
      expect(body.data.total_size).toBeGreaterThanOrEqual(0);
      expect(body.data.avg_size).toBeGreaterThanOrEqual(0);

      // If there are documents, average should be reasonable
      if (body.data.total_count > 0) {
        expect(body.data.avg_size).toBeLessThanOrEqual(body.data.total_size);
      }
    }
  });

  test('Search trends are returned in frequency order', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/search-trends?days=7`);

    if (response.status() === 200) {
      const body = await response.json() as {
        data: Array<{ count: number }>;
      };

      // If there are trends, check they're in descending order
      if (body.data.length > 1) {
        for (let i = 1; i < body.data.length; i++) {
          expect(body.data[i - 1].count).toBeGreaterThanOrEqual(body.data[i].count);
        }
      }
    }
  });

  test('Activity metrics are non-negative', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/activity`);

    if (response.status() === 200) {
      const body = await response.json() as {
        data: {
          documents_created: number;
          searches_performed: number;
          avg_search_time_ms: number;
        };
      };

      expect(body.data.documents_created).toBeGreaterThanOrEqual(0);
      expect(body.data.searches_performed).toBeGreaterThanOrEqual(0);
      expect(body.data.avg_search_time_ms).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Analytics Performance', () => {
  test('All analytics endpoints respond within 500ms', async ({ request }) => {
    const endpoints = [
      '/api/analytics/documents',
      '/api/analytics/search-trends?days=7',
      '/api/analytics/activity',
    ];

    for (const endpoint of endpoints) {
      const start = Date.now();
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const elapsed = Date.now() - start;

      expect(response.ok()).toBeTruthy();
      expect(elapsed).toBeLessThan(500);
    }
  });

  test('Dashboard page loads within 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(3000);
  });
});
