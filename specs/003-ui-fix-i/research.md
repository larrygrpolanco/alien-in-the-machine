# Phase 0: Research for UI Fix

## Research Tasks & Findings

### 1. Responsive Design Best Practices for SvelteKit
**Unknown**: Optimal approach for mobile-first responsive UI in Svelte.

**Decision**: Use custom CSS utilities with media queries for breakpoints: Mobile (<640px), Tablet (640-1024px), Desktop (>1024px). Implement CSS Grid/Flexbox for layout in +layout.svelte.

**Rationale**: Custom CSS utilities provide responsive classes (e.g., .grid-cols-1, .md\:grid-cols-2), reducing boilerplate while maintaining control. Svelte's scoped styles integrate seamlessly. Ensures no horizontal scroll, touch-friendly spacing (min 44px targets).

**Alternatives Considered**:
- Pure CSS: More boilerplate, harder to maintain.
- Bootstrap: Heavier bundle, less customizable for sci-fi theme.
- Skeleton UI: Overkill for targeted fixes.

### 2. Fixing Map Component Positioning
**Unknown**: How to center/reposition Map.svelte avoiding top-left clustering.

**Decision**: Update Map.svelte with CSS: `position: relative; width: 100%; height: 50vh; display: block; margin: 0 auto;` for centering. Use viewport units (vh/vw) for responsive sizing. In parent layout, apply `justify-center items-center` with Flexbox.

**Rationale**: Current issue likely due to absolute positioning or fixed widths. Responsive units ensure map scales with screen. Integrates with Svelte stores for dynamic updates without layout shifts.

**Alternatives Considered**:
- JavaScript resizing: Unnecessary overhead; CSS handles viewport changes.
- Library (e.g., Leaflet): Overkill for simple alien map; stick to SVG/canvas if existing.

### 3. Visual Connection Indicators
**Unknown**: Implementing clear, glowing connection visuals in dark sci-fi theme.

**Decision**: Use CSS pseudo-elements (::before/::after) for glowing lines between elements (e.g., map to message stream). Apply `box-shadow` with blue/purple gradients (e.g., `box-shadow: 0 0 10px #00f5ff;`). Animate with `@keyframes` for pulsing effect on active connections.

**Rationale**: Pure CSS for performance; no JS needed for static indicators. Matches theme: cosmic blues (#00f5ff to #8b00ff), high contrast on dark bg (#0a0a0a). Accessibility: ARIA labels for screen readers.

**Alternatives Considered**:
- SVG paths: More flexible for complex connections but heavier for simple lines.
- Canvas: Better for dynamic but unnecessary here; increases complexity.

### 4. Theme Integration (Dark Sci-Fi)
**Unknown**: Ensuring cosmic blues/purples with glowing effects across UI.

**Decision**: Define global CSS variables in +layout.svelte: `--primary-bg: #0a0a0a; --accent-blue: #00f5ff; --accent-purple: #8b00ff; --glow: 0 0 20px var(--accent-blue);`. Apply to components via custom CSS classes or inline styles.

**Rationale**: Variables allow theme consistency. Glowing effects via `filter: drop-shadow` or box-shadow enhance alien/machine aesthetic without impacting performance.

**Alternatives Considered**:
- CSS-in-JS (e.g., styled-components): Not native to Svelte, adds bundle size.
- Pre-built theme (e.g., shadcn): Customization overhead for specific colors.

### 5. Testing Responsive UI
**Unknown**: Best practices for testing layout responsiveness.

**Decision**: Use Vitest with jsdom for unit tests on component snapshots at different viewports. Playwright for E2E: emulate devices (iPhone, iPad, Desktop) and assert no overflow (`expect(page).not.toHaveSelector('body', { hasOverflow: 'hidden' })`).

**Rationale**: jsdom sufficient for CSS layout checks; Playwright handles real rendering/orientation changes. Aligns with existing test suite.

**Alternatives Considered**:
- Cypress: Similar to Playwright but slower for mobile emulation.
- Manual: Insufficient for regression; automate for TDD.

## Consolidated Decisions
- **Layout Framework**: Custom CSS utilities + CSS Grid/Flexbox.
- **Map Fix**: Responsive CSS positioning with viewport units.
- **Connections**: CSS pseudo-elements with glowing shadows.
- **Theme**: CSS variables for dark sci-fi palette.
- **Testing**: Vitest snapshots + Playwright device emulation.

All unknowns resolved. Ready for Phase 1 design.

---
*Research completed: 2025-09-26*