# Entity Model

## What This System Does

The world is stored as a flat, normalized data structure: every entity lives in a typed dictionary keyed by its ID, and spatial relationships are tracked in a separate containment index. This lets any entity be looked up in O(1) time, moved by changing one field, and compared across states without deep-tree traversal.

## Design Principles

- **Flat, normalized storage.** No entity is nested inside another in the data. A closet is not a field on a room — it's a separate entry in `entities.containers`, and the room-closet relationship lives in `containment`.
- **Single source of ID truth.** Every entity reference is done by ID. No object references, no nested duplication.
- **Two-part location invariant.** An entity's location is tracked in two places that must agree: `entity.locationId` (what the entity says its parent is) and `containment[parentId]` (what the parent says it contains). Both must be updated together on every move, or bugs appear.
- **Kind discrimination via `kind` field.** `Entity` is a TypeScript discriminated union. The `kind` field lets TypeScript narrow types at compile time — checking `entity.kind === 'container'` makes `isOpen`, `isLocked`, etc. available without casting.
- **Computed state is not stored.** Scope, inventory lists, and similar derived views are computed on demand. They are never stored in `WorldState`.

## Current Implementation

Entity types are defined in [zoo-1/src/types/entities.ts](../zoo-1/src/types/entities.ts). The five entity kinds:

| Kind | Key properties | Lives in |
|---|---|---|
| `Room` | `exits: Record<string, string>` | `entities.rooms` |
| `Thing` | `locationId`, `isPortable`, `isFixed` | `entities.things` |
| `Container` | `isOpen`, `isLocked`, `isOpaque`, `isEnterable` | `entities.containers` |
| `Supporter` | `capacity` | `entities.supporters` |
| `Agent` | `locationId`, `isHidden` | `entities.agents` |

`WorldState` shape:

```
WorldState
├── entities
│   ├── rooms:      { [id]: Room }
│   ├── things:     { [id]: Thing }
│   ├── containers: { [id]: Container }
│   ├── supporters: { [id]: Supporter }
│   └── agents:     { [id]: Agent }
├── containment:    { [parentId]: string[] }
└── meta
    ├── turn: number
    └── log: string[]
```

`getEntity(state, id)` in [zoo-1/src/world/entities.ts](../zoo-1/src/world/entities.ts) looks up any entity across all tables with a sequential OR — this is fine for the current entity count but is not indexed.

The world data for Zoo 1 is in [zoo-1/src/worlds/lab-world.ts](../zoo-1/src/worlds/lab-world.ts). It is hand-written TypeScript, not JSON.

**Known simplification:** `Agent` does not yet have an `inventory` array field — inventory is derived by filtering `entities.things` for items whose `locationId === agentId`. This works but means inventory queries scan all things rather than checking a list.

**Known simplification:** `meta.log` is typed as `string[]` and currently unused. A richer `ActionLogEntry` type will be needed once there's a turn history to replay.

## Key Decisions and Their Rationale

**Decision:** Containment is a separate relationship index (`containment: { [parentId]: string[] }`), not a property on entities.
**Alternative considered:** Each entity stores a `contains: string[]` array.
**Why this way:** The index lets you answer "what's inside X?" with one lookup. An entity cannot accidentally appear in two containers, because the source of truth is centralized. Moving an entity touches two entries in `containment` (remove from old parent, add to new parent) plus the entity's `locationId` — explicit and auditable.
**Revisit if:** Synchronizing `locationId` and `containment` on every action becomes a recurring bug source. If three or more actions in a row produce containment/locationId mismatches, consider a helper function that enforces the invariant as a transaction.

---

**Decision:** Agent location (`locationId`) can point to either a room or a container.
**Alternative considered:** Agents always have a `roomId` field distinct from their physical container.
**Why this way:** It's the simplest representation — the agent is inside something, and that something has an ID. The `isHidden` flag signals that the agent is inside a container rather than a room.
**Revisit if:** You need to answer "which room is this agent in?" efficiently when they might be nested inside a container inside a room. Currently this requires looking up the container's `locationId` to find the parent room — one extra hop. In multi-agent scenarios with many hidden agents this could get messy.

## Open Questions

- Does the supporter need a `capacity` field in practice? It was defined but no capacity enforcement is implemented or tested.
- When Zoo 5 introduces two agents, hidden agent visibility must be derived from scope computation, not from a flag on the agent. Currently `isHidden` exists as a flag — is it actually needed, or is "agent is in scope or not" sufficient?
  - On the isHidden flag question you raised in entity-model.md — your own open question is pointing you toward the right answer. isHidden is redundant with scope computation: if an agent is inside a closed opaque container, they're not in scope for other agents, period. The flag is a shortcut that works fine with one agent but will create a second source of truth in Zoo 5. You don't need to rip it out now, but mentally note that scope computation should be the authority on visibility, and isHidden is just a rendering convenience.
- Should `meta.log` store structured `ActionLogEntry` objects (turn, agentId, action, result) or continue as plain strings? This matters for Zoo 4 memory construction.
