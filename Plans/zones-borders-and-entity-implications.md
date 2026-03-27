# Zones, Borders, and Entity Model Implications

Research notes from analyzing the ALIEN RPG Cinematic Starter Kit against the current Zoo 1 architecture. These are design ideas to keep in mind — not implementation plans. The zones and borders section is targeted for Zoo 2. The entity model implications section is further out and should not complicate the incremental learning approach.

---

## Part 1 — Zones and Borders

### The Core Idea

Right now, rooms know their own exits via `exits: Record<string, string>`, where the key is a direction and the value is the destination room ID. This works, but it means there's no place to hang properties on the _connection itself_. If two rooms share a door, that door doesn't exist as a first-class entity — it's implied by the exit record on each room.

The ALIEN RPG makes an explicit distinction: a **zone** is a space (a room, a corridor, an area), and a **border** is the boundary between two adjacent zones. A border is either open (nothing blocking movement or sight) or blocked (a wall, a bulkhead). A blocked border can have a **door** or **hatch** — an entity that lives on the border and controls whether passage and perception are possible.

This maps cleanly onto something the zoo plan already anticipated but Zoo 1 didn't implement: the `Door` entity type from the Inform 7 hierarchy (`has: connectsRooms[2], isOpen, isLocked`). The insight is that a door isn't a thing _in_ a room — it's a thing _between_ two rooms, occupying a border.

### What Changes from the Current Model

**Currently:** Each `Room` has an `exits` record. Moving from lab to hallway means checking `room.exits['north'] === 'hallway'`. There's no door entity, no concept of a border.

**Proposed:** Introduce a `Border` relationship layer and optionally a `Door` entity kind.

A border connects exactly two zones. It has a type: `open` (unobstructed passage and sight), `wall` (no passage, no sight), or `door` (passage and sight depend on door state). When a door occupies a border, the door entity controls `isOpen`, `isLocked`, and potentially `isWelded` later.

The room's `exits` record either goes away entirely (replaced by a border lookup) or becomes derived from the border data. Either way, the border becomes the authoritative source for connectivity.

### Proposed Data Shape

```
WorldState
├── entities
│   ├── rooms:      { [id]: Room }
│   ├── things:     { [id]: Thing }
│   ├── containers: { [id]: Container }
│   ├── supporters: { [id]: Supporter }
│   ├── agents:     { [id]: Agent }
│   └── doors:      { [id]: Door }        ← new entity kind
├── borders:        Border[]               ← new relationship layer
├── containment:    { [parentId]: string[] }
└── meta
    ├── turn: number
    └── log: string[]
```

A `Border` is a relationship, not an entity. It connects two zone IDs and optionally references a door entity:

```ts
interface Border {
  id: string;
  between: [string, string]; // two room IDs, order doesn't matter
  type: 'open' | 'wall' | 'door';
  doorId?: string; // references a Door entity if type is 'door'
  direction: {
    // how each room refers to this border
    [roomId: string]: string; // e.g., { lab: 'north', hallway: 'south' }
  };
}
```

A `Door` is a proper entity with state:

```ts
interface Door {
  kind: 'door';
  id: string;
  name: string;
  description: string;
  isOpen: boolean;
  isLocked: boolean;
  // future: isWelded, isBarricaded, armorRating
}
```

### How This Affects Scope and Perception

This is where the real payoff comes. Right now, `computeScope` starts with the agent's room and looks at containment within that room. It has no concept of perceiving into adjacent rooms. With borders, perception expands:

**Open border:** The agent can see into the adjacent zone. Entities in the adjacent zone enter the agent's scope for perception (though not necessarily for physical interaction — you can _see_ the thing across the corridor but you'd need to `moveTo` before you can `take` it).

**Door border, door open:** Same as open border — the agent can see through the doorway into the adjacent zone. This is the ALIEN RPG rule: an open door doesn't block line of sight.

**Door border, door closed:** The border blocks perception. The agent cannot see into the adjacent zone. This is where things get strategically interesting — closing a door cuts off information flow in both directions. An agent hiding behind a closed door is invisible to agents on the other side.

**Wall border:** Permanent block. No passage, no perception.

This creates real tactical decisions: do you close the door behind you to hide, knowing that you also lose the ability to see what's coming? The scope system already handles open/closed gating for containers — this extends the same logic to the room-to-room level.

### How This Affects Movement

`moveTo` currently checks `room.exits[direction]` for a destination. With borders:

