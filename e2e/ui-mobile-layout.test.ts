import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Mobile viewport emulation (iPhone SE)
test.describe('Mobile Layout (FR-001, FR-003)', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark'
  });

  test('should have no horizontal scroll and vertical stack on mobile', async ({ page }) => {
    await page.goto('http://localhost:5173/'); // Assume dev server running

    // Assert no horizontal scroll
    await expect(page.locator('body')).toHaveCSS('overflow-x', 'hidden');
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth); // No overflow

    // Assert vertical stack (no grid on mobile)
    const layoutStyle = await page.locator('body').evaluate(el => getComputedStyle(el).display);
    expect(layoutStyle).toBe('block'); // Or flex-direction: column

    // Assert map height ≤50vh
    const mapHeight = await page.locator('[data-testid="map"] or .map').evaluate(el => getComputedStyle(el).height);
    expect(mapHeight).toContain('vh');
    expect(parseFloat(mapHeight)).toBeLessThanOrEqual(50);

    // Assert message stream below map without overlap
    const mapRect = await page.locator('.map').boundingBox();
    const messageRect = await page.locator('.message-stream').boundingBox();
    if (mapRect && messageRect) {
      expect(messageRect.y).toBeGreaterThan(mapRect.y + mapRect.height); // No overlap
    }

    // Expect failure: current layout likely has overflow
  });

  test('should have touch targets ≥44px', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Check interactive elements (buttons, links)
    const interactiveEls = await page.locator('button, a, [role="button"]').all();
    for (const el of interactiveEls) {
      const box = await el.boundingBox();
      if (box) {
        const area = box.width * box.height;
        expect(area).toBeGreaterThanOrEqual(44 * 44); // ≥44px tappable area
      }
    }

    // Expect failure: some elements may be smaller
  });

  test('should apply dark sci-fi theme on mobile', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Assert CSS variables for theme
    const bgColor = await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--primary-bg'));
    expect(bgColor.trim()).toBe('#0a0a0a'); // Dark background

    const accentBlue = await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--accent-blue'));
    expect(accentBlue.trim()).toBe('#00f5ff'); // Cosmic blue

    // Assert map and components use theme colors
    const mapBg = await page.locator('.map').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(mapBg).toContain('0a0a0a'); // Dark theme applied

    // Expect failure: theme may not be fully implemented
  });

  test('should have CLS ≤0.1 on orientation change', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Simulate orientation change (landscape)
    await page.setViewportSize({ width: 667, height: 375 });

    // Measure layout shift using Performance API
    const metrics = await page.evaluate(() => {
      return new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const clsEntry = entries.find(entry => entry.entryType === 'layout-shift');
        return clsEntry ? (clsEntry as LayoutShift).value : 0;
      }).observe({ entryTypes: ['layout-shift'] });
      
      // Trigger layout change (e.g., resize event)
      window.dispatchEvent(new Event('resize'));
      
      // Wait and get CLS
      return new Promise(resolve => setTimeout(() => {
        const observer = performance.getEntriesByType('layout-shift');
        const cls = observer.reduce((sum, entry) => sum + (entry as LayoutShift).value, 0);
        resolve(cls);
      }, 1000));
    });

    expect(metrics as number).toBeLessThanOrEqual(0.1); // CLS ≤0.1

    // Expect failure: layout shifts likely >0.1
  });

  test('should pass accessibility scan on mobile', async ({ page, axe }) => {
    await page.goto('http://localhost:5173/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);

    // Expect failure: current UI likely has accessibility issues
  });
});