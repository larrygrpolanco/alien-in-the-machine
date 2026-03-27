// BASE ENTITY — every object in the world shares these three fields.
// Think of it like a base class, but TypeScript uses "extends" on interfaces instead.
interface BaseEntity {
  id: string       // unique identifier, used everywhere to reference this entity
  name: string     // what the player sees (e.g. "Keycard")
  description: string // longer text for flavor (e.g. "A small plastic keycard...")
}

// ROOM — a space where agents and things exist.
// Rooms connect to each other via exits (north, south, etc.)
export interface Room extends BaseEntity {
  kind: 'room'
  exits: Record<string, string>  // direction -> roomId, e.g. { north: 'hallway' }
}

// THING — any object in the world (keycard, rock, cup, etc.)
// locationId tells you WHERE it is: could be a room ('lab') or a container ('desk')
export interface Thing extends BaseEntity {
  kind: 'thing'
  locationId: string   // the id of whatever holds this thing
  isPortable: boolean  // can an agent pick it up?
  isFixed: boolean     // is it stuck in place? (a desk is fixed, a keycard is not)
}

// CONTAINER — a thing that holds other things (closet, drawer, box)
// has state for whether it's open, locked, see-through, etc.
export interface Container extends BaseEntity {
  kind: 'container'
  locationId: string
  isPortable: boolean
  isFixed: boolean
  isOpen: boolean      // can you see/reach inside?
  isLocked: boolean    // needs a key or action to open?
  isOpaque: boolean    // true = can't see contents when closed
  isEnterable: boolean // can an agent go inside?
}

// SUPPORTER — a thing other things rest ON (table, desk, shelf)
// items on a supporter are always visible from the room
export interface Supporter extends BaseEntity {
  kind: 'supporter'
  locationId: string
  isPortable: boolean
  isFixed: boolean
  capacity: number     // how many things can fit on it
}

// AGENT — an entity that can take actions (the player, NPCs later)
export interface Agent extends BaseEntity {
  kind: 'agent'
  locationId: string   // which room the agent is in
  isHidden: boolean    // true when hiding inside a container
}

// Entity is a UNION type — it could be any of the above.
// The "kind" field is how TypeScript tells them apart (discriminated union).
// When you check entity.kind === 'container', TypeScript knows it has isOpen, isOpaque, etc.
export type Entity = Room | Thing | Container | Supporter | Agent

// Containment maps a parent id to the list of things inside it.
// e.g. { 'lab': ['desk', 'closet'], 'desk': ['keycard'] }
// This is separate from the entities so you can ask "what's in X?" with one lookup.
export type Containment = Record<string, string[]>

// The full world state — everything about the simulation lives here.
export interface WorldState {
  entities: {
    rooms: Record<string, Room>         // all rooms, keyed by id
    things: Record<string, Thing>       // all things, keyed by id
    containers: Record<string, Container> // all containers, keyed by id
    supporters: Record<string, Supporter> // all supporters, keyed by id
    agents: Record<string, Agent>       // all agents, keyed by id
  }
  containment: Containment  // who holds what
  meta: {
    turn: number    // how many actions have happened
    log: string[]   // history of messages
  }
}
