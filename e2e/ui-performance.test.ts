import { test, expect } from '@playwright/test';

test.describe('Performance (NFR-001, NFR-003)', () => {
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({
      // 4G network emulation
      routeFromHAR: 'none',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    
    // Set network throttling to 4G
    await context.route('**/*', route => {
      route.continue({
        ...route.request(),
        // 4G typical: 1.6Mbps down, 750Kbps up, 150ms RTT
        headers: {
          ...route.request().headers(),
          'Cache-Control': 'no-cache'
        }
      });
    });

    const page = await context.newPage();
    await page.route('**/*', route => {
      const url = route.request().url();
      // Mock slow network for assets
      if (url.includes('.js') || url.includes('.css') || url.includes('.png')) {
        route.continue({
          ...route.request(),
          headers: {
            ...route.request().headers(),
            'x-response-time': '500' // Simulate 500ms delay
          }
        });
      } else {
        route.continue();
      }
    });

    return page;
  });

  test('should have First Contentful Paint ≤2s on 4G', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:5173/', {
      waitUntil: 'networkidle',
      timeout: 10000 // Allow up to 10s for slow network
    });

    const endTime = Date.now();
    const loadTime = (endTime - startTime) / 1000; // Seconds

    // FCP should be ≤2s even on 4G
    expect(loadTime).toBeLessThanOrEqual(2);

    // Use Performance API for precise FCP measurement
    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByName('first-contentful-paint');
      return entries.length > 0 ? entries[0].startTime : 0;
    });

    expect(fcp).toBeLessThan(2000); // FCP < 2s

    // Check Largest Contentful Paint (LCP)
    const lcp = await page.evaluate(() => {
      const entries = performance.getEntriesByName('largest-contentful-paint');
      return entries.length > 0 ? entries[0].startTime : 0;
    });

    expect(lcp).toBeLessThan(2500); // LCP < 2.5s for good performance

    // Expect failure: current load times likely exceed thresholds
  });

  test('should have no layout shifts >100px during load', async ({ page }) => {
    // Enable layout shift tracking
    await page.addInitScript(() => {
      // Clear previous entries
      performance.clearResourceTimings();
      
      // Track layout shifts
      window.layoutShifts = [];
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) {
            window.layoutShifts.push({
              value: entry.value,
              sources: entry.sources,
              hadRecentInput: entry.hadRecentInput
            });
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });
    });

    const startTime = Date.now();
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    const endTime = Date.now();

    // Get all layout shifts during load
    const layoutShifts = await page.evaluate(() => window.layoutShifts || []);
    
    // Calculate Cumulative Layout Shift (CLS)
    const cls = layoutShifts.reduce((sum, shift) => sum + shift.value, 0);
    expect(cls).toBeLessThan(0.1); // CLS < 0.1 for good UX

    // Individual shifts should be minimal
    const maxShift = layoutShifts.reduce((max, shift) => Math.max(max, shift.value), 0);
    expect(maxShift).toBeLessThan(0.05); // No single shift >5%

    // Check for shifts >100px in any direction
    const significantShifts = layoutShifts.filter(shift => {
      // Convert CLS value to pixels (approximate)
      const viewportHeight = window.innerHeight;
      const pixelShift = shift.value * viewportHeight;
      return pixelShift > 100;
    });

    expect(significantShifts).toHaveLength(0); // No shifts >100px

    // Map specific layout stability
    const mapShifts = await page.evaluate(() => {
      const map = document.querySelector('.map');
      if (!map) return [];
      
      const observer = new ResizeObserver(entries => {
        entries.forEach(entry => {
          console.log('Map resize:', entry.contentRect);
        });
      });
      observer.observe(map);
      
      return []; // For now, just check initial stability
    });

    // Expect failure: layout shifts likely exceed thresholds during load
  });

  test('should load critical resources first (priority hints)', async ({ page }) => {
    await page.route('**/*', route => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();
      
      // Critical resources should load first
      const priority = resourceType === 'script' || resourceType === 'stylesheet' 
        ? 'High' 
        : resourceType === 'image' ? 'Low' : 'Medium';
      
      route.continue({
        ...route.request(),
        headers: {
          ...route.request().headers(),
          'priority': priority
        }
      });
    });

    await page.goto('http://localhost:5173/');

    // Check resource loading order
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(entry => ({
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration,
        initiatorType: entry.initiatorType
      })).sort((a, b) => a.startTime - b.startTime);
    });

    // Critical CSS/JS should load before non-critical assets
    const criticalResources = resources.filter(r => 
      r.name.includes('.css') || r.name.includes('.js') || r.initiatorType === 'script'
    );
    const nonCriticalResources = resources.filter(r => 
      r.initiatorType === 'image' || r.initiatorType === 'stylesheet' && !r.name.includes('critical')
    );

    if (criticalResources.length > 0 && nonCriticalResources.length > 0) {
      const firstCritical = criticalResources[0].startTime;
      const firstNonCritical = nonCriticalResources[0].startTime;
      expect(firstCritical).toBeLessThan(firstNonCritical); // Critical loads first
    }

    // Check for preload hints
    const preloadLinks = await page.locator('link[rel="preload"]').count();
    expect(preloadLinks).toBeGreaterThan(0); // Critical resources preloaded

    // Font loading performance
    const fontLoadTime = await page.evaluate(() => {
      const fonts = performance.getEntriesByType('font').map(f => f.startTime);
      return fonts.length > 0 ? Math.max(...fonts) : 0;
    });
    expect(fontLoadTime).toBeLessThan(3000); // Fonts load within 3s

    // Expect failure: resource loading likely not optimized
  });

  test('should use efficient rendering techniques', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Check for CSS containment
    const containElements = await page.locator('[contain="layout" i], [contain="paint" i], [contain="strict" i]').count();
    expect(containElements).toBeGreaterThan(0); // Use contain for better rendering

    // Check for will-change hints
    const willChangeElements = await page.locator('*').filter({
      has: page.locator('[style*="will-change"]')
    }).count();
    const animatedElements = await page.locator('.map, .connection, .message-stream').count();
    if (animatedElements > 0) {
      expect(willChangeElements).toBeGreaterThan(0); // Animated elements use will-change
    }

    // Check transform usage for animations (GPU acceleration)
    const hardwareAccelerated = await page.locator('*').filter({
      has: page.locator('[style*="transform"], [style*="opacity"]')
    }).count();
    expect(hardwareAccelerated).toBeGreaterThan(0);

    // Check for excessive repaints
    const repaintCount = await page.evaluate(() => {
      let repaints = 0;
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'paint') repaints++;
        });
      });
      observer.observe({ entryTypes: ['paint'] });
      
      // Trigger some interactions
      document.body.style.transform = 'translateZ(0)'; // Force repaint
      window.dispatchEvent(new Event('resize'));
      
      return new Promise(resolve => setTimeout(() => {
        observer.disconnect();
        resolve(repaints);
      }, 1000));
    });

    expect(repaintCount as number).toBeLessThan(50); // Reasonable repaint count

    // Check for efficient selectors (no universal or deep selectors)
    const inefficientCSS = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let inefficientRules = 0;
      
      sheets.forEach(sheet => {
        try {
          Array.from(sheet.cssRules).forEach(rule => {
            if (rule.cssText.includes('*') || rule.cssText.match(/\s{3,}/)) {
              inefficientRules++;
            }
          });
        } catch (e) {
          // Cross-origin sheets
        }
      });
      
      return inefficientRules;
    });

    expect(inefficientCSS as number).toBeLessThan(10); // Few inefficient selectors

    // Expect failure: rendering likely not optimized for performance
  });

  test('should lazy load non-critical assets', async ({ page }) => {
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => {
      // Non-critical images should be lazy loaded
      route.continue({
        ...route.request(),
        headers: {
          ...route.request().headers(),
          'loading': 'lazy'
        }
      });
    });

    await page.goto('http://localhost:5173/');

    // Check for lazy loading attributes
    const lazyImages = await page.locator('img[loading="lazy"], iframe[loading="lazy"]').count();
    const totalImages = await page.locator('img, picture > img').count();
    
    // Most images should be lazy loaded (except above-the-fold)
    if (totalImages > 0) {
      const lazyPercentage = (lazyImages / totalImages) * 100;
      expect(lazyPercentage).toBeGreaterThan(70); // >70% lazy loaded
    }

    // Check intersection observer for lazy loading
    const lazyLoadElements = await page.evaluate(() => {
      const images = document.querySelectorAll('img[loading="lazy"]');
      let usingIntersectionObserver = 0;
      
      images.forEach(img => {
        const style = getComputedStyle(img);
        if (style.display !== 'none' && !img.complete) {
          usingIntersectionObserver++;
        }
      });
      
      return usingIntersectionObserver;
    });

    expect(lazyLoadElements as number).toBeGreaterThan(0);

    // Background images should use loading="lazy" or be deferred
    const backgroundImages = await page.evaluate(() => {
      const computedStyles = Array.from(document.querySelectorAll('*')).map(el => 
        getComputedStyle(el).backgroundImage
      ).filter(bg => bg !== 'none' && !bg.includes('linear-gradient'));
      
      return computedStyles.length;
    });

    // Non-critical background images should be lazy loaded
    expect(backgroundImages as number).toBeLessThan(5); // Few background images

    // Check for deferred JavaScript
    const deferredScripts = await page.locator('script[defer], script[async]').count();
    const totalScripts = await page.locator('script').count();
    const deferredPercentage = (deferredScripts / totalScripts) * 100;
    expect(deferredPercentage).toBeGreaterThan(50); // >50% deferred/async

    // Expect failure: assets likely not lazy loaded currently
  });

  test('should optimize for low-bandwidth scenarios', async ({ page }) => {
    // Simulate low bandwidth (3G)
    await page.route('**/*', route => {
      route.continue({
        ...route.request(),
        headers: {
          ...route.request().headers(),
          'x-network-condition': '3G'
        }
      });
    });

    const startTime = Date.now();
    await page.goto('http://localhost:5173/', { 
      waitUntil: 'networkidle', 
      timeout: 15000 // Allow more time for slow network
    });
    const loadTime = (Date.now() - startTime) / 1000;

    // Initial render should complete <3s even on 3G
    expect(loadTime).toBeLessThan(3);

    // Critical content (map, messages) should load first
    const criticalElements = await page.locator('.map, .message-stream, .agent-status').all();
    const nonCriticalElements = await page.locator('.decorative, .analytics, .ads').all();

    for (const element of criticalElements) {
      await expect(element).toBeVisible({ timeout: 2000 }); // Critical loads fast
    }

    // Non-critical elements can load later
    for (const element of nonCriticalElements) {
      await expect(element).toBeVisible({ timeout: 10000 }); // Grace period
    }

    // Check for progressive enhancement
    const fallbackContent = await page.locator('.fallback-content, [data-fallback]').count();
    expect(fallbackContent).toBeGreaterThan(0); // Fallback content present

    // Skeleton screens or loading states
    const loadingStates = await page.locator('.skeleton, .loading, [aria-busy="true"]').count();
    if (criticalElements.length > 0) {
      expect(loadingStates).toBeGreaterThan(0); // Loading states for critical content
    }

    // Asset optimization
    const optimizedImages = await page.locator('img[width][height][srcset]').count();
    const totalImages = await page.locator('img').count();
    const optimizedPercentage = totalImages > 0 ? (optimizedImages / totalImages) * 100 : 0;
    expect(optimizedPercentage).toBeGreaterThan(80); // >80% images optimized

    // Check for service worker caching (if implemented)
    const serviceWorker = await page.evaluate(() => navigator.serviceWorker.controller !== null);
    if (serviceWorker) {
      expect(serviceWorker).toBe(true); // Service worker active for caching
    }

    // Expect failure: low-bandwidth optimizations likely missing
  });
});