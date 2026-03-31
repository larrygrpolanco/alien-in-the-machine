# Room Descriptions (Zone Descriptions)

## What This System Does

`describeZone(state, agentId)` generates a structured, sectioned text description of what an agent perceives in their current location. It is the primary text source for both the UI and LLM prompts. The output is scannable and information-dense — optimized for comprehension over atmosphere.

## Design Principles

- **Structure over prose.** Sections (HEADER, FURNITURE, EXITS, INVENTORY) make relationships explicit. The LLM does not need to parse narrative sentences to understand what's on what or where exits lead.
- **One atmosphere line.** The room's `description` field appears as a single line under the header. It provides flavor without diluting mechanical information.
- **Cross-zone visibility is explicit.** Open borders and open doors list visible contents in the adjacent zone under a `Visible:` sub-line. This gives the LLM full spatial awareness without generating actions for unreachable entities.
- **Hidden agents get a minimal view.** When inside a container, the description collapses to just the container's contents — no room info, no borders.

## Current Implementation

`describeZone` lives in [zoo-2/src/world/describe.ts](../zoo-2/src/world/describe.ts). It is organized into small section functions:

- `describeHeader(room)` — `=== ROOM NAME ===`
- `describeFurniture(state, roomId, reachable)` — supporters (with contents) and containers (with state)
- `describeExits(state, roomId, perceivable)` — borders, door states, and visible adjacent contents
- `describeInventory(state, agentId)` — carried items
- `describeZone` orchestrates these, joining sections with blank lines

**Output format example (Laboratory, starting state):**

```
=== LABORATORY ===
A cramped research lab with flickering fluorescent lights. A heavy desk dominates one wall. A metal closet stands in the corner.

FURNITURE:
  Heavy Desk — On it: Keycard, Biosample Vial
  Metal Closet (closed)

EXITS:
  north: Security Door (locked)

INVENTORY:
  Keycard
```

**Output format example (Corridor, door open, looking both ways):**

```
=== MAINTENANCE CORRIDOR ===
A narrow service corridor. Pipes run along the ceiling. Emergency lighting casts everything in dull orange.

EXITS:
  south: Security Door (open) → Laboratory
    Visible: Heavy Desk (on it: Keycard, Biosample Vial), Metal Closet (closed)
  east: Open passage → Storage Bay
    Visible: Specimen Box (open)
```

**Output format example (Hidden inside container):**

```
=== INSIDE METAL CLOSET ===
Nothing else here.
```

**Verified by:** [zoo-2/src/__tests__/describe.test.ts](../zoo-2/src/__tests__/describe.test.ts) — covers section presence, cross-zone visibility, hidden state, and inventory display.

**Known simplification:** Furniture section only handles one level of nesting (items on supporters, items in containers). A container inside a container is not recursively described. This matches the scope computation limitation.

## Key Decisions and Their Rationale

**Decision:** Sectioned format over narrative prose.
**Alternative considered:** Prose-first descriptions in the style of interactive fiction ("You are in a cramped lab. A heavy desk dominates one wall...").
**Why this way:** Prose requires the LLM to parse sentences back into a mental model. Sections make relationships explicit — "On it:" directly maps containment, "(closed)" directly maps state. This is especially important for weaker models. The player also benefits from scannability.
**Revisit if:** The project pivots toward a narrative-driven game where atmosphere matters more than decision speed.

---

**Decision:** Adjacent room name shown even behind closed doors.
**Alternative considered:** Only show the door name, not where it leads.
**Why this way:** The door entity has a name ("Security Door") but the agent should know it leads to the Maintenance Corridor. The `→ RoomName` suffix on every exit line gives directional context without requiring the agent to have visited the adjacent room.
**Revisit if:** A scenario is needed where the agent genuinely doesn't know what's behind a door (mystery/horror). This would require a `isKnown` flag on borders.

## Open Questions

- Should the FURNITURE section include loose `Thing` entities (items on the floor)? Currently they are not listed in any section — they only appear if picked up. This is a gap.
- When the agent is hidden in an *open* container, should they see the room? Currently the hidden view is always minimal regardless of container state. This should probably change — an open container means the agent can see out and others can see in.
- Should there be a separate "ACTIONS" section in the description, or should actions remain a separate list? Currently `describeZone` only produces the world description; `listAvailableActions` is called separately. Combining them would make the prompt a single block but would couple description to action generation.
