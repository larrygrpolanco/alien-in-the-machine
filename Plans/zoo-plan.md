# Agent World Simulation — Zoo Plan

## Philosophy

This project is a learning vehicle. The goal is not to ship a game but to deeply understand three things: how to model a simulated world as data, how to let AI agents act within that world, and how memory and knowledge shape decision-making. Each "zoo" is a small, disposable experiment — a contained test environment built to answer a specific question. We build it, run it, learn from it, and either keep it as reference or throw it away.

The foundational bet: **if the world model is clean, everything else gets easier.** A well-structured world is easy to serialize, easy to diff, easy to feed to an LLM, and easy to test without one. So the world model comes first, and it comes before any AI touches it.

---

## Part 1 — The World Model

### 1.1 Core Principle: Normalized Flat Entities

The world is stored as a flat, normalized data structure — the same pattern used in Redux stores and relational databases. Every entity has a unique ID. Relationships between entities are expressed through ID references, never through nesting.

**Why not nested JSON?**

Nested structures feel intuitive at first ("a room contains a closet which contains a person") but they create real problems: updating an entity means finding it deep in a tree, the same entity can accidentally exist in two places, and the LLM receives a tangled hierarchy when it needs a clear picture. A flat structure avoids all of this. Looking up any entity is a direct ID access. Moving an entity means changing one `locationId` field. Diffing two world states is trivial.

**The shape:**

```
WorldState
├── entities
│   ├── rooms:       { [id]: RoomEntity }
│   ├── things:      { [id]: ThingEntity }
│   ├── containers:  { [id]: ContainerEntity }
│   ├── agents:      { [id]: AgentEntity }
│   ├── exits:       { [id]: ExitEntity }
│   └── ... future kinds
├── relationships
│   └── containment: { [parentId]: [childId, childId, ...] }
└── meta
    ├── turn: number
    └── log: ActionLogEntry[]
```

Each "table" in `entities` is a flat dictionary keyed by ID. The `relationships` section captures spatial containment as a separate index — you can answer "what's inside closet_1?" with a single lookup rather than scanning every entity.

### 1.2 The Kind Hierarchy (Lessons from Inform 7)

Inform 7 has spent decades refining a taxonomy of what kinds of things exist in a text world. We borrow its vocabulary, simplified for our needs. This hierarchy defines what properties each kind of entity can have and what actions it can participate in.

```
Entity (base — has id, name, description)
├── Room
│   └── has: exits[], isLit
├── Thing
│   ├── has: isPortable, isFixed, locationId
│   ├── Container (a Thing that holds other Things)
│   │   └── has: isOpen, isLocked, isOpaque, isEnterable, capacity
│   ├── Supporter (a Thing other Things rest on)
│   │   └── has: capacity
│   ├── Door (connects two Rooms)
│   │   └── has: connectsRooms[2], isOpen, isLocked
│   └── Device
│       └── has: isSwitchedOn
└── Agent (a Thing that acts)
    └── has: inventory[], currentGoal, memoryLog[]
```

**Key distinctions borrowed from Inform 7:**

- **Container vs Supporter:** A table is a supporter (things go *on* it). A closet is a container (things go *in* it). This affects visibility — you can see things on a supporter from the room, but not inside a closed opaque container.
- **Enterable containers:** Your closet-hiding scenario requires a container that is both `isEnterable: true` and `isOpaque: true`. An agent inside an opaque closed container is not visible to other agents entering the room.
- **Parts-of vs contained-in:** A desk has drawers as *parts* (permanently attached). A drawer is a container. Items are *contained in* the drawer. This is a different relationship than the drawer being "inside" the desk — parts move with their parent and cannot be detached.
- **Scenery vs interactive things:** Inform distinguishes objects that are just atmospheric description ("the worn stone walls") from things you can actually interact with. For your world model, scenery items might exist in the entity store but be flagged `isScenery: true`, which means they appear in room descriptions but don't clutter the action list.
- **Scope and visibility:** An agent can interact with things that are "in scope" — in the same room, not inside a closed opaque container, not in the dark. Scope is a computed property derived from the world state, not stored directly.

### 1.3 Designing for Linguistic Clarity