1. Find the border between the agent's current room and the destination.
2. If the border type is `wall`, movement is impossible.
3. If the border type is `open`, movement succeeds.
4. If the border type is `door`, check the door entity: `isLocked` blocks movement (need `unlock` action first), `!isOpen` blocks movement (need `open` action first), `isOpen && !isLocked` allows movement.

This is mechanically similar to what `moveTo` does now, but the precondition data lives on the border/door rather than being hardcoded or absent.

### How This Enables Future Mechanics

The border/door model opens up several mechanics that would be awkward without it:

**Welding doors shut.** A `weld` action sets a flag on the door entity. Once welded, the door cannot be opened from either side without cutting through it. This is a core ALIEN scenario mechanic — sealing off sections of a ship to control xenomorph movement.

**Listening through doors.** A closed door blocks visual scope but could allow auditory scope at a reduced fidelity. The border/door distinction makes it possible to query "is there a door between me and that sound?" without special-casing room logic.

**Breaching.** Destroying a door (reducing its armor to zero) converts a `door` border to an `open` border permanently. The door entity is removed or marked destroyed.

### Migration Path from Zoo 1

Step 1: Define the `Border` type and `Door` entity kind. Build the border array for the existing lab world — every exit pair becomes a border (most will be `open` type, some will be `door` type).

Step 2: Update `computeScope` to check borders for cross-room perception. This is additive — current scope logic stays the same for in-room entities; the new code adds adjacent-room entities when borders allow it.

Step 3: Update `moveTo` to check the border instead of `room.exits`. Add `open` and `close` actions for doors (these already exist for containers — the door versions are structurally identical).

Step 4: Once everything works through borders, remove the `exits` field from `Room` if desired, or keep it as a denormalized cache that's rebuilt from borders on world load.

### Scope Computation with Borders — Pseudocode

```
computeScope(state, agentId):
  agent = getEntity(state, agentId)
  currentRoom = resolveRoom(state, agent)  // handles agent-in-container case

  scope = []

  // 1. Everything in the current room (existing logic, unchanged)
  for each entity in containment[currentRoom.id]:
    add entity to scope
    if entity is supporter: add containment[entity.id] to scope
    if entity is container and (isOpen or !isOpaque): add containment[entity.id] to scope

  // 2. NEW: Cross-room perception via borders
  for each border where currentRoom.id is in border.between:
    adjacentRoomId = the other room in border.between
    canSeeThrough = false

    if border.type === 'open':
      canSeeThrough = true
    else if border.type === 'door':
      door = getEntity(state, border.doorId)
      if door.isOpen:
        canSeeThrough = true

    if canSeeThrough:
      // Add adjacent room entities to scope, but mark them as "visible, not reachable"
      // This distinction matters for action generation — you can see them but not interact
      for each entity in containment[adjacentRoomId]:
        add entity to scope with { perceivable: true, reachable: false }

  return scope
```

The `perceivable` vs `reachable` distinction is important. `getAvailableActions` should only generate actions for reachable entities (same room), but the room description generator and LLM context should include perceivable entities so the agent knows what's visible through open doorways.

### Open Questions for This Design

- Should borders be stored as a flat array or as an indexed lookup (e.g., `{ [roomId]: Border[] }`)? The flat array is simpler and the border count will be small. An index pays off only if border lookup becomes a hot path.
- When an agent is inside a container (hidden), should they perceive through borders at all? Probably not — if you're hiding in a closet, you shouldn't see through the room's doorway. This might fall out naturally if `computeScope` only checks borders when the agent is directly in a room.
- Should `Door` be its own entity kind, or a subtype of `Container`? Containers already have `isOpen` and `isLocked`. But doors don't have containment — you don't put things inside a door. A separate kind is cleaner even if there's property overlap.
- The ALIEN RPG has "zone features" like `cluttered`, `dark`, and `cramped` that modify actions within the zone. These map to room-level flags (`isLit`, `isCluttered`). Worth noting but not needed for Zoo 2.

---

## Part 2 — Entity Model Implications

### What This Section Is

This section catalogs properties and systems from the ALIEN RPG that would eventually map onto the entity model. None of this is a priority. It's here so that when the time comes to add these features, the schema decisions are informed rather than improvised, and so that current design choices don't accidentally close off these paths.

The general principle: properties that change at different rates should be separate fields, not bundled together. The ALIEN RPG makes this distinction clearly — attributes are near-permanent, skills grow slowly, stress fluctuates per-action, health depletes and recovers, and conditions toggle on and off. Each rate of change suggests a separate field or field group on the entity.

