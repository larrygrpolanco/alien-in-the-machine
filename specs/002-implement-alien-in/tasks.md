# Tasks: Implement Alien in the Machine Game

**Input**: Design documents from `/specs/001-implement-alien-in/`
**Prerequisites**: plan.md (required), PRD.md, spec.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack (SvelteKit/JS/TS, OpenRouter, Vitest), structure (single project: src/lib/ for stores/models/services, src/routes/+page.svelte for UI, tests/ for Vitest)
2. Load design documents:
   → PRD.md: Extract mechanics (6 zones, agents, actions, turn loop, message stream)
   → spec.md: Extract entities (Zone/Agent/Item/Event/Message), 4 acceptance scenarios + 3 edge cases for integration tests
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: integration tests for scenarios/edges
   → Core: models/stores/services for entities, actions, turn loop, UI components
   → Integration: LLM prompts, OpenRouter calls, reactivity, win/lose
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All scenarios/edges have tests?
   → All entities have stores/models?
   → All core mechanics implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/lib/stores/`, `src/lib/models/`, `src/lib/services/`, `src/lib/components/`, `src/routes/+page.svelte`, `tests/integration/`, `tests/unit/` at repository root

## Phase 3.1: Setup
- [ ] T001 Initialize SvelteKit project in repository root using `npx create-svelte@latest . --template skeleton --typescript` and set up basic structure with src/lib/ for stores/models/services and tests/ for Vitest
- [ ] T002 Install dependencies including @openrouter/api for AI integration, vitest for testing, and development tools via `npm install @openrouter/api` and `npm install -D vitest @vitest/ui`
- [ ] T003 [P] Configure linting and formatting with ESLint and Prettier by creating .eslintrc.cjs, .prettierrc, and integrating into package.json scripts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Integration test for acceptance scenario 1 (commander message and turn advance updates world state) in tests/integration/test-acceptance-1.spec.ts using Vitest
- [ ] T005 [P] Integration test for acceptance scenario 2 (agent encounters alien, health/stress changes) in tests/integration/test-acceptance-2.spec.ts using Vitest
- [ ] T006 [P] Integration test for acceptance scenario 3 (vial retrieved with ≥2 survivors triggers win) in tests/integration/test-acceptance-3.spec.ts using Vitest
- [ ] T007 [P] Integration test for acceptance scenario 4 (all agents dead or timeout triggers loss) in tests/integration/test-acceptance-4.spec.ts using Vitest
- [ ] T008 [P] Integration test for edge case 1 (agent stress >7 triggers panic action) in tests/integration/test-edge-1.spec.ts using Vitest
- [ ] T009 [P] Integration test for edge case 2 (alien sneaks, hides position on map) in tests/integration/test-edge-2.spec.ts using Vitest
- [ ] T010 [P] Integration test for edge case 3 (vial dropped during combat leads to failure) in tests/integration/test-edge-3.spec.ts using Vitest

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T011 Implement Event log store as append-only array for all changes in src/lib/stores/eventLog.ts using Svelte writable store
- [ ] T012 Implement Zone store with 6 predefined zones (Shuttle, Shuttle Bay, Corridor, Storage Room, Command Room, Medbay), connections, and initial items in src/lib/stores/zones.ts ensuring stateful updates via events from eventLog
- [ ] T013 Implement Item model for stateful objects like vial or cabinets (e.g., present/empty states) in src/lib/models/item.ts with methods for interaction updates
- [ ] T014 Implement Message stream store for radio messages and reports, pruned to recent turns, in src/lib/stores/messages.ts using Svelte store for reactivity
- [ ] T015 Implement base Agent class/service with attributes (position, health, stress, personality, memory stream) in src/lib/services/agent.ts deriving state from eventLog
- [ ] T016 Implement marine-specific actions (move, search, interact, attack, take cover, report) in src/lib/services/marineActions.ts with world effects via eventLog updates
- [ ] T017 Implement alien actions (sneak, attack, stalk, ambush) in src/lib/services/alienActions.ts with asymmetric effects and visibility rules
- [ ] T018 Implement director actions (adjust hazard, escalate, narrative nudge) in src/lib/services/directorActions.ts for world adjustments without direct kills
- [ ] T019 Implement turn loop logic in src/lib/services/turnManager.ts sequencing director, alien, then marines, assembling contexts from stores and appending events
- [ ] T020 Implement personalities (e.g., aggressive, cautious) in src/lib/models/personality.ts influencing action preferences and compliance, integrated into Agent service
- [ ] T021 Implement stress and health tracking mechanics in src/lib/models/agentState.ts with increments from events, panic thresholds (>7), and health reduction from attacks
- [ ] T022 [P] Implement UI map component showing zones, agent positions (dots: green for marines, red for visible alien), and basic connections in src/lib/components/Map.svelte using Svelte
- [ ] T023 [P] Implement UI message stream component for displaying scrolling reports with timestamps and senders in src/lib/components/MessageStream.svelte reactive to messages store
- [ ] T024 [P] Implement UI input component for commander message entry and "Next Turn" button in src/lib/components/Input.svelte handling message dispatch to stores
- [ ] T025 Integrate UI components (Map, MessageStream, Input) into main page layout with terminal-style styling in src/routes/+page.svelte subscribing to relevant stores

## Phase 3.4: Integration
- [ ] T026 Implement LLM prompt templates for agents (including memory stream, commander message, action choices) in src/lib/services/prompts.ts tailored for marine/alien/director
- [ ] T027 Integrate OpenRouter API calls in agent service src/lib/services/agent.ts to generate actions via prompts, parsing JSON responses and applying via eventLog
- [ ] T028 Ensure world state reactivity across Svelte stores (eventLog, zones, messages) updating UI components in real-time during turn advances
- [ ] T029 Implement win/lose condition checks in turnManager.ts after each turn (vial in Shuttle + ≥2 survivors for win; all dead/30 turns for lose)
- [ ] T030 Add LLM fallback logic in agent service (e.g., rule-based action if invalid response) and error handling for API calls

## Phase 3.5: Polish
- [ ] T031 [P] Unit tests for entities and actions (e.g., Zone updates, Agent stress) in tests/unit/test-entities.spec.ts and tests/unit/test-actions.spec.ts using Vitest
- [ ] T032 [P] Performance tests ensuring LLM calls <5s per agent turn in tests/unit/test-performance.spec.ts using Vitest with mocks
- [ ] T033 [P] Update README.md with project setup, dependencies, run instructions (`npm run dev`), and game overview
- [ ] T034 [P] Add accessibility features (keyboard nav, high-contrast) and basic styling (green monochrome terminal theme) to UI components in src/lib/components/
- [ ] T035 [P] Run manual testing scenarios from spec.md, fix any issues in core/integration, and validate emergent narratives in simulated playthroughs

## Dependencies
- Tests (T004-T010) before implementation (T011-T025)
- Event log (T011) and zones (T012) before agents (T015-T018) and turn loop (T019)
- Core entities/stores (T011-T014) before actions (T016-T018) and UI (T022-T025)
- Agent service (T015) and prompts (T026) before OpenRouter integration (T027)
- Core (T011-T025) before integration (T026-T030)
- Integration before polish (T031-T035)

## Parallel Example
```
# Launch T004-T010 together:
Task: "Integration test for acceptance scenario 1 in tests/integration/test-acceptance-1.spec.ts"
Task: "Integration test for acceptance scenario 2 in tests/integration/test-acceptance-2.spec.ts"
Task: "Integration test for acceptance scenario 3 in tests/integration/test-acceptance-3.spec.ts"
Task: "Integration test for acceptance scenario 4 in tests/integration/test-acceptance-4.spec.ts"
Task: "Integration test for edge case 1 in tests/integration/test-edge-1.spec.ts"
Task: "Integration test for edge case 2 in tests/integration/test-edge-2.spec.ts"
Task: "Integration test for edge case 3 in tests/integration/test-edge-3.spec.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts
- No backend/endpoints; all in-memory with Svelte stores
- Focus on SvelteKit reactivity for UI updates

## Task Generation Rules
*Applied during main() execution*

1. **From Spec Entities**:
   - Each entity (Zone, Agent, Item, Event, Message) → store/model task [P]
   - Relationships → service tasks

2. **From Scenarios/Edges**:
   - Each acceptance/edge → integration test [P]
   - Core mechanics → implementation tasks

3. **From PRD Mechanics**:
   - Actions/turn loop → service tasks
   - UI elements → component tasks

4. **Ordering**:
   - Setup → Tests → Entities → Services → UI → Integration → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All scenarios/edges have corresponding tests
- [x] All entities have model/store tasks
- [x] All tests come before implementation
- [x] Parallel tasks truly independent
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task