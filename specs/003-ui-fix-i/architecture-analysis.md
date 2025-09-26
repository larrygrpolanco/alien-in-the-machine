# Architecture Analysis: Unapproved Dependencies

## Overview
This analysis examines the specs/003-ui-fix-i/ directory and relevant codebase for unapproved dependencies. Approved dependencies per spec.md and plan.md include core Svelte 5, Vitest for testing, and custom CSS for styling (no external frameworks, aligning with Principle 5: SvelteKit native simplicity). The focus is client-side UI fixes (responsive layout, map positioning, connection indicators) without new server-side or data integrations.

Unapproved dependencies are defined as external libraries, services, or integrations not explicitly listed or justified in the spec/plan. Cross-referenced with package.json (Svelte ecosystem + openai) and code imports/usages.

## Identified Unapproved Dependencies

### 1. Tailwind CSS
- **Description**: Utility-first CSS framework for responsive design (e.g., classes like `grid-cols-1 md:grid-cols-2` for breakpoints).
- **Location in Code/Spec**:
  - Proposed in specs/003-ui-fix-i/research.md (Section 1: "Use Tailwind CSS (already in project) with custom media queries... Tailwind provides utility-first responsive classes").
  - Not present in package.json dependencies.
  - No imports or usages in code (e.g., src/lib/components/Map.svelte uses pure CSS; no Tailwind classes in src/routes/+layout.svelte or other components).
- **Rationale for Being Unapproved**: 
  - spec.md (Clarifications: "Styling: Use custom CSS classes only, no external frameworks like Tailwind to align with constitution Principle 5").
  - plan.md (Constraints: "Custom CSS only (no Tailwind or external libs)").
  - research.md's assumption ("already in project") is incorrect; contradicts native simplicity principle.
- **Potential Impact of Removal**: Minimal, as no actual implementation exists. Would enforce custom CSS media queries (@media (max-width: 640px) {}) for breakpoints (mobile <640px, etc.), increasing manual CSS but maintaining lightweight bundle and principle compliance. Responsive fixes can use native CSS Grid/Flexbox.

### 2. OpenAI SDK and OpenRouter API Integration
- **Description**: External LLM service via OpenAI SDK (npm package: openai@^5.23.0) proxying to OpenRouter (baseURL: https://openrouter.ai/api/v1, env: OPENROUTER_API_KEY) for chat completions.
- **Location in Code/Spec**:
  - Implemented in src/routes/api/llm/+server.ts: Imports OpenAI, creates client, calls chat.completions.create with JSON schema for agent actions.
  - Used by src/lib/services/llmClient.ts (fetch to /api/llm) and src/lib/services/agent.ts (callLLM for generateAgentAction).
  - package.json: "dependencies": { "openai": "^5.23.0" }.
  - Not mentioned in specs/003-ui-fix-i/ (spec.md, plan.md, research.md, data-model.md, quickstart.md, contracts/): UI fix is client-side (FR-001 to FR-005, NFR-001 to NFR-003); no LLM/agent logic referenced. plan.md notes "No API endpoints needed (client-side UI)".
- **Rationale for Being Unapproved**: 
  - Feature scope is UI/layout fixes (responsive, map, connections); LLM integration is core to overall project (agent simulation) but extraneous/unjustified for this spec. plan.md (Technical Context: "Storage: N/A (client-side UI fixes, no new data persistence)"; "No API endpoints needed").
  - Violates bounded scope: Introduces server-side dependency not tied to UI rendering/testing.
- **Potential Impact of Removal**: High for overall app (breaks agent actions, turns, events via llmClient/agent.ts). For UI fix: Low direct impact (Map.svelte, stores use internal data; no LLM calls in UI components). Could mock/stub LLM in tests (as in +server.ts mock mode) for UI validation. Removal would require refactoring to static/simulated data for demo, but preserve eventStore/worldStore for map rendering.

## Summary of Findings
- Total unapproved: 2 (Tailwind proposal; OpenAI/OpenRouter usage).
- No unapproved in contracts/ (pure JSON schemas for UI state) or data models (Svelte stores).
- Codebase largely compliant: UI components (e.g., Map.svelte) use native Svelte/CSS/SVG; stores/services internal except LLM path.
- No database connections, other external APIs, or unmentioned npm packages found.

## Ambiguities Noted
- OpenAI/OpenRouter: May be implicitly approved as project core (from src/lib/services/), but not for UI fix scope. Clarify if LLM is "existing infrastructure" or needs scoping out.
- Tailwind: research.md's proposal suggests planning inconsistency; confirm if custom CSS suffices or if framework exception needed.
- No other ambiguities; all files analyzed align with client-side focus.

Analysis complete. Ready for architecture revisions (remove unapproved, update tasks.md).