### Agent Properties — What Exists Now vs What's Coming

**Current Agent shape (Zoo 1):**

```ts
interface Agent {
  kind: 'agent';
  id: string;
  name: string;
  description: string;
  locationId: string;
  isHidden: boolean;
}
```

This is deliberately minimal. The additions below are organized by when they'd become relevant, not by priority.

#### Attributes (stable base stats)

The ALIEN RPG uses four attributes rated 1–5: Strength, Agility, Wits, Empathy. Each attribute serves as the base dice pool for its associated skills, determines damage thresholds, and gates certain actions.

For the simulation, attributes would be a small flat object on the agent:

```ts
attributes: {
  strength: number; // physical power, health capacity, stamina checks
  agility: number; // speed, stealth, ranged ability
  wits: number; // perception, technical skill, survival
  empathy: number; // social ability, command, medical skill
}
```

**Design note:** Attributes rarely change during a scenario. The ALIEN RPG modifies them only under extreme conditions (infection, mutation, android reveal). This stability means they can be set at world creation time and largely trusted as constants. They don't need the same update-tracking discipline as health or stress.

**When this matters:** When skill checks are introduced. The dice pool for any check is `attribute + skill`, so attributes must exist before skills can function. But attributes alone can be useful even without skills — an attribute-only check (roll Strength to force a jammed door) is the simplest form of non-binary action resolution.

#### Skills (slow growth)

The ALIEN RPG defines 12 skills, three per attribute:

| Attribute | Skills                                 |
| --------- | -------------------------------------- |
| Strength  | Heavy Machinery, Stamina, Close Combat |
| Agility   | Mobility, Piloting, Ranged Combat      |
| Wits      | Observation, Comtech, Survival         |
| Empathy   | Manipulation, Medical Aid, Command     |

Each skill is rated 0–5. A skill of 0 is legal — you just roll the raw attribute.

For the simulation, not all 12 skills are equally relevant. A reasonable starting subset might be:

| Skill        | Why it matters for the simulation                      |
| ------------ | ------------------------------------------------------ |
| Mobility     | Stealth, sneaking past enemies, escaping grapples      |
| Observation  | Spotting hidden entities, examining things for detail  |
| Comtech      | Interacting with computers, locked electronic systems  |
| Close Combat | Melee attacks when combat is introduced                |
| Manipulation | Social actions between agents in multi-agent scenarios |
| Command      | Ordering NPCs, calming panicked agents                 |
| Medical Aid  | Healing, stabilizing broken agents                     |

The skill set can start smaller and grow. The data shape is just a flat map:

```ts
skills: {
  mobility: number;
  observation: number;
  comtech: number;
  // ... add as needed
}
```

**Design note:** Skills don't change during a typical scenario in cinematic play. They're set at character creation. In campaign play they advance between sessions. For the simulation, treat them like attributes — set once, read often.

**When this matters:** When actions need non-binary outcomes. Currently, `take` either succeeds or fails based on preconditions. A skill check would mean: `take` is _available_ if preconditions pass (the thing is portable, in scope, etc.), but _succeeds_ based on a skill roll. The CHECK phase gates availability; the skill check determines success within EXECUTE. This is the key insight — skills slot into the existing action architecture without restructuring it.

#### Health (rapid depletion and recovery)

In the ALIEN RPG, health starts equal to Strength (typically 3–5 points). Damage reduces it. At zero, the character is "Broken" — unable to act, suffering a critical injury roll.

For the simulation:

```ts
health: number;
maxHealth: number; // usually derived from attributes.strength, but talents can modify
```

**Design note:** Health changes frequently — potentially every round of combat. It's the most volatile numeric property on an agent. This is why it should be a top-level field, not buried inside an attributes object. It needs to be trivially accessible and cheaply updatable.

**When this matters:** When combat or environmental hazards are introduced. If agents can take damage, they need health. If they can be Broken, the action system needs a check: "is this agent Broken? If so, they can only crawl and mumble." This is a precondition check — it fits naturally into the CHECK phase.

#### Stress (the dual-edged mechanic)

This is the most interesting system in the ALIEN RPG from a simulation design perspective. Stress is a number that starts at zero and increases when bad things happen (taking damage, pushing a skill roll, seeing something terrifying, a crewmate attacking you). The twist: stress dice are _added to your skill rolls_, so higher stress means higher chance of success — but also higher chance of triggering a panic roll.

