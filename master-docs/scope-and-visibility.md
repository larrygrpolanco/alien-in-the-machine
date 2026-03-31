# Scope and Visibility

## What This System Does

Scope is the set of entities an agent can currently perceive and act on. It is computed on demand from world state — never stored. `computeScope(state, agentId)` returns a `ScopeResult { reachable, perceivable }` that separates entities the agent can act on from entities the agent can only see.

## Design Principles

- **Scope is computed, not stored.** Deriving scope from state means it automatically reflects container open/close events and room transitions without any manual cache invalidation.
- **Containers gate visibility.** An open or transparent container exposes its contents. A closed opaque container hides them. Supporters are always transparent.
- **Reachable vs perceivable is a critical split.** Reachable entities are in the agent's zone (or doors on adjacent borders) — actions can target them. Perceivable entities are visible through open borders/doors but in an adjacent zone — the agent can see them but cannot act on them. `getAvailableActions` uses only `reachable`. `describeZone` uses both.
- **The scope result drives the valid action list.** If an entity is not in `reachable`, no action for it appears. This eliminates hallucinated actions entirely.

## Current Implementation

`computeScope` lives in [zoo-2/src/world/scope.ts](../zoo-2/src/world/scope.ts). Zoo-2 changes from zoo-1:

- Returns `ScopeResult { reachable, perceivable }` instead of a flat `string[]`
- Borders replace `room.exits` as the sole connectivity source
- Doors on borders are always added to `reachable` (agent can interact with a door from either side)
- Cross-zone perception: open borders and open doors reveal adjacent room contents into `perceivable`

**Algorithm:**

1. If agent is hidden: scope is limited to container contents only. Return `{ reachable: inside, perceivable: [] }`.
2. Otherwise, iterate `containment[roomId]`:
   - Add each entity to `reachable`.
   - If it's a **supporter**: add everything on it to `reachable` (supporters are transparent).
   - If it's a **container**: if `isOpen || !isOpaque`, add contents to `reachable`. Otherwise skip.
3. Iterate `state.borders` for the current room:
   - If border type is `'door'`: add `doorId` to `reachable`.
   - If border is passable (type `'open'` or door is open): add adjacent room contents to `perceivable`, recursing into supporters and open/transparent containers.

**Verified by:** [zoo-2/src/__tests__/scope.test.ts](../zoo-2/src/__tests__/scope.test.ts) — covers reachable (room contents, supporters, containers, border doors), perceivable (closed door blocks, open door reveals, open border reveals), and hidden agent scope collapse.

**Known simplification:** Scope computation does not check lighting (`isLit` on rooms). All rooms are treated as fully lit.

**Known simplification:** Only one level of nesting is handled. A container inside a container is not recursively resolved.

## Key Decisions and Their Rationale

**Decision:** Scope returns `{ reachable, perceivable }` instead of a flat array.
**Alternative considered:** Keep flat array, filter by location in `getAvailableActions`.
**Why this way:** A flat array loses the distinction between "can act on" and "can see through a doorway." `describeZone` needs both sets to describe visible-but-unreachable entities. The split is a clean boundary — no risk of accidentally generating actions for perceivable-only entities.
**Revisit if:** A third perception tier is needed (e.g., "can hear but not see").

---

**Decision:** Doors are reachable from both adjacent rooms.
**Alternative considered:** Door belongs to one room; only agents in that room can interact with it.
**Why this way:** An agent can open, close, or unlock a door without stepping through it. The door lives on the border — neither room "owns" it. Reachability from either adjacent room is the correct model.
**Revisit if:** Asymmetric door interaction is needed (e.g., a one-way mirror or a door that can only be opened from one side).

---

**Decision:** Scope is computed fresh on every call, not memoized or cached.
**Alternative considered:** Cache scope and invalidate on relevant state changes.
**Why this way:** The world is small enough that recomputation is negligible. Caching would require tracking which state changes affect scope — unnecessary complexity.
**Revisit if:** The world grows large enough that scope computation is measurably slow (many hundreds of entities in a room's containment chain).

## Open Questions

- When agent is hidden in an *open* container: should they see the room? Currently they don't — scope only looks at `containment[agent.locationId]`. This is correct for an opaque closed closet, but an open container should probably allow bidirectional visibility.
- Zoo 5 adds a second agent. Their scope must be computed independently. The function signature already supports this, but it has not been tested with two simultaneous agents and one hidden.
- Should perceivable entities include the *names* of adjacent rooms in the scope result, or is that purely a description-layer concern? Currently `perceivable` is just entity IDs — the room name is looked up by `describeZone`.
