# Documentation Guide — Agent World Simulation

## Purpose of This Guide

This file tells you (and any LLM session) how to read, write, and maintain the docs in this directory. The goal is a small set of living documents that stay accurate, stay useful, and don't become a graveyard of outdated details.

The docs serve two audiences:

- **You**, reviewing decisions and curating knowledge between sessions.
- **An LLM coding session**, reading for context before building or modifying something. The LLM needs to know what the system looks like *now*, what patterns to follow, and what has been tried and rejected.

Both audiences are harmed by the same failure modes:

1. **Too vague.** The doc says "actions are validated before execution" but doesn't explain how, so the next session invents its own validation approach and breaks the existing pattern. When your specific patterns aren't documented, the AI doesn't do something random — it does something *plausible but wrong*, falling back to the most common pattern from its training data. (Real example from industry: an AI generated a Redux-based component when the project used Zustand, because the state management approach wasn't documented.)
2. **Too specific / too opinionated.** The doc says "the check phase must return a `{ valid: false, reason: string }` object" when that was just a Zoo 1 prototype detail. A later zoo needs a richer error type but the doc reads like law, so the session either follows it slavishly or ignores the docs entirely. Researchers call this **reasoning drift** — guidance that was correct earlier becomes actively misleading as the system evolves.
3. **Stale.** The doc accurately described the system two weeks ago, but three refactors have happened since. The AI reads the doc, trusts it, and produces code that conflicts with the current codebase. Staleness is the most common documentation failure in AI-assisted development, because unlike a human who might notice the code looks different from the docs, the AI treats the docs as ground truth.

