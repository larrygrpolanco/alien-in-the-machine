# Tasks for Feature: 003-ui-fix-i

**Feature Description**: UI Fix for Alien in the Machine - Make the UI responsive and mobile-first, fix map positioning to avoid top-left clustering, and add clear visual connection indicators with dark sci-fi theme (cosmic blues/purples, glowing effects). Based on spec.md, data-model.md, contracts/, quickstart.md, research.md, and plan.md.

**Tech Stack**: SvelteKit, TypeScript, Custom CSS, Vitest/Playwright for TDD.

**Execution Notes**:
- Follow TDD: Write failing tests first, then implement to pass.
- Parallel [P] tasks can run concurrently (independent files).
- Dependencies noted; run in order.
- Total Tasks: 21 | Estimated Effort: 4-6 hours.
- After all tasks: Run `npm run test:unit`, `npx playwright test`, check coverage ≥80%.

## Initial Test Tasks [P] (Parallel - TDD Foundation; Write Failing Tests First)
 
**T002: Create contract validation test for map-contract.json [P]**
Description: Write Vitest test suite validating MapView props against map-contract.json schema (position x/y ≥20% if not centered, size viewport units, connections array). Snapshot test for events. Expect failure.
Files: tests/unit/mapContract.spec.ts (create new).
Depends on: None.
Parallel: Run with T003 (independent contracts).
Command: `kilocode run-task T002`
Status: [ ]
 
**T003: Create contract validation test for connection-contract.json [P]**
Description: Write Vitest test suite validating connection props against connection-contract.json schema (source/target patterns, style required, accessibility label). Test glow/active states. Expect failure.
Files: tests/unit/connectionContract.spec.ts (create new).
Depends on: None.
Parallel: Run with T002.
Command: `kilocode run-task T003`
Status: [ ]

## Setup Tasks (Sequential - After Initial Contract Tests)

**T004: Configure ESLint and Prettier for responsive CSS rules**
Description: Update ESLint config to include stylelint for CSS validation (e.g., no hardcoded px for responsive). Run `npm run lint -- --fix`.
Files: eslint.config.js (root), .prettierrc (root).
Depends on: T003.
Command: `kilocode run-task T004`
Status: [ ]
 
**T005: Update package.json and install dependencies**
Description: Ensure custom CSS setup for responsive utilities per spec NFR-002. Add any missing dev deps for testing (e.g., @playwright/test if needed). Run `npm install`. No tailwind.config.js needed.
Files: package.json (root).
Depends on: T004.
Command: `kilocode run-task T005`
Status: [ ]

**T001: Create contract validation test for layout-contract.json [P]**
Description: Write Vitest test suite validating LayoutState props against layout-contract.json schema (breakpoint enum, theme colors). Use jsdom to mock resize events. Expect initial failure due to no implementation.
Files: tests/unit/layoutContract.spec.ts (create new).
Depends on: None.
Parallel: Can run with T002, T003 (independent contracts).
Command: `kilocode run-task T001`
Status: [ ]

## E2E Test Tasks [P] (Parallel - TDD Foundation; Write Failing Tests First)

**T006: Implement Quickstart Scenario 1 - Mobile Layout E2E Test [P]**
Description: Write Playwright test for mobile viewport (375x667px): Assert no horizontal scroll, vertical stack, touch targets ≥44px, theme applied, CLS ≤0.1 on orientation change. Use iPhone SE emulation. Implements FR-001. Expect failure (current overflow).
Files: e2e/ui-mobile-layout.test.ts (create new).
Depends on: T005.
Parallel: Can run with T007-T010 (scenarios independent pre-impl).
Command: `kilocode run-task T006`
Status: [ ]

**T007: Implement Quickstart Scenario 2 - Desktop Adaptation E2E Test [P]**
Description: Write Playwright test for desktop (1920px) resizing to tablet (800px): Assert grid shift to 2-col, map centered, connections visible. Expect failure (misalignment). Implements FR-001.
Files: e2e/ui-desktop-adaptation.test.ts (create new).
Depends on: T005.
Parallel: Run with T006, T008-T010.
Command: `kilocode run-task T007`
Status: [ ]

**T008: Implement Quickstart Scenario 3 - Map Positioning & Connections E2E Test [P]**
Description: Write Playwright test: Assert map size 100%/50vh with ≤5% offset from center (e.g., auto margin or translate). glowing connection line (opacity=1, animation), ARIA label present. Simulate interaction. Expect failure (top-left). Implements FR-002, FR-003.
Files: e2e/ui-map-connections.test.ts (create new).
Depends on: T005.
Parallel: Run with T006-T007, T009-T010.
Command: `kilocode run-task T008`
Status: [ ]

**T009: Implement Quickstart Scenario 4 - Theme & Accessibility E2E Test [P]**
Description: Write Playwright test for dark mode: Validate ≥4.5:1 contrast, ≥16px fonts, ARIA labels on map/connections. Use axe-core for accessibility scan. Expect failure (low contrast). Implements NFR-002.
Files: e2e/ui-theme-accessibility.test.ts (create new).
Depends on: T005.
Parallel: Run with T006-T008, T010.
Command: `kilocode run-task T009`
Status: [ ]

**T010: Implement Quickstart Scenario 5 - Performance E2E Test [P]**
Description: Write Playwright test with 4G emulation: Assert First Contentful Paint ≤2s, no layout shifts ≤100px. Include unit mocks for 2s render, ≤100px shifts. Use performance API. Expect failure (slow render). Implements NFR-001, NFR-003.
Files: e2e/ui-performance.test.ts (create new).
Depends on: T005.
Parallel: Run with T006-T009.
Command: `kilocode run-task T010`
Status: [ ]