Your linguistics background is an asset here. The world model is essentially a **lexicon** (entities = nouns) combined with a **grammar** (actions = verbs with argument structure). The cleaner this "language" is, the easier it is for both you and the LLMs to reason about.

**Entities as nouns with features:**

In linguistics, nouns carry selectional features — a cup is [+container, +portable, -animate]. Your entity properties work the same way. When defining actions, you specify which features the arguments must have:

```
Action: hide_in
  Agent argument: [+animate]
  Location argument: [+container, +enterable, +opaque, -locked]
```

This is essentially a **selectional restriction** — the action "hide_in" selects for an enterable, opaque, unlocked container. If a container doesn't meet these features, the action isn't available. This is how you generate the valid action list from world state: iterate over entities in scope, check which actions each entity's features satisfy, and present only the valid combinations.

**Actions as verb frames:**

Each action is a frame with typed argument slots (borrowing from Frame Semantics / FrameNet):

```
SEARCH
  ├── Agent:  who is examining     [+animate]
  └── Target: what is search     [+container, +opaque, +isOpen]

OPEN
  ├── Agent:  who opens            [+animate]
  └── Target: what is opened       [+openable, -open, accessible]

HIDE_IN
  ├── Agent:  who hides            [+animate]
  └── Location: where they hide    [+container, +enterable, +opaque]

MOVE_TO
  ├── Agent:  who moves            [+animate]
  └── Destination: where they go   [+room, connected via exit]

TAKE
  ├── Agent:  who takes            [+animate]
  └── Target: what is taken        [+portable, in scope, not held]

PUT_IN
  ├── Agent:  who places           [+animate]
  ├── Target: what is placed       [held by agent]
  └── Container: where it goes     [+container, +open or -closed]
```

**Why this matters for the LLM:**

When you present actions to the agent, you're essentially giving it a sentence to complete. Instead of a raw function signature, the LLM sees something closer to natural language:

```
Available actions:
- search(desk_1) — "Reveal any items in the desk""
- open(closet_1) — "Open the closet"  
- hide_in(closet_1) — "Hide inside the closet"
- move_to(hallway) — "Go to the hallway via the north door"
- take(keycard_1) — "Pick up the keycard from the desk"
```

Each action is generated from the world state by checking which entities are in scope and which selectional restrictions they satisfy. The LLM never sees an invalid action. This is crucial — it eliminates hallucinated actions entirely.

### 1.4 The Action System

Actions are pure functions: `(WorldState, Action) → WorldState`. Each action has three phases, directly mirroring Inform 7's rule system:

1. **Check phase** — validate preconditions. Is the agent in the same room? Is the container unlocked? Is the thing portable? If any check fails, return the current state unchanged plus an error message.

2. **Execute phase** — mutate the world state. Move the entity, change a property, update containment relationships.

3. **Report phase** — generate a natural language description of what happened, for the agent's memory log and for the UI.

```
function hideIn(state, agentId, containerId):
  // CHECK
  agent = state.entities.agents[agentId]
  container = state.entities.containers[containerId]
  if container.locationId !== agent.locationId → fail("not in same room")
  if !container.isEnterable → fail("can't enter that")
  if !container.isOpen → fail("it's closed")
  
  // EXECUTE
  newState = clone(state)
  newState.entities.agents[agentId].locationId = containerId
  newState.entities.agents[agentId].isHidden = true
  newState.relationships.containment[containerId].push(agentId)
  // remove agent from room's containment list
  
  // REPORT
  return { state: newState, report: "You climb into the closet and pull the door shut." }
```

This three-phase structure means you can test every action mechanically before any LLM is involved. Write a unit test for each action, verify state transitions, confirm error messages for invalid attempts. This is Zoo 1.

### 1.5 Scope: What Can the Agent See?

Scope is computed, not stored. Given an agent's current location, scope is the set of entities the agent can perceive and interact with. Computing scope follows these rules:

1. Start with the room the agent is in.
2. Add all entities directly contained in the room (via the containment index).
3. For each **supporter** in the room, add everything on it (supporters are transparent by default).
4. For each **container** in the room: if it is open OR transparent, add its contents. If it is closed AND opaque, its contents are hidden.
5. If the agent is *inside* a container (enterable container), their scope is limited to the container's contents plus (if the container is open or transparent) the room.
6. Exclude scenery from the action list but include it in descriptions.

