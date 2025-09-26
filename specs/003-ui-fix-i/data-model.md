# Phase 1: Data Model for UI Fix

## Entities

### 1. LayoutState
**Description**: Manages the overall UI arrangement and responsive behavior for the Alien in the Machine app.

**Attributes**:
- `breakpoint`: string - Current screen size category ('mobile' | 'tablet' | 'desktop'). Default: 'mobile'.
- `orientation`: string - Device orientation ('portrait' | 'landscape'). Default: 'portrait'.
- `isOverflowing`: boolean - Whether layout exceeds viewport boundaries. Default: false.
- `theme`: object - { bg: string, accentBlue: string, accentPurple: string, glow: string } for dark sci-fi styling.

**Relationships**:
- Has-many: UI Components (e.g., MapView, MessageStream).
- Influences: Positioning and sizing of child elements via CSS classes.

**Validation Rules**:
- breakpoint must match media query thresholds: mobile <640px, tablet 640-1024px, desktop >1024px.
- theme colors must ensure WCAG AA contrast ratio ≥4.5:1 against bg.
- isOverflowing triggers layout adjustment (e.g., stack elements vertically on mobile).

**State Transitions**:
- On resize/orientation change → Update breakpoint/orientation → Recalculate isOverflowing → Apply responsive classes.

### 2. MapView
**Description**: Visual representation of the alien/machine map, displaying zones, connections, and interactive states.

**Attributes**:
- `position`: object - { x: number, y: number, centered: boolean } for map placement. Default: { x: 50, y: 50, centered: true } (% viewport).
- `connections`: array - List of active links to other elements (e.g., [{ target: 'messageStream', active: boolean, glow: boolean }]).
- `size`: object - { width: string, height: string } using viewport units (e.g., '100vw', '50vh'). Default: { width: '100%', height: '50vh' }.
- `interactive`: boolean - Whether map responds to touch/click. Default: true.

**Relationships**:
- Belongs-to: LayoutState (inherits responsive sizing).
- Has-many: Connections (links to UI elements like status indicators).

**Validation Rules**:
- position.centered must prevent top-left clustering (x/y ≥20% viewport if not centered).
- connections must have visual indicators (glow: true for active).
- size must adapt: height ≤60vh on mobile to avoid overflow.

**State Transitions**:
- On connection change → Update connections array → Apply glowing CSS (e.g., box-shadow).
- On layout update → Scale size/position responsively → Re-render SVG/canvas elements.

## Relationships Overview
- LayoutState orchestrates MapView and other components.
- MapView's connections link to external states (e.g., eventStore for dynamic updates).
- No new database entities; leverages existing Svelte stores (worldStore, eventStore).

## Design Notes
- Immutable updates via Svelte stores for reactivity.
- Accessibility: ARIA roles for map regions (role="img" or "application"), labels for connections.
- Derived from spec entities; focuses on UI state without backend data.

---
*Data model completed: 2025-09-26*