**T011: Implement Low-Bandwidth E2E Test [P]**
Description: Write Playwright test with network throttling (<1Mbps emulation): Assert initial render <3s, map/messages load first (no blocking), lazy assets deferred. Use performance API for timing. Expect failure initially. Implements FR-005, NFR-004.
Files: e2e/ui-low-bandwidth.test.ts (create new).
Depends on: T005.
Parallel: Run with T006-T012.
Command: `kilocode run-task T011`
Status: [ ]

*Parallel Guidance: Run in parallel: Contract tests T002 [P], T003 [P], T001 [P] first. Then setup T004-T005. Then E2E T006-T010 [P]. All should fail initially.*

## Core Tasks (Sequential - Implement to Pass Tests)

**T013: Implement LayoutState Svelte store**
Description: Create writable store for LayoutState entity per data-model.md and layout-contract.json. Handle resize listener to update breakpoint/orientation/isOverflowing/theme (CSS vars: bg #0a0a0a, accentBlue #00f5ff, etc.). Validate schema in store init. Implements FR-001: ui-must-adapt-layout. Update to pass T001.
Files: src/lib/stores/layoutStore.ts (create new), src/app.html (add resize listener if needed).
Depends on: T001 (test).
Command: `kilocode run-task T013`
Status: [ ]

**T014: Update Map.svelte component for responsive positioning**
Description: Refactor Map.svelte to use MapView entity per data-model.md and map-contract.json. Set position {x:'50%', y:'50%', centered:true} and CSS: .map-centered { position: relative; left: 50%; transform: translateX(-50%); /* or margin: auto for ≤5% offset per FR-002 */ }, size {width:'100%', height:'50vh'}, interactive=true. Implement custom CSS classes per spec NFR-002 (e.g., .map-centered { position: relative; margin: auto; min-width: 20vw; min-height: 20vh; } for <640px, #00f5ff accents). Integrate layoutStore for responsive. Pass T002, T008. Implements FR-002.
Files: src/lib/components/Map.svelte.
Depends on: T002, T013 (store).
Command: `kilocode run-task T014`
Status: [ ]

**T015: Add connection indicators to Map.svelte and related components**
Description: Implement connections array in Map.svelte per map-contract.json and connection-contract.json. Use custom CSS pseudo-elements (::after) for glowing lines (box-shadow 0 0 10px #00f5ff, pulse animation). Link to messageStream/agentStatus. Add ARIA labels. Pass T003, T008. Implements FR-003.
Files: src/lib/components/Map.svelte, src/lib/components/MessageStream.svelte (if needed for targets).
Depends on: T003, T014.
Command: `kilocode run-task T015`
Status: [ ]

**T016: Update +layout.svelte for responsive grid and theme**
Description: Implement custom CSS responsive classes in +layout.svelte: .mobile-layout { display: block; } .tablet-layout { display: grid; grid-template-columns: 1fr 1fr; }, flex justify-center. Inject CSS vars from layoutStore for theme (dark sci-fi). Ensure no overflow, touch-friendly padding, ≥44px tappable areas per FR-004. Pass T006, T007, T009. Implements FR-001, FR-004.
Files: src/routes/+layout.svelte.
Depends on: T006, T007, T009, T013.
Command: `kilocode run-task T016`
Status: [ ]

**T017: Optimize components for performance and accessibility**
Description: Add lazy loading if needed, ensure font sizes/contrast per NFR-002. Update ARIA on all components. Include touch gesture optimizations (debounce, feedback) to pass T012. Run lighthouse audit. Pass T009, T010.
Files: src/lib/components/Map.svelte, src/lib/components/AgentStatus.svelte, src/lib/components/MessageStream.svelte.
Depends on: T009, T010, T011, T016.
Command: `kilocode run-task T017`
Status: [ ]

## Integration Tasks (Sequential - End-to-End Flow)

**T018: Integrate stores and components in +page.svelte**
Description: Wire layoutStore to Map.svelte and other components in +page.svelte. Include gesture debounce ≥200ms (e.g., on map interactions) and visual feedback (glow effect). Test event emissions (resize, connectionUpdate) from contracts. Ensure full page responsive per FR-001-FR-005. Run all E2E tests; fix any failures.
Files: src/routes/+page.svelte.
Depends on: T017.
Command: `kilocode run-task T018`
Status: [ ]

## Polish Tasks [P] (Parallel - Final Quality)

**T019: Add unit tests for updated stores and components [P]**
Description: Write Vitest coverage for layoutStore updates, Map.svelte props/events. Ensure ≥80% coverage. Mock resize for transitions. Cover custom CSS responsiveness.
Files: tests/unit/layoutStore.spec.ts (new), tests/unit/Map.spec.ts (update).
Depends on: T018.
Parallel: Run with T020.
Command: `kilocode run-task T019`
Status: [ ]

**T020: Enhance E2E tests with edge cases [P]**
Description: Add Playwright tests for orientation change, small screens <320px, connection state toggles touch interruptions. Include manual responsive devtools check. Assert ≥44px tappable areas.
Files: e2e/ui-edge-cases.test.ts (new).
Depends on: T018.
Parallel: Run with T019.
Command: `kilocode run-task T020`
Status: [ ]

*Parallel Guidance: Run in parallel: T019 [P], T020 [P] (tests independent).*

**Final Validation**: After all tasks, run `npm run build`, `npm run test`, `npx playwright test`. Include low-bandwidth throttling in `npx playwright test`. Merge to main if passing.