The fix is to separate **design principles** (durable, follow these) from **current implementation** (this is how it works today, subject to change) from **historical context** (we tried X, it didn't work because Y) — and to **ground docs in verifiable tests** so staleness is detectable. The guide below explains how.

---

## The Doc Files

Each file covers a *domain*, not a *zoo* or a *time period*. A file is created when a domain first becomes relevant and updated as understanding deepens. Never create a new file for the same topic — update the existing one.

| File | Created After | Covers |
|---|---|---|
| `entity-model.md` | Zoo 0 | Entity kinds, properties, the normalized structure, the kind hierarchy |
| `action-system.md` | Zoo 1 | Action registry, check/execute/report pattern, selectional restrictions, edge cases |
| `scope-and-visibility.md` | Zoo 1 | Scope computation rules, containment, visibility through containers/supporters |
| `room-descriptions.md` | Zoo 2 | Generating text from state, balancing narrative vs mechanical output |
| `llm-integration.md` | Zoo 3 | Prompt structure, response parsing, what context the LLM needs, failure modes |
| `memory-and-context.md` | Zoo 4 | Agent memory format, context window management, summarization strategies |
| `multi-agent.md` | Zoo 5 | Per-agent state, turn systems, information asymmetry, scope partitioning |
| `decisions-log.md` | Zoo 0 | Chronological, append-only record of decisions, surprises, and lessons |

You will likely add files not on this list. That's fine — just follow the same structure described below.

---

## How to Write a Doc File

Every domain doc should have these sections, in this order:

### 1. What This System Does (2–4 sentences)

A plain-language summary. No jargon, no implementation details. Someone with zero context should understand the purpose after reading this paragraph.

*Example:* "The action system processes agent actions as pure state transitions. Each action validates preconditions, applies changes to the world state, and generates a natural language report. Actions never have side effects beyond returning a new state."

### 2. Design Principles (bulleted)

These are the durable ideas — the things that should survive across zoos and refactors. They answer *why* the system works this way. Write them as constraints or commitments, not as implementation instructions.

*Example principles:*
- Actions are pure functions: `(WorldState, Action) → WorldState`. No mutation of the input state.
- The set of available actions is always computed from world state — an agent never sees an action it cannot perform.
- Every action failure produces a reason that can be shown to the agent.

Mark a principle as **[PROVISIONAL]** if you believe it but haven't stress-tested it yet. Remove the tag once it's survived a real challenge. This is how you avoid locking in Zoo 1 assumptions as permanent law.

### 3. Current Implementation

How it actually works *right now*. This section is expected to change. Be precise enough that a coding session can follow the pattern, but flag things that are known simplifications.

Structure this as a description of the current code, referencing actual files:

> The action registry lives in `/src/actions/registry.ts`. Each action is registered with its name, argument schema (as a Zod validator), and its `check`, `execute`, and `report` functions. See `hide_in.ts` for a representative example.
>
> **Known simplification:** Error messages from the check phase are plain strings. This works for single-agent scenarios but may need structure (error codes, affected entities) for multi-agent conflict resolution in Zoo 5.

The phrase **"Known simplification"** is important. It tells a future session: this is intentionally simple, don't over-engineer it now, but also don't assume it's the final form.

**Ground claims in tests.** When a doc states a behavior, reference the test that proves it. This is the single best defense against staleness — if the test still passes, the doc is still true. If someone changes the behavior and the test changes with it, the doc is the thing that's now obviously out of date.

> **Verified by:** `actions.test.ts` → `describe('hide_in')` — covers the check phase rejecting locked containers, the execute phase moving the agent into the container, and the report phase generating narration.

Not every sentence needs a test reference. Use them for behavioral claims that a future session might rely on when writing new code. The test file is the ground truth; the doc is the explanation of *why* it works that way.

### 4. Key Decisions and Their Rationale

Not every decision — just the ones where you had a real alternative and chose deliberately. Format as:

> **Decision:** Containment is stored as a separate relationship index, not as a property on entities.
> **Alternative considered:** Each entity stores its own `containedIn` array.
> **Why this way:** A separate index lets you answer "what's inside X?" with a single lookup instead of scanning all entities. It also avoids the problem of an entity accidentally appearing in two containers.
> **Revisit if:** The relationship index becomes a synchronization burden (having to update it alongside entity moves).

The "Revisit if" line is what prevents over-commitment. It explicitly states the condition under which this decision should be reconsidered.

### 5. Open Questions

Things you don't know yet. Things that will probably matter in a later zoo. Writing them down prevents a future session from accidentally "answering" them with an unconsidered default.

*Example:*
- When an agent takes something off a supporter, should it always go to inventory, or should the agent be able to place it on the floor? (Currently: always inventory. Untested with multi-agent scenarios.)
- Do we need a "part-of" relationship distinct from containment? The desk/drawer case suggests yes, but we haven't implemented it.

---

## How to Write the Decisions Log

`decisions-log.md` is the only chronological file. It is append-only. Each entry has:

```
## YYYY-MM-DD — Zoo N — Short title

**Context:** What were you doing when this came up?
**What happened:** What surprised you or what decision did you make?
**Resolution:** What did you decide and why?
**Implications:** What does this affect going forward?
```

The decisions log is for things that *changed your understanding*. Not "implemented the take action" (that's just progress). More like "discovered that `take` from a supporter has ambiguous destination — decided items always go to inventory because it's simpler, but this may not hold for multi-agent scenarios where another agent is watching."

Keep entries short. Five to eight lines is plenty.

---

## When to Update Docs

### After completing a zoo:

Go through each domain doc that the zoo touched and ask:

1. **Did any design principles change or get confirmed?** Update section 2. Remove [PROVISIONAL] tags from principles that held up. Add new principles that emerged.
2. **Did the implementation change?** Update section 3. Note what changed and why.
3. **Were any decisions made that had real alternatives?** Add to section 4.
4. **Did new open questions emerge?** Add to section 5. Did any open questions get answered? Move them to section 4 as decisions.
5. **Add an entry to the decisions log** for anything surprising or non-obvious.

### After a significant refactor within a zoo:

Update section 3 (current implementation) of the affected docs. If you changed something because the previous approach didn't work, add a decisions log entry explaining the failure.

### What NOT to put in the docs:

- **Code snippets longer than 5–10 lines.** Point to the source file instead. Code in docs goes stale fast.
- **Tutorial-style walkthroughs.** The docs describe *what the system is*, not *how to use it step by step*. The tests and the code itself serve that purpose.
- **Speculative architecture for future zoos.** The zoo plan already covers that. Domain docs should describe what *exists*, not what *might exist*. Open questions are the exception — they name uncertainties without prescribing solutions.
- **LLM prompt text.** Prompts evolve constantly. Reference the file where prompts live; don't paste them into docs.

### How to detect staleness

Docs go stale silently. These are the signals:

- **A test referenced in a doc no longer exists or has been renamed.** The behavior the doc describes may have been removed or restructured.
- **An AI session produces code that contradicts a doc it was given.** This sometimes means the AI ignored the doc, but it can also mean the doc is wrong and the AI followed the code instead. Investigate before blaming the AI.
- **You read a "Current Implementation" section and think "that's not how it works anymore."** Update it immediately — don't leave it for later. Stale implementation sections are the most damaging kind of doc rot because they directly mislead coding sessions.
- **A "Known simplification" has been resolved but the tag was never removed.** After a refactor, grep the docs for known simplifications and check if any have been superseded.

A lightweight habit: when you start a new zoo, skim each domain doc's "Current Implementation" section. If anything feels off, update it before you begin. Five minutes of maintenance prevents hours of an AI session fighting against outdated guidance.

---

## How an LLM Session Should Use These Docs

If you're an LLM reading this for context before a coding task:

1. **Read `CLAUDE.md` first** for project-level orientation (build commands, conventions, what's currently in progress). Keep this layer lean — it's the entry point, not the whole picture.
2. **Read the domain doc(s) relevant to your task.** Follow the file references in "Current Implementation" to see the actual code. Don't load every doc — load only what your task touches. Progressive context beats comprehensive context.
3. **Check the decisions log** for recent entries related to your task. This tells you what was recently tried and what failed.
4. **Respect the hierarchy:**
   - Design principles → follow these unless you have a strong reason not to (and if you do, flag it).
   - Current implementation → follow this pattern for consistency, but it's okay to evolve it if the task requires.
   - Known simplifications → don't over-engineer these preemptively, but don't be surprised if they need to change.
   - Open questions → don't silently resolve these with a default. Flag them if your work touches one.
5. **When the doc and the code disagree, the code wins.** If you notice a discrepancy between what a doc claims and what the actual source files show, follow the code and flag the doc as needing an update. The doc may be stale.
6. **Run the relevant tests** before and after your changes. If a doc says "verified by `scope.test.ts`" and that test fails before you even start, the doc is stale — mention this in your proposed updates.

After completing your task, propose updates to the affected domain docs. The human will review and merge them.

### A warning about AI-proposed doc updates

LLM sessions will confidently produce documentation that sounds right but may misrepresent what actually happened. This is not malicious — it's the same pattern as hallucination in code generation, applied to prose. Common failure modes:

- **Overstating what was tested.** The session says "this handles all edge cases" when it tested three cases.
- **Documenting intent as fact.** The session describes what it *planned* to build rather than what it *actually* built, especially if it hit errors partway through.
- **Smoothing over known limitations.** The session omits caveats or simplifications that would be useful for the next session to know about.

When reviewing AI-proposed doc updates, diff them against what you actually observed during the session. The AI's draft is a starting point, not a finished product.

---

## Guiding Heuristics

### The sufficiency test

When deciding how much detail to include, apply this test:

> If a competent developer (or LLM) read only this doc and the source files it references, could they make a correct modification to this system without breaking existing behavior or contradicting a design decision?

If yes, the doc has enough detail. If no, add what's missing. If the doc has information that doesn't help answer that question, it's probably noise — cut it or move it to the decisions log as historical context.

### Docs as prerequisite, not afterthought

The strongest finding from practitioners who maintain documentation for AI-assisted development: docs work best when they *precede* implementation, not when they describe it after the fact. Before starting a new system or major change, write a short doc describing what you intend to build and why. This forces you to think through the design, gives the AI session a clear target, and makes the doc naturally accurate from the start rather than reconstructed from memory after the fact.

This doesn't mean writing a spec for every function. It means: before you start Zoo 3's LLM integration, draft the "What This System Does" and "Design Principles" sections of `llm-integration.md`. You'll refine them as you build, but having them first means the doc and the code co-evolve instead of the doc chasing the code.

### Compounding returns

Documentation investment pays off more as the project grows. Each doc you write makes the next AI session more effective, which means less time re-explaining context, fewer incorrect assumptions, and more of your time spent on design decisions rather than correcting implementation details. Practitioners with large codebases consistently report that the more they document in markdown, the higher the percentage of code the AI handles correctly. The docs are not overhead — they are the leverage.
