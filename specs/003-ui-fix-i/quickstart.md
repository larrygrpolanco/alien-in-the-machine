# Phase 1: Quickstart Validation

## Test Scenarios
These scenarios validate the UI fix requirements. Run with Playwright for E2E or Vitest for unit. All must pass before implementation.

### Scenario 1: Mobile Layout (FR-001, FR-003)
**Given**: App loaded on mobile viewport (width: 375px, height: 667px, iPhone SE emulation).  
**When**: User views main page (+page.svelte).  
**Then**: 
- No horizontal scroll: `expect(page).toHaveNoHorizontalScroll()`.
- Elements stacked vertically: Map height ≤50vh, message stream below without overlap.
- Touch targets ≥44px: Assert button padding/margins.
- Theme applied: bg #0a0a0a, accents #00f5ff/#8b00ff.

**Expected Fail State (Pre-Implementation)**: Overflow detected, map at top-left.

### Scenario 2: Desktop Adaptation (FR-001, FR-002)
**Given**: App loaded on desktop (width: 1920px).  
**When**: User resizes window to tablet (800px).  
**Then**:
- Layout shifts: Grid from 1-col (mobile) to 2-col (tablet).
- Map centered: position x=50%, no top-left clustering.
- Connections visible: Glowing lines between map and status (box-shadow active).

**Expected Fail State**: Fixed positioning causes misalignment on resize.

### Scenario 3: Map Positioning & Connections (FR-002, FR-004)
**Given**: MapView rendered with active connection to message stream.  
**When**: User interacts (e.g., simulate event).  
**Then**:
- Map size: width=100%, height=50vh, margin auto.
- Connection indicator: Pseudo-element line with glow (opacity=1, animation running).
- Clarity: ARIA label "Map connected to message stream" present.

**Expected Fail State**: No visual link, map offset to top-left.

### Scenario 4: Theme & Accessibility (NFR-002)
**Given**: App in dark mode.  
**When**: Screen reader (e.g., VoiceOver) scans UI.  
**Then**:
- Contrast ratio ≥4.5:1 for text vs. bg.
- ARIA roles: Map has role="img", connections labeled.
- Responsive font sizes: ≥16px base on mobile.

**Expected Fail State**: Low contrast or missing labels.

### Scenario 5: Performance (NFR-001)
**Given**: Mobile 4G emulation.  
**When**: Page loads.  
**Then**: First Contentful Paint ≤2s; no layout shifts >100px.

**Expected Fail State**: Slow render due to unoptimized CSS/images.

## Running Quickstart
1. **Unit Tests**: `npm run test:unit -- --grep "responsive-layout"`.
2. **E2E Tests**: `npx playwright test --project=chrome --viewport-size="375,667"`.
3. **Manual**: Resize browser, check devtools responsive mode.
4. **Coverage**: Ensure ≥80% for updated components.

All scenarios must fail initially (no implementation) to enforce TDD.

## Development Notes
- **Custom CSS**: All styling uses custom CSS utilities and media queries. No external frameworks (Tailwind) are used. Global CSS variables defined in +layout.svelte for theme consistency.
- **Mock LLM Mode**: For UI development and testing without external APIs, set `MOCK_LLM=true` in .env. This enables static mock responses from src/lib/mocks/llm-mocks.json, allowing component testing (Map.svelte, AgentStatus.svelte) with predefined event sequences.

---
*Quickstart completed: 2025-09-26*