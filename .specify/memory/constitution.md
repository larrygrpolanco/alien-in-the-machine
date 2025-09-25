# Constitution for the Alien in the Machine Project

## Introduction

This constitution serves as the foundational guiding document for the Alien in the Machine project, a turn-based sci-fi command simulation built with SvelteKit and leveraging OpenRouter for AI agents (marines, alien, director). Its purpose is to ensure all project decisions align with the core vision of creating an event-driven world state that fosters emergent narratives through a terminal UI. By establishing enforceable principles, it promotes simplicity, AI autonomy, and quality, drawing directly from lessons in the Product Requirements Document (PRD.md): prioritizing AI logic over UI, maintaining MVP focus, avoiding over-engineering like complex ECS or Python integrations, and emphasizing test-driven development (TDD) for reliability.

This document acts as a validation framework for specifications, plans, and tasks, ensuring tech-agnostic specs, phased implementation, and measurable outcomes. It supersedes conflicting instructions and must be referenced in all project phases.

## Core Principles

The following principles are derived from PRD lessons and best practices. Each includes a name, description, and normative statements (using MUST for mandatory requirements and SHOULD for strong recommendations) to enable enforcement.

1. **Simplicity First**  
   Description: Prioritize a minimal viable product (MVP) to deliver core functionality quickly, avoiding over-engineering that could complicate maintenance or dilute the emergent narrative focus. This aligns with PRD emphasis on simplicity over complex systems like ECS.  
   Normative Statements:  
   - MUST limit features to essential MVP scope; any additions require justification in task specs.  
   - SHOULD refactor code only after demonstrating necessity through simulations or tests.  
   - MUST avoid introducing new dependencies unless they directly support AI autonomy or event-driven state.

2. **AI Autonomy**  
   Description: AI agents (marines, alien, director) must operate independently to generate emergent behaviors, with the commander providing only indirect control via high-level directives. This reflects PRD's lesson on AI-first design over UI-driven interactions.  
   Normative Statements:  
   - MUST implement agent decision-making logic without requiring constant human input; agents should act based on world state events.  
   - SHOULD simulate agent autonomy in at least 10 playthroughs per feature to verify independent actions.  
   - MUST prioritize agent logic development before any UI representations.

3. **TDD Enforcement**  
   Description: All development must follow test-driven practices to ensure reliability and prevent regressions in the simulation's complex interactions. This addresses the analysis finding of the empty placeholder constitution causing critical issues in validation.  
   Normative Statements:  
   - MUST write unit and integration tests before implementing any code; achieve 100% coverage for new features.  
   - SHOULD use mocks for external dependencies like OpenRouter to enable fast, deterministic testing.  
   - MUST fail builds or tasks if test coverage drops below 90% overall.

4. **Event-Driven Integrity**  
   Description: The world state must be managed as an append-only event log to support replayability, debugging, and emergent narratives, avoiding direct mutations that could lead to inconsistencies.  
   Normative Statements:  
   - MUST represent all state changes as immutable events in a centralized log.  
   - SHOULD validate event logs for consistency after each simulation turn.  
   - MUST prohibit direct state modifications outside the event system.

5. **Tech Alignment**  
   Description: Adhere to the PRD-specified stack (JavaScript, SvelteKit for UI, OpenRouter for AI) to maintain simplicity and compatibility; deviations must be justified to prevent scope creep.  
   Normative Statements:  
   - MUST use SvelteKit for all frontend components and routing.  
   - SHOULD integrate OpenRouter exclusively for AI agent prompts; no alternative LLM providers without approval.  
   - MUST document and justify any tech deviations in the spec.md for the affected task.

6. **Emergence Validation**  
   Description: Ensure emergent narratives arise naturally from agent interactions, validated through measurable outcomes rather than scripted events, per PRD's focus on simulation-driven storytelling.  
   Normative Statements:  
   - MUST define quantifiable metrics (e.g., narrative branches, agent conflict rates) for each feature.  
   - SHOULD run 20+ automated playthroughs to validate emergence before task completion.  
   - MUST reject features that fail to produce varied outcomes in simulations.

7. **Performance Gates**  
   Description: Maintain responsive gameplay by enforcing strict limits on AI processing to support turn-based flow without delays.  
   Normative Statements:  
   - MUST ensure OpenRouter API calls complete in under 5 seconds and use fewer than 2000 tokens per turn.  
   - SHOULD optimize prompts for brevity and include token counts in test assertions.  
   - MUST include performance benchmarks in integration tests, failing if thresholds are exceeded.

8. **Accessibility**  
   Description: Design the terminal UI to be inclusive, supporting keyboard navigation and high-contrast visuals to broaden accessibility in a sci-fi command simulation.  
   Normative Statements:  
   - MUST implement full keyboard navigation for all interactive elements, compliant with WCAG 2.1 Level AA.  
   - SHOULD use high-contrast color schemes (contrast ratio ≥ 4.5:1) for terminal output.  
   - MUST test accessibility with tools like axe-core before deployment.

## Quality Gates

These checkpoints must be passed at each project phase to enforce the constitution:

- **Specification Phase**: Tech-agnostic spec.md must reference at least 3 core principles; plan.md must outline TDD and validation steps.  
- **Implementation Phase**: Before code commit, achieve 100% test coverage and pass emergence simulations (20+ playthroughs). Event logs must be verifiable.  
- **Review Phase**: Performance gates met (e.g., <5s LLM response); accessibility audit passed. No violations of normative statements.  
- **Deployment Phase**: Full integration tests confirm AI autonomy and event integrity; user playthroughs validate narratives.

Failure at any gate requires rework and re-validation.

## Amendment Process

This constitution is foundational and may only be amended with explicit user approval. Proposals must:  
- Be documented in a dedicated PRD update or spec.md.  
- Demonstrate how changes align with the project vision (e.g., via PRD references).  
- Pass a review gate including simulation validation of impacts.  
Amendments take effect only after user confirmation in a commit message or task approval.