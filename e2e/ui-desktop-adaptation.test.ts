import { test, expect } from '@playwright/test';

test.describe('Desktop Adaptation (FR-001, FR-002)', () => {
  test.beforeEach(async ({ browser }) => {
    // Start with desktop viewport
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      colorScheme: 'dark'
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5173/');
    return page;
  });

  test('should shift from 1-col to 2-col grid on resize to tablet', async ({ page }) => {
    // Initial desktop layout (1920px)
    await expect(page.locator('body')).toHaveCSS('display', 'grid');
    const initialCols = await page.evaluate(() => getComputedStyle(document.body).gridTemplateColumns);
    expect(initialCols).toContain('1fr 1fr'); // 2-col grid on desktop

    // Resize to tablet (800px)
    await page.setViewportSize({ width: 800, height: 600 });

    // Assert layout shifts to 2-col (or appropriate for tablet)
    const tabletCols = await page.evaluate(() => getComputedStyle(document.body).gridTemplateColumns);
    expect(tabletCols).toContain('1fr 1fr'); // Still 2-col, but responsive

    // Assert no layout shift >100px
    const beforeResizeMetrics = await page.evaluate(() => {
      return {
        mapRect: document.querySelector('.map')?.getBoundingClientRect(),
        layoutRect: document.body.getBoundingClientRect()
      };
    });

    // Trigger resize event
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));

    const afterResizeMetrics = await page.evaluate(() => {
      return {
        mapRect: document.querySelector('.map')?.getBoundingClientRect(),
        layoutRect: document.body.getBoundingClientRect()
      };
    });

    // Check for minimal layout shift
    if (beforeResizeMetrics.mapRect && afterResizeMetrics.mapRect) {
      const shiftX = Math.abs(afterResizeMetrics.mapRect.x - beforeResizeMetrics.mapRect.x);
      const shiftY = Math.abs(afterResizeMetrics.mapRect.y - beforeResizeMetrics.mapRect.y);
      expect(shiftX).toBeLessThan(100);
      expect(shiftY).toBeLessThan(100);
    }

    // Expect failure: current layout likely doesn't adapt properly
  });

  test('should center map on desktop and tablet', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForLoadState('networkidle');

    const mapElement = page.locator('.map, [data-testid="map"]');
    const mapRect = await mapElement.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Assert map is centered (x position ≈ viewportWidth/2 - mapWidth/2)
    if (mapRect) {
      const expectedCenter = viewportWidth / 2;
      const actualCenter = mapRect.x + mapRect.width / 2;
      const offset = Math.abs(expectedCenter - actualCenter);
      expect(offset).toBeLessThan(viewportWidth * 0.05); // ≤5% offset from center

      // Assert map uses responsive sizing
      const mapStyle = await mapElement.evaluate(el => getComputedStyle(el));
      expect(mapStyle.width).toContain('%'); // Or vw
      expect(mapStyle.height).toContain('vh');
    }

    // Resize to tablet and recheck
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500); // Allow layout to settle

    const tabletMapRect = await mapElement.boundingBox();
    const tabletViewportWidth = await page.evaluate(() => window.innerWidth);

    if (tabletMapRect) {
      const tabletExpectedCenter = tabletViewportWidth / 2;
      const tabletActualCenter = tabletMapRect.x + tabletMapRect.width / 2;
      const tabletOffset = Math.abs(tabletExpectedCenter - tabletActualCenter);
      expect(tabletOffset).toBeLessThan(tabletViewportWidth * 0.05); // ≤5% offset

      // Assert connections remain visible
      const connectionElements = await page.locator('.connection, [data-connection]').count();
      expect(connectionElements).toBeGreaterThan(0);
      const connectionOpacity = await page.locator('.connection').getAttribute('style');
      expect(connectionOpacity).toContain('opacity: 1'); // Visible connections
    }

    // Expect failure: map likely positioned at top-left currently
  });

  test('should maintain performance during resize', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5173/');

    // Measure initial performance
    const initialMetrics = await page.evaluate(() => {
      return {
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        layoutShift: performance.getEntriesByType('layout-shift').reduce((sum, entry) => sum + (entry as any).value, 0)
      };
    });

    // Resize to tablet
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000); // Allow reflow

    const afterResizeMetrics = await page.evaluate(() => {
      return {
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        layoutShift: performance.getEntriesByType('layout-shift').reduce((sum, entry) => sum + (entry as any).value, 0)
      };
    });

    // Assert performance thresholds
    expect(afterResizeMetrics.layoutShift).toBeLessThan(0.1); // Minimal layout shift
    expect(afterResizeMetrics.fcp).toBeLessThan(2000); // FCP < 2s on resize

    // Expect failure: resize likely causes significant layout shifts
  });

  test('should preserve connection visibility across breakpoints', async ({ page }) => {
    // Start at desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5173/');

    // Count initial connections
    const initialConnections = await page.locator('.connection, line[data-connection], path[data-connection]').count();
    expect(initialConnections).toBeGreaterThan(0);

    // Resize through breakpoints
    const breakpoints = [
      { width: 1200, height: 800 }, // Large tablet
      { width: 800, height: 600 },  // Small tablet
      { width: 375, height: 667 }   // Mobile
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize(breakpoint);
      await page.waitForTimeout(500);

      const currentConnections = await page.locator('.connection, line[data-connection], path[data-connection]').count();
      expect(currentConnections).toBeGreaterThan(0); // Connections remain visible

      // Check connection styles (glowing effect)
      const connectionStyle = await page.locator('.connection').evaluate(el => getComputedStyle(el));
      expect(connectionStyle.opacity).toBe('1');
      expect(connectionStyle.boxShadow).toContain('00f5ff'); // Blue glow effect
    }

    // Expect failure: connections likely disappear or lose styling on smaller screens
  });
});