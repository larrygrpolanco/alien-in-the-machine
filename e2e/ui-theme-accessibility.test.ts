import { test, expect } from '@playwright/test';

test.describe('Theme & Accessibility (NFR-002)', () => {
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      colorScheme: 'dark',
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    return page;
  });

  test('should have WCAG AA contrast ratio ≥4.5:1 for all text', async ({ page }) => {
    // Get all text elements
    const textElements = await page.locator('body').locator('*:visible').filter({ hasText: true }).all();

    for (const element of textElements) {
      const computedStyle = await element.evaluate(el => getComputedStyle(el));
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;
      const fontSize = parseFloat(computedStyle.fontSize);

      // Skip very small text or decorative elements
      if (fontSize < 12) continue;

      // Calculate contrast ratio (simplified - in practice use a contrast library)
      const contrast = await element.evaluate((el, color, bgColor) => {
        // Simple RGB to relative luminance conversion
        function rgbToLuminance(r: number, g: number, b: number): number {
          r /= 255; g /= 255; b /= 255;
          r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
          g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
          b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        function parseColor(colorStr: string): [number, number, number] | null {
          const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
          }
          return null;
        }

        const textRgb = parseColor(color);
        const bgRgb = parseColor(bgColor);
        
        if (!textRgb || !bgRgb) return 1; // Default pass if can't parse

        const textLuminance = rgbToLuminance(...textRgb);
        const bgLuminance = rgbToLuminance(...bgRgb);
        const contrastRatio = (Math.max(textLuminance, bgLuminance) + 0.05) / (Math.min(textLuminance, bgLuminance) + 0.05);
        
        return contrastRatio;
      }, color, backgroundColor);

      // WCAG AA requires 4.5:1 for normal text
      expect(contrast).toBeGreaterThanOrEqual(4.5);

      // For large text (≥18px or ≥14px bold), 3:1 is acceptable
      if (fontSize >= 18 || (fontSize >= 14 && computedStyle.fontWeight >= '600')) {
        expect(contrast).toBeGreaterThanOrEqual(3);
      }
    }

    // Expect failure: current theme likely has insufficient contrast
  });

  test('should use ≥16px base font size on all elements', async ({ page }) => {
    // Get all text elements
    const textElements = await page.locator('body').locator('*:visible').filter({ hasText: true }).all();

    for (const element of textElements) {
      const fontSize = await element.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      
      // Base font size should be ≥16px (1rem typically)
      expect(fontSize).toBeGreaterThanOrEqual(16);

      // Check font family is readable (sans-serif preferred for sci-fi theme)
      const fontFamily = await element.evaluate(el => getComputedStyle(el).fontFamily);
      expect(fontFamily).toContain('sans-serif'); // Or specific sci-fi font
    }

    // Responsive font scaling
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await page.waitForTimeout(500);

    const mobileTextElements = await page.locator('body').locator('*:visible').filter({ hasText: true }).all();
    for (const element of mobileTextElements) {
      const mobileFontSize = await element.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(mobileFontSize).toBeGreaterThanOrEqual(16); // Maintain readability on mobile
    }

    // Expect failure: some text may be smaller than 16px
  });

  test('should have proper ARIA labels and roles on interactive elements', async ({ page }) => {
    // Map component ARIA
    const mapElement = page.locator('.map, [data-testid="map"], src/lib/components/Map.svelte');
    await expect(mapElement).toBeVisible();

    // Map should have appropriate role
    const mapRole = await mapElement.getAttribute('role');
    expect(['img', 'application', 'figure', 'diagram']).toContain(mapRole);

    // Map should have descriptive label
    const mapAriaLabel = await mapElement.getAttribute('aria-label');
    expect(mapAriaLabel).toBeTruthy();
    expect(mapAriaLabel).toMatch(/alien|map|machine|layout/i);

    // Map should have description if complex
    const mapDescribedBy = await mapElement.getAttribute('aria-describedby');
    if (mapDescribedBy) {
      const descriptionElement = page.locator(`#${mapDescribedBy}`);
      await expect(descriptionElement).toBeVisible();
      const descriptionText = await descriptionElement.textContent();
      expect(descriptionText).toHaveLengthGreaterThan(10); // Meaningful description
    }

    // Connection elements ARIA
    const connectionElements = page.locator('[aria-label*="connection"], [role="link"][data-connection]');
    const connectionCount = await connectionElements.count();

    for (let i = 0; i < connectionCount; i++) {
      const connection = connectionElements.nth(i);
      
      // Each connection should have role
      const role = await connection.getAttribute('role');
      expect(['link', 'status', 'separator', 'img']).toContain(role);

      // Descriptive ARIA label
      const ariaLabel = await connection.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/connection|link|map|message|status/i);

      // Live region for dynamic updates
      const ariaLive = await connection.getAttribute('aria-live');
      if (ariaLive) {
        expect(['polite', 'assertive']).toContain(ariaLive);
      }

      // Active state indication
      const ariaPressed = await connection.getAttribute('aria-pressed');
      if (await connection.isVisible() && ariaPressed !== null) {
        expect(['true', 'false']).toContain(ariaPressed);
      }
    }

    // Message stream ARIA
    const messageStream = page.locator('.message-stream, [data-testid="message-stream"]');
    await expect(messageStream).toHaveAttribute('role', 'log' || 'region');
    await expect(messageStream).toHaveAttribute('aria-live', 'polite');
    await expect(messageStream).toHaveAttribute('aria-label', /message|log|stream/i);

    // Agent status ARIA
    const agentStatus = page.locator('.agent-status, [data-testid="agent-status"]');
    await expect(agentStatus).toHaveAttribute('role', 'status' || 'region');
    await expect(agentStatus).toHaveAttribute('aria-label', /agent|status|marine|alien/i);

    // Keyboard navigation
    await page.keyboard.press('Tab');
    const firstFocusable = await page.locator(':focusable').first();
    const focusableCount = await page.locator(':focusable').count();
    expect(focusableCount).toBeGreaterThan(0);
    expect(await firstFocusable.isVisible()).toBe(true);

    // Expect failure: missing ARIA attributes and roles currently
  });

  test('should pass axe-core accessibility audit', async ({ page }) => {
    // Note: axe-core requires installation - this test expects failure initially
    // In practice: npm install @axe-core/playwright

    await page.goto('http://localhost:5173/');

    // Basic axe-core scan (commented out for initial failure)
    /*
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .exclude('.dev-only') // Exclude dev elements
      .analyze();

    // No violations for WCAG AA
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // No best practice violations
    const bestPracticeViolations = accessibilityScanResults.violations.filter(v => 
      v.tags.includes('best-practice')
    );
    expect(bestPracticeViolations).toHaveLength(0);

    // Specific checks for color contrast
    const contrastViolations = accessibilityScanResults.violations.filter(v => 
      v.id === 'color-contrast'
    );
    expect(contrastViolations).toHaveLength(0);

    // Check for missing labels
    const labelViolations = accessibilityScanResults.violations.filter(v => 
      v.id.includes('label') || v.id.includes('aria')
    );
    expect(labelViolations).toHaveLength(0);
    */

    // Manual accessibility checks as fallback
    const missingAltTexts = await page.locator('img:not([alt]), [role="img"]:not([aria-label])').count();
    expect(missingAltTexts).toBe(0);

    const unlabeledButtons = await page.locator('button:not([aria-label]):not(:has-text)').count();
    expect(unlabeledButtons).toBe(0);

    const missingRoles = await page.locator('[tabindex="0"]:not([role])').count();
    expect(missingRoles).toBe(0);

    // Keyboard navigation test
    let tabCount = 0;
    while (await page.locator(':focusable').nth(tabCount).isVisible()) {
      await page.keyboard.press('Tab');
      tabCount++;
    }
    expect(tabCount).toBeGreaterThan(0); // At least one focusable element

    // Expect failure: accessibility violations present in current implementation
  });

  test('should support high contrast mode and reduced motion', async ({ page, context }) => {
    // Test high contrast mode
    await context.setExtraHTTPHeaders({
      'Prefers-Contrast': 'high'
    });
    await page.reload();

    // High contrast should enhance theme colors
    const highContrastBody = await page.locator('body').evaluate(el => getComputedStyle(el));
    const highContrastBg = highContrastBody.getPropertyValue('--primary-bg');
    expect(highContrastBg).toMatch(/#000|dark/i); // Stronger contrast background

    const highContrastText = highContrastBody.getPropertyValue('--text-primary');
    expect(highContrastText).toMatch(/#fff|light/i); // Stronger text contrast

    // Test reduced motion
    await context.setExtraHTTPHeaders({
      'Prefers-Reduced-Motion': 'reduce'
    });
    await page.reload();

    // Animations should be disabled
    const reducedMotionElements = await page.locator('*').filter({
      has: page.locator('[style*="animation"], [style*="transition"]')
    }).all();

    for (const element of reducedMotionElements) {
      const style = await element.evaluate(el => getComputedStyle(el));
      expect(style.animation).toBe('none');
      expect(style.transition).toBe('none');
    }

    // Connection glow effects should be static
    const connections = page.locator('.connection');
    const connectionStyles = await connections.evaluateAll(els => 
      els.map(el => getComputedStyle(el).animation)
    );
    connectionStyles.forEach(animation => {
      expect(animation).toBe('none');
    });

    // Expect failure: may not respect reduced motion or high contrast preferences
  });

  test('should have proper focus management and keyboard navigation', async ({ page }) => {
    // Test tab order
    const focusableElements = page.locator(':focusable');
    const focusableCount = await focusableElements.count();
    expect(focusableCount).toBeGreaterThan(0);

    // Test logical tab order (no skips)
    let previousBoundingBox = null;
    for (let i = 0; i < focusableCount; i++) {
      const element = focusableElements.nth(i);
      await element.focus();
      
      const currentBoundingBox = await element.boundingBox();
      if (previousBoundingBox && currentBoundingBox) {
        // Elements should generally flow left-to-right, top-to-bottom
        if (currentBoundingBox.y < previousBoundingBox.y - 50) {
          // Large vertical jump - might be acceptable for major sections
          const sectionRole = await element.getAttribute('role');
          expect(['navigation', 'main', 'complementary']).toContain(sectionRole);
        }
      }
      previousBoundingBox = currentBoundingBox;
    }

    // Test focus indicators are visible
    const firstFocusable = focusableElements.first();
    await firstFocusable.focus();
    const focusStyle = await firstFocusable.evaluate(el => getComputedStyle(el));
    const outline = focusStyle.outline || focusStyle.boxShadow;
    expect(outline).not.toBe('none');
    expect(outline).toHaveLengthGreaterThan(0); // Visible focus indicator

    // Test skip links
    const skipLink = page.locator('a[href="#main"], [href="#content"]');
    if (await skipLink.count() > 0) {
      await skipLink.first().focus();
      expect(await skipLink.isVisible()).toBe(true); // Skip link visible when focused
    }

    // Test ARIA modal/popup focus management (if applicable)
    const modalElements = page.locator('[role="dialog"], [aria-modal="true"]');
    if (await modalElements.count() > 0) {
      await modalElements.first().focus();
      const modal = modalElements.first();
      await modal.focus();
      const activeElement = await page.evaluate(() => document.activeElement);
      expect(activeElement).toBe(modal); // Focus trapped in modal
    }

    // Expect failure: focus management likely incomplete
  });
});