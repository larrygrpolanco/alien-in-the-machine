# Zoo 1 — Manual Action Testing

A small, two-room zoo built on a clean Vite + React + TypeScript install. The goal is to understand how a simulated world works as data, step by step, with everything typed in manually so nothing is a black box.

## The World

Two rooms. A few items. One agent. You type actions, you see what happens.

```
Lab (starting room)
├── Desk (supporter, fixed)
│   └── Keycard (portable)
└── Closet (container, closed, opaque, enterable)

Hallway (connected to Lab via north exit)
└── Door (locked, needs keycard)
```

## Phases

Each phase builds on the previous one. Finish one before moving to the next.

### Phase 1 — Entity Types

Define the TypeScript types that shape the world. No logic yet, just the data structures.

- `Room` — id, name, description, exits
- `Thing` — id, name, description, locationId, isPortable, isFixed
- `Container` — extends Thing, adds isOpen, isLocked, isOpaque, isEnterable
- `Supporter` — extends Thing, adds capacity
- `Agent` — id, name, locationId, inventory
- `WorldState` — flat dictionaries of rooms, things, containers, agents + containment relationships

**Learn:** Does the type system catch mistakes before you run anything?

### Phase 2 — World Data

Hand-write a JSON file defining the Lab and Hallway with their items. Load it into React state. Nothing interactive yet — just get the data in and verify it looks right.

**Learn:** Is the flat structure readable? Does it feel awkward or natural?

### Phase 3 — Render the World

Display the current room name, description, and a list of things in it. Pure read-only. No actions, no clicking — just "can I see what's happening?"

- Show room name and description
- List items in the room (things on supporters, things in open containers)
- Show agent inventory

**Learn:** What information is visible? What's missing from the display?

### Phase 4 — Scope Computation

Implement `computeScope(state, agentId)` — the function that determines what an agent can currently perceive.

Rules:
1. Things directly in the room
2. Things on supporters (always visible)
3. Things in open containers (visible)
4. Things in closed opaque containers (hidden)

Scope is computed, not stored. It answers: "given this world state, what does the agent know about right now?"

**Learn:** Does the scope system correctly hide/reveal entities as containers open and close?

### Phase 5 — Move Action

First real interaction. Implement `move_to(roomId)`.

```
CHECK:   Does an exit connect current room to destination?
EXECUTE: Update agent's locationId
REPORT:  "You walk north to the Hallway."
```

Show the available exits as clickable buttons. Clicking one moves the agent and updates the display.

**Learn:** Does the three-phase pattern (check/execute/report) feel right? Is the state transition clean?

### Phase 6 — Take & Drop

`take(itemId)` and `drop(itemId)`.

```
CHECK:   Is the item in scope? Is it portable? Not already held?
EXECUTE: Move item to agent inventory (or back to room)
REPORT:  "You pick up the keycard." / "You drop the keycard."
```

**Learn:** How does inventory tracking work with the flat structure? Where does a dropped item "go" — the room or the supporter it was on?

### Phase 7 — Open, Close, Hide

`open(containerId)`, `close(containerId)`, `hide_in(containerId)`.

- Opening a container reveals its contents in scope
- Closing an opaque container hides its contents
- Hiding moves the agent into the container (isHidden flag)

**Learn:** Does scope correctly update when containers change state? Does hide_in work as expected?

### Phase 8 — Action List + Edge Cases

Auto-generate available actions from scope + entity features. Show them as clickable buttons. Add unit tests for:

- Taking a fixed object (should fail)
- Opening an already-open container (should fail)
- Hiding in a closed container (should fail)
- Moving through a locked door (should fail)
- Moving without an exit (should fail)

**Learn:** Are your preconditions complete? Does the action list generation produce only valid actions?

## File Structure

```
/src
  /types          — TypeScript types for entities and world state
  /world          — World state management, scope computation
  /actions        — Action implementations (check/execute/report)
  /ui             — React components for display and interaction
/worlds           — JSON world definition files
```

## What Comes After

Once Zoo 1 is solid, the next step is Zoo 2 (room description generation) and Zoo 3 (first LLM agent). But Zoo 1 must be reliable first — everything after depends on actions being correct.