This scope computation is the function that connects the static world model to what the LLM actually receives. It answers: "given this world state and this agent, what do they know about right now?"

---

## Part 2 — The Zoo Experiments

Each zoo is self-contained: a world definition (JSON), the action system, and a test harness. Early zoos have no LLM at all. Later zoos introduce one.

### Zoo 0 — Schema Validation

**Question:** Is the data model sound? Can I define a world, serialize it, deserialize it, and verify it?

**What you build:**
- TypeScript types for every entity kind
- A JSON schema or Zod validator for world state
- A function that takes a world state JSON and reports: how many rooms, things, agents; whether all ID references resolve; whether containment is consistent (no entity claims to be in two places)
- Two or three hand-written world state JSON files to validate against

**What you learn:**
- Whether the entity types feel right or if you're missing something
- Whether the normalized structure is awkward for any real scenario
- How verbose or compact the world definitions are

**This zoo has no game loop.** It's pure data modeling.


### Zoo 1 — Manual Action Testing

**Question:** Do actions work correctly as pure state transitions?

**What you build:**
- The action system: pure functions for `search`, `take`, `drop`, `open`, `close`, `move_to`, `hide_in`, `put_in`
- The scope computation function
- A simple CLI or test harness where *you* are the agent — you type actions, see the new state
- Unit tests for every action: valid cases, invalid cases, edge cases

**Example test cases:**
- `open(closet_1)` when closet is already open → error
- `take(desk_1)` when desk is `isFixed: true` → error
- `hide_in(closet_1)` then a second agent enters the room → agent_1 should not appear in scope for agent_2
- `put_in(keycard_1, drawer_1)` when drawer is closed → error
- `move_to(hallway)` via a locked door → error

**What you learn:**
- Whether your action preconditions are complete
- Whether the scope system correctly hides/reveals entities
- Edge cases you hadn't thought of (what happens when you take something off a supporter — does it go to inventory or to the room floor?)

**This is the most important zoo.** Everything after this depends on actions being reliable.


### Zoo 2 — Room Description Generation

**Question:** Can I generate a natural language description of a room from the world state that is clear, accurate, and gives the agent enough information to act?

**What you build:**
- A `describeRoom(state, agentId)` function that computes scope and generates a text description
- A `listAvailableActions(state, agentId)` function that returns all valid actions with their parameters
- Test these against your Zoo 1 world states — after each action, generate the new description and verify it matches what you expect

**Example output:**

```
You are in the Laboratory. A fluorescent light buzzes overhead. 
Against the far wall stands an old wooden desk. On the desk: a keycard and a half-empty coffee mug. 
To your left is a tall metal closet (closed). 
The door to the north leads to the Hallway.

Available actions:
1. search(desk_1) — Search the old wooden desk for items
2. take(keycard_1) — Pick up the keycard
3. take(mug_1) — Pick up the coffee mug
4. open(closet_1) — Open the metal closet
5. move_to(hallway) — Go north to the Hallway
```

**What you learn:**
- Whether your world model has enough information to produce good descriptions (do you need adjectives? material? size?)
- Whether the action list generation is intuitive
- How much context is "enough" for an LLM to make sensible decisions (this directly shapes Zoo 3)

**Design note on linguistic register:** The room description and the action list serve different purposes. The description is *narrative* — it sets a scene for the agent's "imagination." The action list is *mechanical* — it's the API the agent calls. Keep these distinct. The LLM reads the prose to understand its situation; it responds by selecting from the structured action list.


### Zoo 3 — First LLM Agent

**Question:** Given a well-formed room description and action list, does an LLM make reasonable choices?

**What you build:**
- An LLM adapter: takes a prompt (system instructions + room description + action list + goal), returns a chosen action
- A game loop: generate description → send to LLM → parse response → execute action → repeat
- A simple React UI that shows: the world state (as a debug panel), the room description, the action the LLM chose, and the resulting state change
- Logging: every turn is recorded — prompt sent, response received, action executed, state diff

**The prompt structure:**

