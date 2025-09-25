<!--
Sync Impact Report:
- Version change: None → 1.0.0 (initial creation)
- List of modified principles: All new - Simplicity First, AI Autonomy, TDD (NON-NEGOTIABLE), Event-Driven Integrity, Emergence Validation
- Added sections: Non-Functional Requirements, Development Workflow
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated (Constitution Check gates added, version footer updated)
  - .specify/templates/spec-template.md ⚠ pending (no changes needed, no constitution references)
  - .specify/templates/tasks-template.md ⚠ pending (no changes needed, TDD already aligned)
- Follow-up TODOs: None - all placeholders resolved from README.md context
-->

# Alien in the Machine Constitution

## Core Principles

### I. Simplicity First
Every feature must prioritize MVP development. Limit scope to essential elements: single mission with 6 zones, 6-8 agent actions, and SvelteKit implementation using OpenRouter for AI. No complex features, backends, or expansions until post-MVP validation. Rationale: Enables rapid prototyping and testable prototype in 4-6 weeks, avoiding over-engineering that delays emergence demonstration.

### II. AI Autonomy
Agents must act independently with personal memory streams influencing decisions. Commander messages guide but do not control; compliance varies by personality (70-90%) and stress levels (>7 triggers freeze or ignore). Prompts enforce contextual reasoning without direct overrides except rare high-stress buttons. Rationale: Creates emergent narratives through fallible AI, emphasizing command tension over micromanagement.

### III. TDD (NON-NEGOTIABLE)
Test-Driven Development is mandatory: Write tests first, ensure they fail, then implement to pass (Red-Green-Refactor cycle). Achieve ≥80% coverage; include unit, integration, and simulation tests (e.g., 20+ playthroughs for emergence). No code commits without passing tests. Rationale: Ensures reliability in AI-driven systems where unpredictable behaviors must be bounded and validated early.

### IV. Event-Driven Integrity
Maintain an immutable, append-only event log as the single source of truth for world state. All actions append events (e.g., {type: 'search', result: 'empty'}); derive entities (zones, items, agents) from log queries. No direct state mutations; prune for token limits but preserve auditability. Rationale: Supports consistent AI context assembly, enables simulation replay, and prevents desynchronization in reactive UI.

### V. Emergence Validation
Design must foster emergent stories: ≥3 unique event branches per playthrough, ≥2 panic events in 50% of simulations. Require 20+ automated playthroughs in testing to measure narrative variety and tension. Director agent subtly escalates without direct intervention. Rationale: Core to gameplay vision—validates AI autonomy produces dramatic, unpredictable outcomes beyond scripted paths.

## Non-Functional Requirements

### Performance
Turn processing <5s total; LLM responses <5s per agent with <2000 tokens per prompt. Prune memory streams to last 10 turns or 50 events. Benchmark 20+ simulations <2min total.

### Security
Handle OpenRouter API keys via environment variables (.env, never hardcoded). Validate all JSON inputs/outputs to prevent injection. No user data persistence in MVP.

### Reliability
Immutable event log for auditability; 3x retry on LLM failures with fallback to scripted AI (e.g., personality-based defaults). Edge cases defined (e.g., stress >7: freeze turn; vial drop at low health).

### Accessibility & Usability
Keyboard navigation for all UI; high-contrast green monochrome mode; ARIA labels on message stream. Limit messages to 200 chars; intuitive terminal UI with real-time updates.

### Scalability
In-memory state for MVP; design event log for future backend if expanding to campaigns.

## Development Workflow

### Milestones
1. Week 1: Core Architecture – Event log, world state, basic agent prompts (TDD enforced).
2. Week 2: Mechanics & Agents – Implement actions, zones, memory, personalities (tests for emergence).
3. Week 3: Commander UX – Terminal UI, map, messages (accessibility checks).
4. Week 4: Integration & Polish – LLM fallbacks, director/alien, win/lose (20+ sims, performance benchmarks).

### Review Process
All PRs must pass constitution gates: TDD coverage, simplicity review, emergence sims. Code reviews verify AI autonomy and event integrity.

### Quality Gates
- Pre-merge: Failing tests fixed; no violations of principles.
- Post-merge: Run quickstart.md validation; update docs.

## Governance

This constitution supersedes all other practices and guides all development decisions. Amendments require: (1) documented proposal justifying change (major/minor/patch), (2) review by architect mode, (3) migration plan for existing code, (4) approval via user confirmation. Versioning follows semantic rules: MAJOR for incompatible changes, MINOR for additions, PATCH for clarifications. Compliance reviews occur per milestone; violations block progress. Use README.md and plan.md for runtime guidance.

**Version**: 1.0.0 | **Ratified**: 2025-09-25 | **Last Amended**: 2025-09-25