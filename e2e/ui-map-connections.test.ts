import { test, expect } from '@playwright/test';

test.describe('Map Positioning & Connections (FR-002, FR-003, FR-004)', () => {
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      colorScheme: 'dark'
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    return page;
  });

  test('should position map with ≤5% offset from center', async ({ page }) => {
    const mapElement = page.locator('src/lib/components/Map.svelte, .map, [data-testid="map"]');
    
    // Wait for map to render
    await mapElement.waitFor({ state: 'visible', timeout: 5000 });

    // Get map dimensions and position
    const mapRect = await mapElement.boundingBox();
    const viewportSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));

    if (mapRect) {
      // Calculate center of viewport
      const viewportCenterX = viewportSize.width / 2;
      const viewportCenterY = viewportSize.height / 2;

      // Calculate map center
      const mapCenterX = mapRect.x + mapRect.width / 2;
      const mapCenterY = mapRect.y + mapRect.height / 2;

      // Calculate offset percentages
      const offsetXPercent = Math.abs((mapCenterX - viewportCenterX) / viewportSize.width) * 100;
      const offsetYPercent = Math.abs((mapCenterY - viewportCenterY) / viewportSize.height) * 100;

      // Assert ≤5% offset from center
      expect(offsetXPercent).toBeLessThanOrEqual(5);
      expect(offsetYPercent).toBeLessThanOrEqual(5);

      // Assert map uses responsive sizing (100% width, 50vh height)
      const mapStyle = await mapElement.evaluate(el => getComputedStyle(el));
      expect(mapStyle.width).toBe('100%');
      expect(mapStyle.height).toContain('50vh');
      expect(mapStyle.position).toBe('relative'); // Or absolute with centering
      expect(mapStyle.margin).toContain('auto'); // Auto margins for centering
      // Or check for transform: translate(-50%, -50%)
      expect(mapStyle.transform).toContain('translate(-50%, -50%)');

      // Expect failure: current map likely at top-left (0,0) position
    }
  });

  test('should display glowing connection indicators with animation', async ({ page }) => {
    // Wait for connections to render (may need active state)
    await page.waitForTimeout(1000); // Allow any animations/connections to initialize

    const connectionElements = page.locator('.connection, line[data-connection], path[data-connection], [aria-label*="connection"]');
    const connectionCount = await connectionElements.count();

    expect(connectionCount).toBeGreaterThan(0); // At least one connection visible

    for (let i = 0; i < connectionCount; i++) {
      const connection = connectionElements.nth(i);
      await expect(connection).toBeVisible();

      // Assert connection styling
      const style = await connection.evaluate(el => getComputedStyle(el));
      
      // Opacity should be 1 for visible connections
      expect(parseFloat(style.opacity)).toBe(1);

      // Glowing effect via box-shadow or filter
      expect(style.boxShadow).toContain('#00f5ff'); // Blue glow
      // Or check for animation
      expect(style.animation).toContain('pulse'); // Or 'glow'
      expect(style.animationDuration).toContain('s'); // Animated

      // Connection should have proper thickness (2-5px)
      expect(parseFloat(style.strokeWidth || style.width || '2')).toBeGreaterThan(1);
      expect(parseFloat(style.strokeWidth || style.width || '2')).toBeLessThan(10);

      // Line color should be theme accent
      expect(style.stroke || style.color || style.backgroundColor).toContain('00f5ff'); // Blue
    }

    // Simulate interaction to trigger connection updates
    const mapElement = page.locator('.map');
    await mapElement.click({ position: { x: 100, y: 100 } });

    // Wait for connection state change
    await page.waitForTimeout(500);

    // Re-assert connections are active/glowing after interaction
    const activeConnections = await page.locator('.connection.active, [data-connection="active"]').count();
    expect(activeConnections).toBeGreaterThan(0);

    // Expect failure: no glowing connections or animations currently implemented
  });

  test('should have ARIA labels on map and connections', async ({ page }) => {
    // Map ARIA
    const mapElement = page.locator('.map, [data-testid="map"]');
    await expect(mapElement).toHaveAttribute('role', 'img'); // Or 'application'
    await expect(mapElement).toHaveAttribute('aria-label', /map|alien|machine/i);
    await expect(mapElement).toHaveAttribute('aria-describedby', /description/i); // Descriptive region

    // Connection ARIA
    const connectionElements = page.locator('[aria-label*="connection"], [aria-label*="link"]');
    const connectionCount = await connectionElements.count();

    for (let i = 0; i < connectionCount; i++) {
      const connection = connectionElements.nth(i);
      const ariaLabel = await connection.getAttribute('aria-label');
      
      // Each connection should have descriptive label
      expect(ariaLabel).toContain('connection');
      expect(ariaLabel).toContain('map');
      expect(ariaLabel).toContain('message'); // Or status
      expect(ariaLabel).toMatch(/active|inactive/i); // State indication

      // Role for connections
      const role = await connection.getAttribute('role');
      expect(['link', 'status', 'separator']).toContain(role);
    }

    // Test screen reader flow
    const accessibleName = await page.evaluate(() => {
      const map = document.querySelector('.map');
      return map ? map.getAttribute('aria-label') : '';
    });
    expect(accessibleName).toBeTruthy();
    expect(accessibleName).toContain('map connected to');

    // Expect failure: missing ARIA labels and roles currently
  });

  test('should respond to map interactions with connection updates', async ({ page }) => {
    // Initial state
    const initialConnections = await page.locator('.connection').count();
    
    // Click on map to simulate interaction
    const mapElement = page.locator('.map');
    const mapBox = await mapElement.boundingBox();
    
    if (mapBox) {
      // Click center of map
      await mapElement.click({
        position: { 
          x: mapBox.width / 2, 
          y: mapBox.height / 2 
        }
      });

      // Wait for connection update
      await page.waitForTimeout(1000);

      // Assert connection state changed (more active connections)
      const updatedConnections = await page.locator('.connection.active, [data-active="true"]').count();
      expect(updatedConnections).toBeGreaterThan(initialConnections);

      // Check for visual feedback (glow animation triggered)
      const activeConnection = page.locator('.connection.active');
      const animationStyle = await activeConnection.evaluate(el => getComputedStyle(el).animation);
      expect(animationStyle).toContain('glow'); // Or pulse

      // Assert event emitted (check for data attributes or custom events)
      const connectionUpdateEvent = await page.evaluate(() => {
        return new Promise(resolve => {
          window.addEventListener('connectionUpdate', (e: CustomEvent) => {
            resolve(e.detail);
          }, { once: true });
          
          // Trigger if needed
          window.dispatchEvent(new CustomEvent('mapInteraction', { 
            detail: { x: 100, y: 100 } 
          }));
        });
      });

      if (connectionUpdateEvent) {
        expect(connectionUpdateEvent).toHaveProperty('connections');
        expect(Array.isArray((connectionUpdateEvent as any).connections)).toBe(true);
      }

      // Expect failure: no interaction handling or connection updates currently
    }
  });

  test('should maintain map size constraints across viewports', async ({ page }) => {
    const testViewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 800, height: 600 },   // Tablet
      { width: 375, height: 667 }    // Mobile
    ];

    for (const viewport of testViewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      const mapElement = page.locator('.map');
      const mapStyle = await mapElement.evaluate(el => getComputedStyle(el));

      // Width should always be 100%
      expect(mapStyle.width).toBe('100%');

      // Height constraints:
      if (viewport.width <= 640) {
        // Mobile: ≤60vh to avoid overflow
        expect(parseFloat(mapStyle.height)).toBeLessThanOrEqual(60);
        expect(mapStyle.height).toContain('vh');
      } else {
        // Desktop/Tablet: 50vh
        expect(mapStyle.height).toContain('50vh');
      }

      // Min dimensions for usability
      const minDimension = await mapElement.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return Math.min(rect.width, rect.height);
      });
      expect(minDimension).toBeGreaterThan(200); // Minimum usable size
    }

    // Expect failure: map sizing likely fixed or incorrect currently
  });
});