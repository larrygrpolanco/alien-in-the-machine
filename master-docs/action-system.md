# Action System

## What This System Does

Actions are pure functions that transform world state: `(WorldState, args) → ActionResult`. Each action validates its preconditions, produces a new immutable state if those checks pass, and returns a human-readable message describing what happened. Actions never partially succeed and never mutate the input state.

## Design Principles

- **Pure functions, immutable state.** Every action takes the current `WorldState` and returns a new one. The old state is never mutated. This is what allows React to detect changes and what makes actions trivially testable.
- **Three-phase structure: CHECK → EXECUTE → REPORT.** Check validates preconditions and returns early on failure. Execute builds the new state. Report generates the message. An action that passes CHECK always succeeds — there are no partial failures.
- **Failure is always informative.** Every failed check returns a human-readable `message` explaining why. The caller (and eventually the LLM) always knows what went wrong.
- **The valid action list is derived, not guessed.** `getAvailableActions()` computes what the agent can do from current scope and entity features. No action appears unless its preconditions are satisfiable. This eliminates the LLM hallucinating invalid actions.

## Current Implementation

Each action is a standalone pure function in [zoo-1/src/actions/](../zoo-1/src/actions/). All return `ActionResult` (defined in [move-to.ts](../zoo-1/src/actions/move-to.ts)):

```ts
interface ActionResult {
  success: boolean
  state: WorldState
  message: string
}
```

Actions implemented:

| Function | File | What it does |
|---|---|---|
| `moveTo(state, agentId, destId)` | [move-to.ts](../zoo-1/src/actions/move-to.ts) | Move agent to connected room |
| `take(state, agentId, thingId)` | [take.ts](../zoo-1/src/actions/take.ts) | Add thing to agent inventory |
| `drop(state, agentId, thingId)` | [drop.ts](../zoo-1/src/actions/drop.ts) | Drop thing into current room |
| `open(state, containerId)` | [open.ts](../zoo-1/src/actions/open.ts) | Open a closed unlocked container |
| `close(state, containerId)` | [close.ts](../zoo-1/src/actions/close.ts) | Close an open container |
| `hideIn(state, agentId, containerId)` | [hide-in.ts](../zoo-1/src/actions/hide-in.ts) | Agent enters an enterable container |
| `emergeFrom(state, agentId)` | [emerge-from.ts](../zoo-1/src/actions/emerge-from.ts) | Agent exits container back to room |

**Known simplification:** There is no action registry. Actions are imported directly in [use-actions.ts](../zoo-1/src/actions/use-actions.ts) (the React hook) and dispatched via a manual `if/else` chain. `getAvailableActions()` in [available-actions.ts](../zoo-1/src/actions/available-actions.ts) also hardcodes which features gate which actions. When new actions are added, both files must be updated.

`getAvailableActions(state, agentId)` computes valid actions from scope + entity features. It checks selectional restrictions inline: a `take` action is only generated if `entity.kind === 'thing' && entity.isPortable && !entity.isFixed`. The output is an array of `AvailableAction` objects with `{name, targetId, label}`.

`useActions` in [use-actions.ts](../zoo-1/src/actions/use-actions.ts) is a React hook that wraps the pure action functions: it runs the action, updates the React state if it succeeded, and stores the message for display.

**Verified by:** [zoo-1/src/__tests__/actions.test.ts](../zoo-1/src/__tests__/actions.test.ts) — 20 tests covering all seven actions, including failure cases for fixed items, locked containers, already-open containers, and containment consistency.

## Key Decisions and Their Rationale

**Decision:** Each action function handles the two-part location update (both `entity.locationId` and `containment`) internally.
**Alternative considered:** A centralized `moveEntity(state, entityId, toId)` helper that enforces the invariant.
**Why this way:** Kept simple for Zoo 1 — each action is self-contained and readable end-to-end without jumping to a helper.
**Revisit if:** A fourth or fifth action produces a locationId/containment mismatch bug. At that point a `moveEntity` helper pays for itself.

---

**Decision:** `open` and `close` do not take an `agentId` parameter.
**Alternative considered:** All actions take `agentId` to enforce proximity checks.
**Why this way:** In Zoo 1 there is one agent and scope is validated at the available-actions layer — only in-scope containers appear in the action list. The action itself trusts that if it's being called, the container is reachable.
**Revisit if:** Zoo 5 introduces multi-agent scenarios where one agent might call `open` on a container not in their scope (e.g., remote control, network calls). At that point, proximity checks belong in the action's CHECK phase.

## Open Questions

- The action registry described in the zoo plan (section 3.3) was not implemented. Is it worth adding before Zoo 3, or can the LLM adapter work with `getAvailableActions()`'s output directly?
- `getAvailableActions()` generates a `label` string ("Take Keycard") for UI display. Zoo 3 will need a richer description ("Pick up the keycard from the desk") for LLM context. Should label generation stay in `available-actions.ts` or move to a separate description layer?
- Should actions validate that the target entity is in the agent's scope, or continue to trust the caller? Currently there's no scope check inside action functions.
