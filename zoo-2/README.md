# Zoo-2 — Zones, Borders & Description Layer

## What This Zoo Is

Zoo-1 proved that pure action functions work as reliable state transitions. Zoo-2 extends the model in two directions and keeps everything manually testable — no LLM involved.

**Change 1: Zones and Borders.** `room.exits` is replaced by a `borders` array on `WorldState`. Each border is either `open` (unobstructed), `wall` (permanent block), or `door` (a `Door` entity controls passage and sight). This makes doors first-class entities with state (`isOpen`, `isLocked`), and it enables cross-zone perception — an open border or open door lets the agent see into the adjacent zone.

**Change 2: Description layer.** `describeZone(state, agentId)` generates the natural language passage that Zoo-3 will hand to the LLM. It spans multiple zones when borders are open. `listAvailableActions` (re-exported from `available-actions`) produces the structured action list the LLM will choose from.

---

## World: Lab → Corridor → Storage

```
Laboratory ─[north_door: door, locked]─ Maintenance Corridor ─[open]─ Storage Bay
```

| Entity | Location | Notes |
|---|---|---|
| Keycard | on desk (Lab) | unlocks north_door |
| Biosample Vial | on desk (Lab) | put into specimen_box |
| Heavy Desk | Lab | supporter, fixed |
| Metal Closet | Lab | container, enterable, opaque — for hiding |
| Security Door | border lab↔corridor | Door entity: locked, keyItemId: keycard |
| Specimen Box | Storage | container, open — for put_in |

---

## Stages

### Stage 1 — Types + scaffold ✓
New types: `Door`, `Border`, `ScopeResult`. `Room` loses `exits`. `WorldState` gains `doors` table and `borders` array. Fresh Vite/React project in `zoo-2/`.

### Stage 2 — Action system ✓
- `moveTo`: looks up border between rooms; checks door state if `border.type === 'door'`
- `open` / `close`: generalized for both `Container` and `Door` kinds
- `put_in` (new): place held item into an open container
- `unlock` (new): use a held key item to unlock a Door or Container
- All zoo-1 actions (`take`, `drop`, `hideIn`, `emergeFrom`) ported with minimal changes

### Stage 3 — Scope & visibility ✓
`computeScope` returns `ScopeResult { reachable, perceivable }` instead of a flat string array.
- **reachable**: entities in the current zone + doors on adjacent borders
- **perceivable**: entities visible through open borders / open doors (cannot act on these)
- Hidden agents: scope limited to container contents only; no borders visible

### Stage 4 — Description layer ✓
- `describeZone(state, agentId)`: structured, sectioned text output (HEADER, FURNITURE, EXITS, INVENTORY). Optimized for LLM comprehension and human scannability.
- `listAvailableActions(state, agentId)`: structured action list (re-export of `getAvailableActions`)
- Both functions live in `src/world/describe.ts` — Zoo-3 imports from here for prompt construction

### Stage 5 — UI ✓
`App.tsx` shows the `describeZone` output as the primary "view". Available actions are a numbered clickable list. Scope (reachable/perceivable split) and full world state are in collapsible debug panels.

### Stage 6 — SVG World Map ✓
`WorldMap` component (`src/ui/world-map.tsx`) renders a minimal map above the zone description. Rooms are boxes, borders are connecting lines (solid green = open, dashed orange = door), and the agent is a green dot. Layout is auto-computed from border `direction` fields via BFS. Useful for debugging agent position and border state at a glance; will be the visual layer when the LLM takes control in Zoo-3.

---

## Running

```sh
bun install
bun test       # 58 tests across 3 files
bun run dev    # visual manual test in browser
```

---

## Test Coverage (58 tests)

| File | Coverage |
|---|---|
| `actions.test.ts` | moveTo (borders, locked/closed/open), take, drop, open/close (Container+Door), hideIn, emergeFrom, putIn, unlock |
| `scope.test.ts` | reachable (room contents, supporters, containers, border doors), perceivable (closed door blocks, open door reveals, open border reveals), hidden agent |
| `describe.test.ts` | describeZone output, cross-zone visibility, available action generation (unlock, putIn, move gate) |

---

## Manual Test Scenario

1. Start in Lab — see `=== LABORATORY ===` header, FURNITURE section with Heavy Desk (Keycard, Biosample Vial) and Metal Closet (closed), EXITS section with Security Door (locked).
2. Take Keycard. INVENTORY section now shows Keycard. Available actions include "Unlock Security Door".
3. Unlock Security Door. Then open it. EXITS section now shows `Security Door (open) → Maintenance Corridor`.
4. Move north to Corridor. Can see Lab (through open door, south) and Storage (open border, east). EXITS shows Visible sub-lines for both directions.
5. Move east to Storage. Take Biosample if you brought it; put it in Specimen Box.
6. Return to Lab. Open Metal Closet. Hide inside. View collapses to `=== INSIDE METAL CLOSET ===`.

---

## Key Decisions

**Why remove `room.exits` entirely?** Having exits on rooms and a separate door entity created two sources of truth for connectivity. Borders are the single source. Movement, scope, and description all read from one place.

**Why are doors reachable from both sides?** An agent can open, close, or unlock a door without stepping through it. The door lives on the border — neither room "owns" it. Reachability from either adjacent room is the correct model.

**Why `perceivable` vs `reachable`?** Seeing something and being able to act on it are different. You can see the Specimen Box through the open corridor from Corridor, but you'd need to walk into Storage to pick it up. The LLM needs both pieces of information: the description (what you see) and the action list (what you can do).

**Why `describeZone` and not `describeRoom`?** When borders are open, the output spans multiple zones. The name reflects the function's actual scope.

**Why sectioned output?** The format uses labeled sections (HEADER, FURNITURE, EXITS, INVENTORY) instead of narrative prose. This makes relationships explicit — "On it:" shows containment, "(closed)" shows state, "→ RoomName" shows destination. Both the LLM and human players can scan the output instantly. Prose is reduced to a single atmosphere line.
