# Scope and Visibility

## What This System Does

Scope is the set of entities an agent can currently perceive and act on. It is computed on demand from world state — never stored. `computeScope(state, agentId)` returns an array of entity IDs. Anything not in that array is invisible to the agent.

## Design Principles

- **Scope is computed, not stored.** Deriving scope from state means it automatically reflects container open/close events and room transitions without any manual cache invalidation.
- **Containers gate visibility.** An open or transparent container exposes its contents. A closed opaque container hides them. Supporters are always transparent.
- **The scope array drives the valid action list.** `getAvailableActions()` iterates over scope to generate what the agent can do. If an entity is not in scope, no action for it appears.

## Current Implementation

`computeScope` lives in [zoo-1/src/world/scope.ts](../zoo-1/src/world/scope.ts). The algorithm:

1. Get the agent's `locationId` — the room (or container) they're in.
2. Get `containment[locationId]` — everything directly in that room.
3. For each item in the room:
   - Add it to scope unconditionally.
   - If it's a **supporter**: add everything in `containment[supporterId]` (supporters are always transparent).
   - If it's a **container**: if `isOpen || !isOpaque`, add `containment[containerId]`. Otherwise skip contents.

This handles one level of nesting. Items inside a container inside a supporter (e.g., a box on a desk) are not handled.

**Agent inside a container:** When `agent.locationId` is a container ID (after `hideIn`), the same algorithm runs — `containment[containerId]` gives the items also inside the container. The agent does not automatically see the room they're hidden in; they only see what's inside the container with them. This is the correct behavior for an opaque closet.

**Verified by:** [zoo-1/src/__tests__/actions.test.ts](../zoo-1/src/__tests__/actions.test.ts) → `describe('hideIn / emergeFrom')` — the hiding tests verify that containment and locationId are updated consistently, which is what scope depends on. No standalone scope unit tests exist.

**Known simplification:** Scope computation does not check lighting (`isLit` on rooms) — the zoo plan mentions it but it was not implemented. All rooms are treated as fully lit.

**Known simplification:** Scope is not partitioned per-agent in the current UI — `computeScope` is called once for the player. Zoo 5 will need it called independently for each agent, which the function already supports (it takes `agentId` as a parameter).

## Key Decisions and Their Rationale

**Decision:** Scope is computed fresh on every render, not memoized or cached.
**Alternative considered:** Cache scope and invalidate on relevant state changes.
**Why this way:** React re-renders when state changes anyway, so recomputing scope costs nothing extra. Caching would require tracking which state changes affect scope — unnecessary complexity.
**Revisit if:** The world grows large enough that scope computation is measurably slow (many hundreds of entities in a room's containment chain).

---

**Decision:** Scope contains entity IDs, not entity objects.
**Alternative considered:** Return the full entity objects.
**Why this way:** IDs are cheaper to pass around and sufficient for the downstream use cases: `getAvailableActions()` uses IDs to look up entities, and the UI checks `scope.includes(id)` for visibility decisions.

## Open Questions

- Scope currently handles one level of container nesting. If a container holds another container, the inner container's contents are not computed. Is multi-level nesting needed before Zoo 3?
- When agent is hidden in a container: should they see into the room if the container is open? Currently they don't — `computeScope` only looks at `containment[agent.locationId]`. This is probably correct for the scenario (you're hiding, you're not peeking out), but it's untested explicitly.
  - This will have to be fixed if the container is open then the agent can see the room and others can see it.
- Zoo 5 adds a second agent. Their scope must be computed independently. The function signature already supports this, but it has not been tested with two simultaneous agents and one hidden.
