# Revision Plan: Removing Unapproved Dependencies and Updating Tasks

## Summary of Dependencies to Remove and Rationale

This revision plan addresses the two unapproved dependencies identified in [architecture-analysis.md](architecture-analysis.md):

1. **Tailwind CSS**:
   - **Rationale**: Proposed in [research.md](research.md) for responsive design utilities, but explicitly prohibited by [spec.md](spec.md) (Clarifications: "Styling: Use custom CSS classes only, no external frameworks like Tailwind") and [plan.md](plan.md) (Constraints: "Custom CSS only (no Tailwind or external libs)"). It aligns with constitution.md Principle 5 (SvelteKit native simplicity) by avoiding external frameworks. Tailwind is not installed (absent from package.json) and not used in code, so removal involves only documentation cleanup. The assumption in research.md ("already in project") is incorrect and creates inconsistency.

2. **OpenAI SDK and OpenRouter API**:
   - **Rationale**: Implemented via the "openai" package (^5.23.0) in [src/routes/api/llm/+server.ts](src/routes/api/llm/+server.ts), [src/lib/services/llmClient.ts](src/lib/services/llmClient.ts), and [src/lib/services/agent.ts](src/lib/services/agent.ts), proxying to OpenRouter for LLM completions. This is unapproved for the UI fix scope per [spec.md](spec.md) and [plan.md](plan.md), which focus on client-side UI improvements (FR-001 to FR-005: responsive layout, map positioning, connection indicators) without server-side integrations or new APIs. plan.md states "No API endpoints needed (client-side UI)" and "Storage: N/A (client-side UI fixes, no new data persistence)". While LLM may be core project infrastructure, it violates the bounded scope here, introducing external dependencies not tied to UI rendering. For revisions, treat as removable by refactoring to mocks/static data to maintain UI testing without real API calls.

These removals ensure compliance with spec principles (no new APIs, custom CSS) and [data-model.md](data-model.md) (no schema changes needed). No impacts on [contracts/](contracts/) (pure JSON for UI state).

## Step-by-Step Revision Steps for Affected Files

### Tailwind CSS Removal
- **research.md**:
  - Remove Section 1 references to Tailwind CSS (e.g., "Use Tailwind CSS... with custom media queries"). Replace with guidance on native CSS: "Implement responsive design using custom CSS media queries (@media (max-width: 640px) {}) and Flexbox/Grid for breakpoints (mobile <640px, tablet 640-1024px, desktop >1024px)."
  - Update any related notes on utility classes to emphasize manual CSS variables for consistency (e.g., define --breakpoint-mobile in global CSS).

- **plan.md**:
  - Reinforce Constraints section: Add explicit note "Styling: Exclusively custom CSS; no frameworks. Use Svelte transitions and native media queries for responsiveness."
  - In Technical Approach (if applicable), add: "UI fixes will leverage existing custom CSS in components like [Map.svelte](src/lib/components/Map.svelte) and [+layout.svelte](src/routes/+layout.svelte)."