```
SYSTEM: You are an agent in a simulated world. You have a goal: [goal].
You will be given a description of your current situation and a list of 
available actions. Choose exactly one action by responding with the 
action ID. Before choosing, think step by step about which action best 
serves your goal.

USER:
[Room description from Zoo 2's describeRoom function]

[Action list from Zoo 2's listAvailableActions function]

Your goal: Find the keycard and escape through the north door.

Respond with the action number and a brief explanation of your reasoning.
```

**What you learn:**
- Whether the LLM picks sensible actions given clear options
- How much "thinking" prompt you need (does it need CoT? does it overthink?)
- Whether the room descriptions give enough context or too much
- Response parsing reliability — does the LLM actually return a clean action selection, or does it go off-script?

**Critical design decision: all actions at once, not menu-driven.** For this zoo, present everything in one prompt and let the LLM pick. This is simpler to implement and gives you a baseline. If the action space gets too large later, you can experiment with stepped selection in a future zoo.


### Zoo 4 — Memory and Multi-Turn

**Question:** Can an agent remember what it's seen and use that to make decisions across multiple rooms?

**What you build:**
- A memory log per agent: an array of `{ turn, roomId, observation, actionTaken, result }`
- A context window manager: include the last N memory entries in the prompt
- A multi-room world (3–5 rooms) with a goal that requires visiting more than one room ("find the keycard in the lab, then use it on the locked door in the hallway")
- UI additions: a memory panel showing what the agent "remembers"

**Prompt additions:**

```
Your memory of recent events:
- Turn 1: You were in the Laboratory. You searched the desk and found a keycard.
- Turn 2: You picked up the keycard. It is now in your inventory.
- Turn 3: You moved north to the Hallway.

Your inventory: [keycard_1]
```

**What you learn:**
- How much memory context the LLM needs to stay coherent
- Whether summarized memory works better than raw logs
- When the context window starts to matter
- Whether the agent can form and execute multi-step plans


### Zoo 5 — Two Agents and Information Asymmetry

**Question:** When two agents share a world but have different knowledge, does the system correctly handle what each one knows?

**What you build:**
- Two agents, each with their own scope computation, their own memory, their own goals
- A turn system: agents alternate turns (or act simultaneously with conflict resolution)
- The hiding scenario: Agent A hides in the closet. Agent B enters the room. Agent B's scope computation should not reveal Agent A. Agent B can `open(closet_1)` to discover Agent A.
- Each agent gets *only its own* scoped description — no omniscient view