The panic roll is `D6 + current stress level`, checked against a table ranging from "keeping it together" (6 or under) to "catatonic" (15+). Mid-range results include involuntary actions: freezing, fleeing, screaming, attacking the nearest person.

For the simulation:

```ts
stress: number; // 0 to ~10+, increases over time, reducible by rest or signature item
```

**Why this is foundationally interesting:** Stress creates emergent behavior. An agent with high stress is simultaneously more capable (better rolls) and more dangerous (might panic and do something irrational). For an LLM-driven agent, stress could modify the prompt context: "Your stress level is 7. You are on edge. Your hands are shaking but your senses are sharp." The LLM's action selection would naturally shift based on this framing. For a rules-driven agent, stress modifies the dice pool directly.

**What triggers stress increases (adapted from ALIEN):**

- Taking damage
- Pushing a failed skill roll (retrying with added risk)
- Witnessing a crewmate get hurt or killed
- Encountering an unknown hostile entity
- A crewmate revealed to be an android
- Being attacked by a supposed ally
- Environmental extremes (vacuum, fire, darkness)

**What reduces stress:**

- Resting in a safe, secured area (one stress per turn of rest)
- Interacting with a signature item (once per act/session)
- Certain pharmaceutical items

**When this matters:** Stress is interesting at any point where agents have meaningful choices. Even without full combat, stress could gate actions: a stress-0 agent is calm and methodical; a stress-8 agent might have "flee" as an available action that a calm agent wouldn't. But this is definitely a later addition — it requires the skill check system to be in place first, since stress modifies skill rolls.

#### Conditions (boolean status flags)

The ALIEN RPG defines four conditions: Starving, Dehydrated, Exhausted, Freezing. Each is a boolean flag that blocks recovery and imposes periodic checks. They toggle on when a need is unmet and toggle off when the need is met again.

For the simulation:

```ts
conditions: {
  starving: boolean;
  dehydrated: boolean;
  exhausted: boolean;
  freezing: boolean;
  // future: poisoned, irradiated, infected
}
```

Or, if you prefer a set approach:

```ts
conditions: string[]  // e.g., ['starving', 'exhausted']
```

**Design note:** The set approach is more flexible (add new conditions without changing the type) but loses type safety. The object approach is safer for TypeScript narrowing. Given the project's commitment to type-driven design, the object approach is probably better — or a discriminated union of condition types.

**When this matters:** When the world has environmental pressure. If rooms have `isLit: false` or the ship loses life support, conditions become the mechanism for tracking deterioration. They're simple to implement — just boolean fields that the action system checks during precondition validation and the description generator includes in narrative.

### Thing Properties — What's Coming

**Current Thing shape (Zoo 1):**

```ts
interface Thing {
  kind: 'thing';
  id: string;
  name: string;
  description: string;
  locationId: string;
  isPortable: boolean;
  isFixed: boolean;
}
```

The ALIEN RPG gear tables suggest several properties that things might eventually carry:

#### Usability Properties

```ts
// For weapons
bonus: number; // modifier to the relevant skill check when using this thing
damageRating: number; // base damage on successful attack
range: 'engaged' | 'short' | 'medium' | 'long' | 'extreme';
isAutomatic: boolean; // can fire bursts (adds stress, adds dice)

// For armor
armorRating: number; // dice rolled to reduce incoming damage

// For tools and equipment
skillBonus: {
  // which skill this item gives a bonus to, and how much
  skill: string;
  modifier: number;
}

// For consumables
supply: number; // current supply rating, depletes on use/check
consumableType: 'air' | 'water' | 'food' | 'power';
```

**Design note:** Not all things need all these fields. The discriminated union pattern already handles this — a `Weapon` kind would have `damageRating` and `range`; a `Tool` kind would have `skillBonus`; a `Consumable` kind would have `supply`. The question is whether to introduce new entity kinds or add optional properties to `Thing`.

**Recommendation:** Don't add new entity kinds for this. Instead, use an optional `properties` bag or feature flags on `Thing`. The kind hierarchy is already five kinds deep — adding `Weapon`, `Armor`, `Tool`, `Consumable` as separate dictionary tables would fragment the entity store. Better to keep them as `Thing` entities with optional typed properties:

```ts
interface Thing {
  kind: 'thing';
  id: string;
  name: string;
  description: string;
  locationId: string;
  isPortable: boolean;
  isFixed: boolean;
  // optional gear properties
  damageRating?: number;
  armorRating?: number;
  supply?: number;
  skillBonus?: { skill: string; modifier: number };
}
```

