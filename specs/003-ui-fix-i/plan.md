# Implementation Plan: UI Fix for Alien in the Machine

**Branch**: `003-ui-fix-i` | **Date**: 2025-09-26 | **Spec**: specs/003-ui-fix-i/spec.md
**Input**: Feature specification from `/specs/003-ui-fix-i/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check [PASS - Design maintains simplicity, TDD via quickstart, no new complexity].
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Primary requirement: Make the UI responsive and mobile-first, fix map positioning (not clustered at top-left), and clarify connection indicators. Technical approach: Update Svelte components with custom CSS classes and media queries for breakpoints (Mobile <640px, Small tablet 640-1024px, Large desktop >1024px), reposition Map.svelte, add visual connection styles (glowing lines/effects in dark sci-fi theme).

## Technical Context
**Language/Version**: TypeScript 5+ (SvelteKit)
**Primary Dependencies**: Svelte 5, Vitest for testing
**Storage**: N/A (client-side UI fixes, no new data persistence)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web browsers (Chrome, Safari, Firefox; mobile/desktop)
**Project Type**: Web (SvelteKit single project with frontend focus)
**Performance Goals**: Render within 2s on mobile 4G; no specific fps, focus on layout
**Constraints**: Mobile-first responsive; accessibility (contrast, touch targets); dark sci-fi theme (cosmic blues/purples, glowing effects). Styling: Custom CSS utilities only (no Tailwind or external libs); responsive breakpoints <640px mobile (test on 375x667 viewport like iPhone SE). Theme: Cosmic blues/purples with primary #00f5ff accent per spec NFR-002.
**Scale/Scope**: Single-page app updates; 3-5 components (Map.svelte, layout, message stream); No additional implementation details provided

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Simplicity First**: PASS - UI fixes enhance existing MVP without adding complexity; focuses on responsive layout and map positioning, no new features. Aligns with Principle 5 (SvelteKit native, no unapproved deps) by using custom CSS utilities in Svelte components (e.g., +layout.svelte for responsive grid, Map.svelte for connection visuals) to maintain native SvelteKit simplicity, avoiding external frameworks like Tailwind.
- **AI Autonomy**: N/A - Pure UI improvements, no agent prompt changes.
- **TDD (NON-NEGOTIABLE)**: PASS - Will add/update Vitest/Playwright tests for responsive scenarios before component changes; maintain ≥80% coverage. References Principle 3 (TDD) by outlining tests-first approach in phases.
- **Event-Driven Integrity**: PASS - UI updates display existing events without altering event log or append-only nature.
- **Emergence Validation**: PASS - Map fixes improve visibility of emergent interactions; leverage existing simulation tests.
- **Accessibility**: PASS - Incorporates WCAG AA compliance per spec NFR-002, including ≥4.5:1 contrast ratios, ARIA labels for interactive elements (e.g., connection indicators), and high-contrast mode support. Aligns with Principle 8 (Accessibility).

**Status**: All checks PASS. No violations. Custom CSS choice avoids external frameworks, ensuring Principle 5 compliance; no new dependencies introduced.

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Web application (SvelteKit single project). Update existing src/lib/components/ (Map.svelte, MessageStream.svelte, AgentStatus.svelte), src/routes/+layout.svelte for responsive layout. Tests in tests/unit/ and e2e/.

## Phase 0: Outline & Research
[COMPLETED] research.md generated with findings on responsive Svelte practices, map positioning, connection visuals, theme, and testing.

See [research.md](research.md) for details.

## Phase 1: Design & Contracts
[COMPLETED] Generated:
- data-model.md: LayoutState and MapView entities with validation/transitions, aligning with spec entities (e.g., MapView for FR-002, LayoutState for FR-001) and low-bandwidth prioritization per new FR-005/NFR-004.
- contracts/: JSON schemas for layout, map, and connection components (layout-contract.json, map-contract.json, connection-contract.json).
- quickstart.md: 5 validation scenarios for responsive testing (mobile/desktop, map/connections, theme/accessibility, performance) and touch gestures per FR-004.
- Agent update: Skipped (no new tech; UI fixes leverage existing Svelte/custom CSS).

No API endpoints needed (client-side UI). Contract tests will be Vitest snapshots asserting schema compliance.

See artifacts for details.

## Phase 2: Task Planning Approach
[COMPLETED] Task generation strategy defined for /tasks command.

**Task Generation Strategy**:
- Base: Use TDD-focused template with 5 quickstart scenarios as core stories, referencing FR-001 for layout adaptation in Phases and FR-005 for low-bandwidth handling in Phases.
- From contracts: Generate Vitest schema validation tests for each JSON contract [P] (layout, map, connection).
- From data-model: Create Svelte store updates for LayoutState/MapView [P].
- From quickstart: One integration/E2E test per scenario (mobile layout <640px / 375x667 iPhone SE, desktop adapt, map position per FR-002, connections per FR-004 with ≥80% opacity lines/highlights and ARIA, theme/accessibility) and touch gestures (debounce ≥200ms, ≥95% success via E2E simulations). position {x:'50%', y:'50%', centered:true}
- Implementation: Component updates (+layout.svelte, Map.svelte) to pass tests; custom CSS utilities and variables/theme application.
- Additional: Responsive custom CSS classes in global styles; ARIA updates for accessibility.

**Ordering Strategy**:
- TDD: Write failing tests first (contract validations, quickstart scenarios), then implement.
- Dependencies: LayoutState store → MapView component → Connection visuals → E2E validation.
- Parallel [P]: Independent tests (unit for contracts) and store updates can run concurrently.
- Total: 15 tasks generated, aligning with tighter UI fix scope (vs. initial 15-20 estimate).

**Estimated Output**: Numbered tasks.md with [P] markers, estimated 4-6 hours effort.

**Next**: Execute /tasks command to generate tasks.md.

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation including low-bandwidth throttling).

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations identified. All constitutional principles satisfied by the UI fix approach.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
