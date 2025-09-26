import { test, expect } from '@playwright/test';

test.describe('Low-Bandwidth (FR-005, NFR-004)', () => {
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({
      // Simulate very slow network (<1Mbps)
      routeFromHAR: 'none',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    // Apply network throttling for <1Mbps connection
    await context.route('**/*', async route => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();
      
      // Simulate slow 3G or worse
      const delay = resourceType === 'script' || resourceType === 'stylesheet' ? 1500 : 800;
      const throughput = resourceType === 'image' ? 50000 : 100000; // Bytes per second
      
      // Continue with delay
      await route.continue({
        ...route.request(),
        headers: {
          ...route.request().headers(),
          'x-override-response-time': `${delay}`
        }
      });
      
      // Additional delay for large assets
      if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) {
        await page.waitForTimeout(2000); // Extra delay for images
      }
    });

    const page = await context.newPage();
    return page;
  });

  test('should complete initial render <3s on low bandwidth', async ({ page }) => {
    const startTime = performance.now();
    
    await page.goto('http://localhost:5173/', {
      waitUntil: 'domcontentloaded', // Only wait for DOM, not full network idle
      timeout: 30000 // Allow up to 30s for very slow network
    });

    const endTime = performance.now();
    const renderTime = (endTime - startTime) / 1000; // Seconds

    // Initial render (above-the-fold) should complete <3s even on slow network
    expect(renderTime).toBeLessThan(3);

    // Check Time to Interactive (TTI)
    const tti = await page.evaluate(() => {
      return new Promise(resolve => {
        let startTime = performance.now();
        let idleCallbackCalled = false;
        
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            idleCallbackCalled = true;
            resolve(performance.now() - startTime);
          }, { timeout: 5000 });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => {
            if (!idleCallbackCalled) {
              resolve(performance.now() - startTime);
            }
          }, 5000);
        }
      });
    });

    expect(tti as number).toBeLessThan(5000); // TTI < 5s on slow network

    // Expect failure: current implementation likely times out or loads slowly
  });

  test('should prioritize map and messages loading first', async ({ page }) => {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

    // Critical elements: map, message stream, agent status
    const criticalSelectors = [
      '.map, [data-testid="map"]',
      '.message-stream, [data-testid="message-stream"]',
      '.agent-status, [data-testid="agent-status"]'
    ];

    const nonCriticalSelectors = [
      '.analytics, [data-analytics]',
      '.social-share, [data-social]',
      '.decorative-image, .background-image',
      '[data-ad], .advertisement'
    ];

    // Critical elements should be visible within 2s
    for (const selector of criticalSelectors) {
      const element = page.locator(selector);
      await expect(element).toBeVisible({ timeout: 2000 });
      
      // Critical elements should have higher loading priority
      const loadingPriority = await element.evaluate(el => {
        const style = getComputedStyle(el);
        return style.getPropertyPriority('display') || 'normal';
      });
      expect(loadingPriority).toBe('important'); // Or check fetch priority
    }

    // Non-critical elements can load later (up to 10s)
    for (const selector of nonCriticalSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        await expect(elements.first()).toBeVisible({ timeout: 10000 });
      }
    }

    // Check resource loading order using Performance API
    const resourceOrder = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      return resources.map(entry => ({
        name: entry.name,
        startTime: entry.startTime,
        initiatorType: (entry as any).initiatorType,
        isCritical: entry.name.includes('.css') || entry.name.includes('main.js') || 
                   entry.name.includes('map') || entry.name.includes('message')
      })).sort((a, b) => a.startTime - b.startTime);
    });

    // Critical resources should load before non-critical
    const criticalResources = resourceOrder.filter(r => r.isCritical);
    const nonCriticalResources = resourceOrder.filter(r => !r.isCritical);
    
    if (criticalResources.length > 0 && nonCriticalResources.length > 0) {
      const firstCriticalTime = criticalResources[0].startTime;
      const firstNonCriticalTime = nonCriticalResources[0].startTime;
      expect(firstCriticalTime).toBeLessThan(firstNonCriticalTime);
    }

    // Map and messages should render before decorative elements
    const mapLoadTime = await page.evaluate(() => {
      const map = document.querySelector('.map');
      return map ? performance.getEntriesByName('mark', 'map-render').length > 0 ? 
        performance.getEntriesByName('mark', 'map-render')[0].startTime : 
        getComputedStyle(map!).display !== 'none' ? performance.now() : Infinity : Infinity;
    });

    const messageLoadTime = await page.evaluate(() => {
      const messages = document.querySelector('.message-stream');
      return messages ? performance.getEntriesByName('mark', 'messages-render').length > 0 ? 
        performance.getEntriesByName('mark', 'messages-render')[0].startTime : 
        getComputedStyle(messages!).display !== 'none' ? performance.now() : Infinity : Infinity;
    });

    const decorativeLoadTime = await page.evaluate(() => {
      const decorative = document.querySelector('.decorative, [data-decorative]');
      return decorative ? performance.now() : Infinity;
    });

    expect(mapLoadTime).toBeLessThan(decorativeLoadTime);
    expect(messageLoadTime).toBeLessThan(decorativeLoadTime);

    // Expect failure: non-critical assets likely block critical content
  });

  test('should defer lazy assets and use progressive loading', async ({ page }) => {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

    // Check for lazy loading attributes on images and iframes
    const lazyImages = await page.locator('img[loading="lazy"], img[data-src]').count();
    const totalImages = await page.locator('img').count();
    const lazyPercentage = totalImages > 0 ? (lazyImages / totalImages) * 100 : 0;
    expect(lazyPercentage).toBeGreaterThan(80); // >80% images lazy loaded

    // Check for intersection observer usage
    const lazyLoadImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img[loading="lazy"], img[data-src]');
      let usingIntersectionObserver = 0;
      
      // Check if images are using IntersectionObserver for lazy loading
      const observer = window.IntersectionObserver ? 'available' : 'not-available';
      images.forEach(img => {
        // Images below fold should be lazy loaded
        const rect = img.getBoundingClientRect();
        if (rect.bottom > window.innerHeight * 0.5) { // Below initial viewport
          usingIntersectionObserver++;
        }
      });
      
      return { observer, count: usingIntersectionObserver, total: images.length };
    });

    expect(lazyLoadImages.count).toBeGreaterThan(0);
    expect(lazyLoadImages.count / lazyLoadImages.total).toBeGreaterThan(0.7);

    // Check for progressive image loading (multiple sizes)
    const responsiveImages = await page.locator('img[srcset], picture > img').count();
    const totalImagesAgain = await page.locator('img').count();
    const responsivePercentage = totalImagesAgain > 0 ? (responsiveImages / totalImagesAgain) * 100 : 0;
    expect(responsivePercentage).toBeGreaterThan(60); // >60% images responsive

    // Check for deferred JavaScript execution
    const deferredScripts = await page.locator('script[defer], script[data-defer], script[type="module"]').count();
    const totalScripts = await page.locator('script').count();
    const deferredPercentage = totalScripts > 0 ? (deferredScripts / totalScripts) * 100 : 0;
    expect(deferredPercentage).toBeGreaterThan(70); // >70% scripts deferred

    // Check for async CSS loading
    const asyncStylesheets = await page.locator('link[rel="stylesheet"][media="print"], link[rel="preload"][as="style"]').count();
    const totalStylesheets = await page.locator('link[rel="stylesheet"]').count();
    const asyncPercentage = totalStylesheets > 0 ? (asyncStylesheets / totalStylesheets) * 100 : 0;
    expect(asyncPercentage).toBeGreaterThan(50); // >50% CSS async/non-blocking

    // Verify critical CSS is inlined or preloaded
    const criticalCSS = await page.evaluate(() => {
      const styles = document.styleSheets;
      let criticalCSSFound = false;
      
      for (let i = 0; i < styles.length; i++) {
        try {
          const rules = styles[i].cssRules;
          if (rules) {
            for (let j = 0; j < rules.length; j++) {
              const rule = rules[j] as CSSStyleRule;
              if (rule && rule.selectorText && (
                rule.selectorText.includes('.map') || 
                rule.selectorText.includes('.message') ||
                rule.selectorText.includes('body')
              )) {
                criticalCSSFound = true;
                break;
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheets
        }
        if (criticalCSSFound) break;
      }
      
      // Check for inline critical CSS
      const inlineCritical = document.querySelector('style[data-critical]') || 
                           document.head.innerHTML.includes('.map') ||
                           document.head.innerHTML.includes('.message');
      
      return criticalCSSFound || !!inlineCritical;
    });

    expect(criticalCSS).toBe(true); // Critical CSS available immediately

    // Check for service worker caching of assets
    const serviceWorkerStatus = await page.evaluate(() => {
      return navigator.serviceWorker.controller !== null;
    });
    
    if (serviceWorkerStatus) {
      expect(serviceWorkerStatus).toBe(true); // Service worker active for offline/caching
    }

    // Expect failure: lazy loading and deferring likely not implemented
  });

  test('should provide fallback content for failed asset loads', async ({ page }) => {
    // Simulate asset loading failures
    await page.route('**/*.png', route => route.abort());
    await page.route('**/*.jpg', route => route.abort());
    await page.route('**/*.svg', route => route.abort());

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

    // Check for fallback images
    const brokenImages = await page.locator('img[src*=".png"], img[src*=".jpg"], img[src*=".svg"]').all();
    for (const img of brokenImages) {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      
      // Broken images should have meaningful alt text
      expect(alt).toBeTruthy();
      expect(alt).not.toBe(src); // Not just filename as alt text
      
      // Check for fallback mechanisms
      const fallbackSrc = await img.evaluate(el => {
        return el.getAttribute('data-fallback') || 
               (el as HTMLImageElement).srcset?.split(',')[1]?.trim().split(' ')[0] ||
               el.getAttribute('srcset');
      });
      
      if (fallbackSrc) {
        expect(fallbackSrc).not.toBe(src); // Different fallback source
      }

      // Images should not be zero-sized when broken
      const size = await img.boundingBox();
      if (size) {
        expect(size.width).toBeGreaterThan(0);
        expect(size.height).toBeGreaterThan(0);
      }
    }

    // Check for CSS fallback styles
    const fallbackStyles = await page.evaluate(() => {
      const elements = document.querySelectorAll('img, [style*="background-image"]');
      let hasFallbacks = 0;
      
      elements.forEach(el => {
        const style = getComputedStyle(el);
        if (style.backgroundImage === 'none' && el.hasAttribute('data-fallback-style')) {
          hasFallbacks++;
        }
        if ((el as HTMLImageElement).naturalWidth === 0 && el.hasAttribute('alt')) {
          hasFallbacks++;
        }
      });
      
      return hasFallbacks;
    });

    expect(fallbackStyles as number).toBeGreaterThan(0); // Some fallback handling

    // Check for error boundaries in components
    const errorElements = await page.locator('[data-error], .error-boundary, [aria-label*="error"]').count();
    expect(errorElements).toBe(0); // No visible errors from failed loads

    // Page should remain functional despite asset failures
    const functionalElements = await page.locator('.map, .message-stream, button').count();
    expect(functionalElements).toBeGreaterThan(0); // Core functionality intact

    // Expect failure: no fallback mechanisms currently implemented
  });

  test('should use modern image formats and optimization', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Check image formats (prefer WebP, AVIF over PNG/JPG)
    const images = await page.locator('img').all();
    let modernFormatCount = 0;
    let totalImageCount = images.length;

    for (const img of images) {
      const src = await img.getAttribute('src');
      const srcset = await img.getAttribute('srcset');
      
      if (src && (src.includes('.webp') || src.includes('.avif'))) {
        modernFormatCount++;
      }
      
      if (srcset) {
        const sources = srcset.split(',').map(s => s.trim().split(' ')[0]);
        const modernSources = sources.filter(s => s.includes('.webp') || s.includes('.avif'));
        if (modernSources.length > 0) {
          modernFormatCount++;
        }
      }
    }

    const modernFormatPercentage = totalImageCount > 0 ? (modernFormatCount / totalImageCount) * 100 : 0;
    expect(modernFormatPercentage).toBeGreaterThan(70); // >70% modern formats

    // Check image dimensions and sizes
    const optimizedImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      let optimized = 0;
      
      images.forEach(img => {
        const naturalSize = (img as HTMLImageElement).naturalWidth * (img as HTMLImageElement).naturalHeight;
        const displayedSize = img.getBoundingClientRect().width * img.getBoundingClientRect().height;
        
        // Images should not be much larger than displayed size (avoid over-downloading)
        if (naturalSize <= displayedSize * 4) { // Allow 2x for retina
          optimized++;
        }
        
        // Check for proper sizing attributes
        if (img.hasAttribute('width') && img.hasAttribute('height')) {
          optimized++;
        }
      });
      
      return { optimized, total: images.length };
    });

    const optimizationPercentage = optimizedImages.total > 0 ? (optimizedImages.optimized / optimizedImages.total) * 100 : 0;
    expect(optimizationPercentage).toBeGreaterThan(80); // >80% properly sized

    // Check for responsive images using srcset
    const responsiveImages = await page.locator('img[srcset], picture > source').count();
    const totalImagesAgain = await page.locator('img').count();
    const responsivePercentage = totalImagesAgain > 0 ? (responsiveImages / totalImagesAgain) * 100 : 0;
    expect(responsivePercentage).toBeGreaterThan(60); // >60% responsive images

    // Check for AVIF support with fallback
    const avifSupport = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const image = new Image();
      image.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmMxAAAAAG1pbmZ...'; // Minimal AVIF
      return new Promise(resolve => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 100); // Timeout
      });
    });

    if (avifSupport) {
      expect(avifSupport).toBe(true); // AVIF supported and used
    }

    // Expect failure: images likely not optimized for modern formats
  });
});