This keeps the entity lookup simple (`entities.things`) and uses TypeScript's optional properties to express "this thing happens to be a weapon" without a whole new kind. The action system's selectional restrictions can check for the presence of these optional fields: a `fire` action requires `target.damageRating !== undefined && target.range !== undefined`.

**When this matters:** When gear has mechanical effects beyond "you have it or you don't." In Zoo 1–3, carrying a keycard is binary — it's in inventory or it isn't. Once skill checks exist, gear that gives bonuses to checks becomes meaningful.

### The Signature Item Concept

One small detail from the ALIEN RPG worth flagging: each character has a **signature item** — a small personal object (a photo, a patch, a lucky coin) with no mechanical function except that interacting with it reduces stress by one. Once per act.

This is elegant because it's a named, typed entity that does nothing except exist in the emotional layer of the simulation. For an LLM agent, the signature item is a prompt hook: "You clutch the photograph of your daughter. Your stress decreases by 1." The action is `use(signature_item)`, and the mechanical effect is `stress -= 1`. But the narrative weight is disproportionate to the mechanic — and that's what makes it interesting for LLM-driven agents, who respond strongly to narrative framing.

No schema implication now. Just worth remembering that not every item needs a mechanical function to be meaningful in an LLM-driven simulation.

### How Skills Slot Into the Existing Action Architecture

This is the key architectural question, so it's worth sketching out concretely even though implementation is not imminent.

**Current action flow:**

```
getAvailableActions(state, agentId)
  → checks scope + entity features
  → returns AvailableAction[] with { name, targetId, label }

performAction(state, actionName, args)
  → CHECK: validates preconditions (binary pass/fail)
  → EXECUTE: builds new state
  → REPORT: generates message
  → returns ActionResult { success, state, message }
```

**With skills added:**

```
getAvailableActions(state, agentId)
  → checks scope + entity features (UNCHANGED)
  → returns AvailableAction[] (UNCHANGED — skills don't affect availability)

performAction(state, actionName, args)
  → CHECK: validates preconditions (UNCHANGED — still binary pass/fail)
  → RESOLVE: rolls skill check if action requires one (NEW PHASE)
       → if check fails: return { success: false, state (unchanged), message (failure narrative) }
       → if check succeeds: determine degree of success (stunts)
  → EXECUTE: builds new state, incorporating degree of success
  → REPORT: generates message reflecting outcome quality
  → returns ActionResult { success, state, message }
```

The new RESOLVE phase sits between CHECK and EXECUTE. CHECK answers "can you attempt this?" — RESOLVE answers "did you pull it off?" This is additive. Actions that don't require a skill check (like `take` for an unguarded item or `moveTo` through an open border) skip RESOLVE entirely and behave exactly as they do today.

The RESOLVE function itself:

```ts
interface SkillCheck {
  attribute: 'strength' | 'agility' | 'wits' | 'empathy';
  skill: string;
  difficulty: number; // modifier to dice pool
  opposedBy?: string; // for opposed rolls: the opposing entity's skill
}

interface CheckResult {
  passed: boolean;
  successes: number; // how many dice hit (for stunt calculation)
  panicTriggered: boolean; // did stress dice cause a panic?
}
```

**What doesn't change:** The entity model, the containment system, the scope computation, the available actions generator. Skills are a layer _on top of_ the existing binary precondition system, not a replacement for it.

### Summary — Rates of Change

| Property               | Rate of Change                   | When It Matters                          |
| ---------------------- | -------------------------------- | ---------------------------------------- |
| `attributes`           | Near-permanent                   | When skill checks are introduced         |
| `skills`               | Stable within a scenario         | When actions need non-binary resolution  |
| `health`               | Volatile (per-combat-round)      | When damage/combat is introduced         |
| `stress`               | Volatile (per-action)            | When emotional pressure affects behavior |
| `conditions`           | Toggle on/off by situation       | When environmental hazards exist         |
| `gear properties`      | Stable (item stats don't change) | When items affect skill checks           |
| `supply` (consumables) | Depletes on periodic checks      | When resource scarcity is a mechanic     |

The current Agent entity has none of these except `locationId` and `isHidden`. Each can be added independently, as a new field, without restructuring the existing type. The flat entity model supports this naturally — adding a field to `Agent` is a one-line type change plus world data updates. No migration, no nesting to unwind.