**What you learn:**
- Whether your scope system correctly partitions knowledge between agents
- How to manage per-agent state vs global state
- Whether the LLM respects information boundaries (does it "cheat" and act on information it shouldn't have?)
- Turn ordering and conflict resolution problems

**This is where the world model really gets tested.** If the normalized structure and scope computation are solid, this should work cleanly. If you've been sloppy about what's stored vs what's computed, it'll break here.


### Zoo 6 — Model Comparison (The Loadout Experiment)

**Question:** How do different LLMs behave in the same scenario?

**What you build:**
- The LLM adapter now supports multiple backends (Claude, GPT, Gemini, open-source models)
- Run the same scenario (same world, same goal, same starting conditions) with different models
- Record and compare: number of turns to complete goal, reasoning quality, tendency to explore vs act, error rate in action selection

**What you learn:**
- Which models are best at structured action selection
- Which models "think" most interestingly (for game entertainment value)
- Cost/latency tradeoffs for different model tiers
- Whether smaller models can handle simple scenarios while larger ones are reserved for complex ones

---

## Part 3 — Cross-Cutting Concerns

### 3.1 State Diffing and Debugging

Every action produces a state diff. Store these. They are your most powerful debugging tool. When something goes wrong, you can replay the sequence of diffs to see exactly which action produced an unexpected state. Consider using a library like `deep-diff` or `immer` patches.

### 3.2 World Definition Files

Each zoo should have its world defined in a standalone JSON file. This makes it easy to share scenarios, version them, and swap them in and out. A world definition file includes: the entity tables, the initial containment relationships, and metadata (name, description, intended test purpose).

Over time, you might build a small visual editor for these — but that's a much later zoo. For now, hand-written JSON is fine because the flat structure makes it readable.

### 3.3 The Action Registry

Actions should be registered in a central registry that maps action names to their implementation functions and their argument schemas. This registry is what generates the available action list for any given scope. It's also what you'd use to add new actions without modifying the core loop:

```
ActionRegistry
├── search:  { args: [Target], check: ..., execute: ..., report: ... }
├── take:     { args: [Target], check: ..., execute: ..., report: ... }
├── open:     { args: [Target], check: ..., execute: ..., report: ... }
├── hide_in:  { args: [Location], check: ..., execute: ..., report: ... }
├── move_to:  { args: [Destination], check: ..., execute: ..., report: ... }
└── ...
```

Each entry declares what argument types it needs (using the selectional features from section 1.3), so generating valid actions for a given scope is automatic.

### 3.4 What to Track Across Zoos

Keep a running log — even just a markdown file — of:
- What you expected vs what actually happened
- Surprises in how the LLM behaved
- Things you had to add to the world model that you didn't anticipate
- Things in the world model that turned out to be unnecessary
- Performance observations (token usage, latency, cost per scenario run)

This log is the actual output of the project. The code is disposable; the understanding isn't.

---

## Part 4 — Stack and Tooling

### Recommended Starting Stack

- **TypeScript** throughout — the type system enforces your ontology at compile time
- **Vite + React** for the debug UI / playtest interface
- **No backend initially** — the world state is local, LLM calls go direct to the API from the client (or a thin Vite proxy)
- **Zod** for runtime validation of world state and action parameters
- **Vitest** for unit testing actions and scope computation
- **Hono backend** introduced when you need it (Zoo 5 for multi-agent coordination, or whenever you want persistence)

### File Structure Suggestion

```
/src
  /ontology        — TypeScript types for all entity kinds
  /world           — World state management, scope computation
  /actions         — Action registry, action implementations
  /agent           — LLM adapter, prompt construction, response parsing
  /memory          — Agent memory management
  /ui              — React components for the debug/playtest interface
/worlds            — JSON world definition files for each zoo
/tests             — Unit tests mirroring the action system
/logs              — Experiment logs and observations
```

---

## Appendix — Inform 7 Concepts Worth Stealing

| Inform 7 Concept | Your Equivalent | Why It Matters |
|---|---|---|
| Room | Room entity | The fundamental unit of space. Agents exist in rooms. |
| Thing | Thing entity | Anything that isn't a room or an agent. |
| Container | Container entity (extends Thing) | Holds other things. Can be open/closed, locked, opaque/transparent, enterable. |
| Supporter | Supporter entity (extends Thing) | Things rest on it. Always "transparent" — contents visible from room. |
| Door | Exit entity | Connects two rooms. Can be open/closed, locked. |
| Person | Agent entity | An entity that can act. Has inventory and memory. |
| Scenery | `isScenery: true` flag | Appears in descriptions, not in action lists. Cannot be taken. |
| "In scope" | `computeScope(state, agentId)` | The set of entities an agent can perceive and act on. |
| "Persuasion" rules | Agent goal + LLM reasoning | How an agent decides what to do. Inform uses rules; you use an LLM. |
| Before/Instead/After rules | Check/Execute/Report phases | Three-phase action processing. Preconditions, effects, narration. |
| Backdrop | Entity with `isEverywhere: true` | Something present in multiple rooms (like "the sky" or "the alarm sound"). |
| "Parts of" relation | `partOfId` field on entities | Components of a larger thing. Move with parent, cannot be detached. |

---

## What Success Looks Like

After completing these zoos you will have:

1. **A proven world model** — a normalized entity schema that can represent rooms, objects, containers, doors, and agents, with clean scope computation and state transitions.

2. **A working action system** — pure functions that reliably transform world state, tested independently of any LLM.

3. **Empirical knowledge about LLM agents** — how much context they need, how they select actions, how they handle memory, how different models compare.

4. **A log of design decisions** — what worked, what didn't, and why. This is what lets you design the larger system with confidence.

5. **Reusable building blocks** — the ontology types, action registry, scope computation, and LLM adapter are all pieces you carry forward into whatever the bigger project becomes.

The zoos are the learning. The bigger game is the thing you'll know how to build after.
