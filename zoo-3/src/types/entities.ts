// BASE ENTITY — every object in the world shares these three fields.
interface BaseEntity {
  id: string
  name: string
  description: string
}

// ROOM — a space where agents and things exist.
// Zoo-2 change: exits are REMOVED. Connectivity is expressed through the borders array
// on WorldState. This lets doors be first-class entities on borders rather than
// hidden inside room records.
export interface Room extends BaseEntity {
  kind: 'room'
}

// THING — any portable (or fixed) object in the world.
export interface Thing extends BaseEntity {
  kind: 'thing'
  locationId: string
  isPortable: boolean
  isFixed: boolean
}

// CONTAINER — a thing that holds other things.
// keyItemId: optional — if set, only the item with that id can unlock it.
export interface Container extends BaseEntity {
  kind: 'container'
  locationId: string
  isPortable: boolean
  isFixed: boolean
  isOpen: boolean
  isLocked: boolean
  isOpaque: boolean
  isEnterable: boolean
  keyItemId?: string
}

// SUPPORTER — things rest ON it. Contents always visible from room.
export interface Supporter extends BaseEntity {
  kind: 'supporter'
  locationId: string
  isPortable: boolean
  isFixed: boolean
  capacity: number
}

// AGENT — an entity that can take actions.
export interface Agent extends BaseEntity {
  kind: 'agent'
  locationId: string
  isHidden: boolean
}

// DOOR — Zoo-2 addition. Lives on a Border, not in a room's containment.
// Controls whether passage and sight are possible between two zones.
// keyItemId: which inventory item unlocks it.
export interface Door extends BaseEntity {
  kind: 'door'
  isOpen: boolean
  isLocked: boolean
  keyItemId?: string
}

// BORDER — Zoo-2 addition. The relationship between two adjacent rooms.
// Replaces room.exits. Borders are the sole source of connectivity.
//   type 'open'  — no door; passage and sight always possible
//   type 'wall'  — permanent block; no passage, no sight
//   type 'door'  — a Door entity controls passage and sight
// direction: maps each roomId to the compass direction that leads to this border.
export interface Border {
  id: string
  between: [string, string]
  type: 'open' | 'wall' | 'door'
  doorId?: string
  direction: Record<string, string>
}

// SCOPE RESULT — Zoo-2 addition. Replaces the plain string[] from zoo-1.
//   reachable:   agent can act on these (same zone, or door on adjacent border)
//   perceivable: agent can see but not act on (adjacent zone through open border/door)
export interface ScopeResult {
  reachable: string[]
  perceivable: string[]
}

// Entity union — includes Door now.
export type Entity = Room | Thing | Container | Supporter | Agent | Door

export type Containment = Record<string, string[]>

export interface WorldState {
  entities: {
    rooms: Record<string, Room>
    things: Record<string, Thing>
    containers: Record<string, Container>
    supporters: Record<string, Supporter>
    agents: Record<string, Agent>
    doors: Record<string, Door>
  }
  borders: Border[]
  containment: Containment
  meta: {
    turn: number
    log: string[]
  }
}