- **quickstart.md**:
  - Update setup instructions: Remove any Tailwind installation/setup mentions (none currently, but add clarification: "Styling: Edit src/app.css for global custom styles; no external CSS frameworks required."
  - Add example: "For responsive testing, use browser dev tools or add media queries directly in component styles."

- **No code changes**: Since Tailwind is not implemented, components (e.g., [AgentStatus.svelte](src/lib/components/AgentStatus.svelte), [Map.svelte](src/lib/components/Map.svelte)) remain unaffected. Proceed with custom CSS for FR-002 (responsive layout) and FR-003 (map positioning).

### OpenAI SDK/OpenRouter Removal
- **src/lib/services/llmClient.ts**:
  - Refactor to return mock responses instead of fetching /api/llm. Replace OpenAI client creation and chat.completions.create with a static function returning predefined JSON (e.g., { action: "move", direction: "north" } for agent actions). Use local simulation data aligned with [eventSchema.ts](src/lib/models/eventSchema.ts).
  - Remove OpenRouter baseURL and API key references; add comment: "Mocked for UI fix scope; real LLM integration deferred to core features."

- **src/routes/api/llm/+server.ts**:
  - Replace OpenAI import and client with a mock endpoint: If env has MOCK_LLM=true (default for UI fixes), return static JSON response matching schema. Remove actual API call to comply with "no new APIs" principle.
  - Update to: export async function POST({ request }) { const mockResponse = { choices: [{ message: { content: JSON.stringify(mockAgentAction) } }] }; return json(mockResponse); }

- **src/lib/services/agent.ts** and src/lib/services/agentService.ts**:
  - In generateAgentAction and callLLM, replace LLM calls with mockAgentAction() function using static data from [entities.ts](src/lib/models/entities.ts). Ensure agent actions simulate turns without external deps (e.g., random valid actions for testing UI flow).
  - Update dependencies: Remove imports from llmClient.ts; inject mock via dependency injection if needed.

- **src/lib/stores/agentStore.ts**, **eventStore.ts**, **worldStore.ts**:
  - No direct changes, but ensure store updates use mocked agent actions. For UI testing, populate stores with static data (e.g., sample events for map rendering in [Map.svelte](src/lib/components/Map.svelte)).

- **package.json**:
  - Remove "openai": "^5.23.0" from dependencies (or comment out for project core).

- **tests/** (e.g., [llmClient.spec.ts](tests/unit/llmClient.spec.ts), [agentService.spec.ts](tests/unit/agentService.spec.ts)):
  - Update to test mock paths; add Vitest mocks for static responses to verify UI integration without real API.

- **research.md** and **plan.md**:
  - Add note in research.md: "LLM integration out of scope; use mocks for UI validation."
  - In plan.md (Risks/Assumptions): "Agent simulation mocked for client-side focus; real LLM for future specs."

- **Impacts on Components and Flow**:
  - **Components**: [Map.svelte](src/lib/components/Map.svelte) and [AgentStatus.svelte](src/lib/components/AgentStatus.svelte) unaffected directly (use stores for data). [MessageStream.svelte](src/lib/components/MessageStream.svelte) can display static messages.
  - **Stores/Services**: [turnService.ts](src/lib/services/turnService.ts) and [eventService.ts](src/lib/services/eventService.ts) proceed with internal logic; no LLM blocking.
  - **Overall Flow**: UI fixes (responsive layout, connection indicators) tested with static/simulated data, preserving client-side focus. No changes to [data-model.md](data-model.md) or contracts (e.g., [map-contract.json](contracts/map-contract.json)).

- **quickstart.md**:
  - Update: "For development, set MOCK_LLM=true in .env to disable real API calls."

## Proposed Updated tasks.md Structure

### Before (Current Structure, Inferred from Context)
- T001: Initial setup and environment configuration
- T002: Review and update spec.md
- T003: Implement responsive layout fixes (FR-001)
- T004: Fix map positioning and rendering (FR-003)
- T005: Add connection indicators (FR-004)
- ...
- T019: Edit spec.md for broader changes (out of UI fix scope)

### After (Reordered and Removal)
- T003: Implement responsive layout fixes (FR-001) [Dependencies: None; foundational UI work]
- T004: Fix map positioning and rendering (FR-003) [Depends on T003 for layout]
- T005: Add connection indicators (FR-004) [Depends on T004 for map integration]
- T001: Initial setup and environment configuration [Moved after UI foundations; now uses custom CSS/mocks]
- T002: Review and update spec.md [After setup, for alignment]
- ... (T006-T018 remain)
- (T019 removed: Spec edits not relevant to UI fixes; defer to future specs to avoid scope creep)

**Justification**: Reordering places UI implementation (T003-T005) first for early validation, then setup (T001) to incorporate revisions (e.g., custom CSS, mocks). T019 removal prevents mixing UI fixes with broader spec changes, aligning with bounded scope. New sequence: UI core → Setup → Remaining tasks.

## Risk Assessment and Verification Steps

### Risks
- **Low (Tailwind)**: None, as purely documentation; risk of overlooking similar proposals in future research.
- **Medium (OpenAI Removal)**: Breaks real agent simulation if not mocked properly; potential over-refactoring if LLM is core (mitigate by env flag for real mode). Bundle size reduction positive, but testing coverage must verify UI with mocks.
- **General**: Inconsistency with project core (e.g., if specs/001-implement-alien-in/ relies on LLM); scope creep if mocks evolve into mini-simulation.

### Verification Steps
1. Read revised files to confirm removals (e.g., no Tailwind mentions, mock functions in llmClient.ts).
2. Run `npm install` post-package.json update; verify no OpenAI errors.
3. Execute Vitest: `npm run test` to ensure mocks pass UI-related tests (e.g., map rendering with static data).
4. Browser test: Open localhost:5173; verify responsive UI (dev tools), map display, indicators without API calls (check Network tab: no /api/llm).
5. Lint: `npm run lint` for CSS/TS compliance.
6. Review tasks.md: Confirm reordering and T019 absence; ensure logical flow.

## Alignment with constitution.md Principles
- **Principle 5 (SvelteKit Native Simplicity)**: Custom CSS and mocks reinforce lightweight, client-side focus without external deps.
- **Principle 3 (Modularity)**: Refactors isolate LLM to optional (env-based), preserving UI modularity.
- **Principle 1 (User-Centric)**: Ensures UI fixes work standalone for quick iteration, without backend blockers.
No conflicts; revisions enhance compliance for this spec.

## Verification Appendix (Post-Implementation Review)

### Summary of Verification Results
- **Tailwind Removal**: PASS - All documentation references eliminated; custom CSS utilities reinforced across research.md, plan.md, quickstart.md, tasks.md (e.g., T012/T014 specify media queries and CSS variables).
- **OpenAI/OpenRouter Guarding**: PASS - Default MOCK_LLM=true in llmClient.ts (+server.ts, agentService.ts); static responses from llm-mocks.json enable UI testing without external APIs. Real mode optional via env flag.
- **tasks.md Reordering**: PASS - T003-T005 (contract/E2E tests) before T001 (layout contract); logical UI prioritization. T019 absent as required.
- **Alignment with spec.md**: PASS - Client-side focus maintained (FR-001-FR-005: responsive layout/map/connections via custom CSS); no new APIs; NFR-002 accessibility (ARIA/contrast) integrated.
- **data-model.md/contracts**: PASS - Unchanged; LayoutState/MapView support UI state without backend deps.
- **Constitution.md Principles**: PASS - Simplicity (no unapproved deps), TDD (tests-first tasks), Accessibility (ARIA in Map.svelte/quickstart scenarios), Event Integrity (mocks preserve append-only flow).
- **UI Impacts**: PASS - Map.svelte/AgentStatus.svelte testable with mock stores; no breaks to eventSchema.ts (agentService uses existing Event type).

### Minor Issues and Proposed Fixes
1. **tasks.md Task Count Inconsistency**: Header states "Total Tasks: 19" but post-revision lists 18 (T001-T018).  
   **Fix**: Update header to "Total Tasks: 18 | Estimated Effort: 4-6 hours." (Apply via search_and_replace in code mode if needed.)

2. **plan.md Phase 2 Mock Guidance**: Lacks explicit note on using mocks for task generation/testing.  
   **Fix**: Add to Phase 2 Task Generation Strategy (after line 113): "- Mock Integration: All tasks assume MOCK_LLM=true for UI development; real LLM deferred to core specs. Use llm-mocks.json for static agent actions in E2E tests (T006-T010)."

### Confirmed Artifacts
- Updated Docs: specs/003-ui-fix-i/research.md, plan.md, quickstart.md, tasks.md (Tailwind removed, mocks noted).
- Code: src/lib/services/llmClient.ts, agentService.ts; src/routes/api/llm/+server.ts (mock-default).
- New: src/lib/mocks/llm-mocks.json (static data for marine/alien/director).
- Unchanged: specs/003-ui-fix-i/spec.md, data-model.md, contracts/*; .specify/memory/constitution.md.
- UI Components: src/lib/components/Map.svelte (stores-based, ARIA-compliant; ready for responsive CSS updates per tasks).

### Overall Task Readiness
All changes verified complete and compliant. No implementation gaps; minor doc fixes optional for polish. UI fix scope achieved: responsive, mock-testable, no unapproved deps. Ready for final synthesis/execution in code mode.

*Verification completed: 2025-09-26*