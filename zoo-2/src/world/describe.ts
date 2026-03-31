import type { WorldState } from '../types/entities'
import { computeScope } from './scope'
import { getEntity } from './entities'

// describeZone renders a structured, scannable description of what the agent perceives.
//
// Output is sectioned, not prose-heavy. Each section serves a clear purpose:
//   HEADER     — where you are
//   ATMOSPHERE — one-line room description (flavor, not mechanical)
//   FURNITURE  — supporters and containers in the room, with contents/state
//   EXITS      — borders, their state, and visible contents through open borders
//   INVENTORY  — what the agent is carrying
//
// This format is optimized for LLM comprehension and human scannability.
// Prose is minimized to a single atmosphere line — the structure carries the information.
export function describeZone(state: WorldState, agentId: string): string {
  const agent = state.entities.agents[agentId]
  if (!agent) return ''

  // Special case: hidden inside a container
  if (agent.isHidden) {
    const container = state.entities.containers[agent.locationId]
    if (!container) return ''
    const lines: string[] = []
    lines.push(`=== INSIDE ${container.name.toUpperCase()} ===`)
    const inside = (state.containment[agent.locationId] || [])
      .filter(id => id !== agentId)
      .map(id => getEntity(state, id))
      .filter(Boolean)
    if (inside.length > 0) {
      lines.push(inside.map(e => e!.name).join(', '))
    } else {
      lines.push('Nothing else here.')
    }
    return lines.join('\n')
  }

  const room = state.entities.rooms[agent.locationId]
  if (!room) return ''

  const { reachable, perceivable } = computeScope(state, agentId)
  const sections: string[] = []

  // --- Header + atmosphere ---
  sections.push(`=== ${room.name.toUpperCase()} ===`)
  sections.push(room.description)

  // --- Furniture: supporters and containers ---
  const furniture = describeFurniture(state, room.id, reachable)
  if (furniture) sections.push(furniture)

  // --- Exits: borders with visible contents ---
  const exits = describeExits(state, room.id, perceivable)
  if (exits) sections.push(exits)

  // --- Inventory ---
  const inventory = describeInventory(state, agentId)
  if (inventory) sections.push(inventory)

  return sections.join('\n\n')
}

// describeFurniture lists supporters and containers in the room.
// Each supporter shows what's on it. Each container shows its state (open/closed/locked).
function describeFurniture(state: WorldState, roomId: string, reachable: string[]): string | null {
  const roomContents = state.containment[roomId] || []
  const furnitureItems: string[] = []

  for (const id of roomContents) {
    const entity = getEntity(state, id)
    if (!entity) continue

    if (entity.kind === 'supporter') {
      const onTop = (state.containment[id] || [])
        .map(cid => getEntity(state, cid))
        .filter(Boolean)
      if (onTop.length > 0) {
        furnitureItems.push(`${entity.name} — On it: ${onTop.map(e => e!.name).join(', ')}`)
      } else {
        furnitureItems.push(`${entity.name} (empty)`)
      }
    } else if (entity.kind === 'container') {
      const stateStr = entity.isLocked ? 'locked' : (entity.isOpen ? 'open' : 'closed')
      const parts = [entity.name, `(${stateStr})`]
      if (entity.isOpen) {
        const inside = (state.containment[id] || [])
          .map(cid => getEntity(state, cid))
          .filter(Boolean)
        if (inside.length > 0) {
          parts.push(`— Inside: ${inside.map(e => e!.name).join(', ')}`)
        }
      }
      furnitureItems.push(parts.join(' '))
    }
  }

  if (furnitureItems.length === 0) return null

  const lines = ['FURNITURE:']
  for (const item of furnitureItems) {
    lines.push(`  ${item}`)
  }
  return lines.join('\n')
}

// describeExits lists borders from the current room.
// For open borders or open doors, shows visible contents in the adjacent room.
function describeExits(state: WorldState, roomId: string, perceivable: string[]): string | null {
  const exitLines: string[] = []

  for (const border of state.borders) {
    if (!border.between.includes(roomId)) continue
    const adjacentRoomId = border.between[0] === roomId ? border.between[1] : border.between[0]
    const adjacentRoom = state.entities.rooms[adjacentRoomId]
    const direction = border.direction[roomId]

    if (border.type === 'open') {
      const parts = [`${direction}: Open passage → ${adjacentRoom?.name}`]
      const adjVisible = (state.containment[adjacentRoomId] || [])
        .filter(id => perceivable.includes(id))
        .map(id => getEntity(state, id))
        .filter(Boolean)
      if (adjVisible.length > 0) {
        exitLines.push(parts.join(''))
        exitLines.push(`  Visible: ${describeVisibleEntities(adjVisible, state, adjacentRoomId)}`)
      } else {
        exitLines.push(parts.join('') + ' (empty)')
      }
    } else if (border.type === 'door' && border.doorId) {
      const door = state.entities.doors[border.doorId]
      if (!door) continue
      const doorStateStr = door.isLocked ? 'locked' : (door.isOpen ? 'open' : 'closed')

      if (door.isOpen) {
        const parts = [`${direction}: ${door.name} (${doorStateStr}) → ${adjacentRoom?.name}`]
        const adjVisible = (state.containment[adjacentRoomId] || [])
          .filter(id => perceivable.includes(id))
          .map(id => getEntity(state, id))
          .filter(Boolean)
        exitLines.push(parts.join(''))
        if (adjVisible.length > 0) {
          exitLines.push(`  Visible: ${describeVisibleEntities(adjVisible, state, adjacentRoomId)}`)
        } else {
          exitLines.push(`  (nothing visible)`)
        }
      } else {
        exitLines.push(`${direction}: ${door.name} (${doorStateStr})`)
      }
    }
    // Walls are omitted — no passage, no sight.
  }

  if (exitLines.length === 0) return null

  const lines = ['EXITS:']
  for (const line of exitLines) {
    lines.push(`  ${line}`)
  }
  return lines.join('\n')
}

// describeVisibleEntities formats entities visible through a border.
// Handles supporters (showing what's on them) and containers (showing state).
function describeVisibleEntities(entities: ReturnType<typeof getEntity>[], state: WorldState, adjacentRoomId: string): string {
  const parts: string[] = []
  for (const entity of entities) {
    if (!entity) continue
    if (entity.kind === 'supporter') {
      const onTop = (state.containment[entity.id] || [])
        .map(cid => getEntity(state, cid))
        .filter(Boolean)
      if (onTop.length > 0) {
        parts.push(`${entity.name} (on it: ${onTop.map(e => e!.name).join(', ')})`)
      } else {
        parts.push(`${entity.name} (empty)`)
      }
    } else if (entity.kind === 'container') {
      const stateStr = entity.isLocked ? 'locked' : (entity.isOpen ? 'open' : 'closed')
      parts.push(`${entity.name} (${stateStr})`)
    } else {
      parts.push(entity.name)
    }
  }
  return parts.join(', ')
}

// describeInventory lists items carried by the agent.
function describeInventory(state: WorldState, agentId: string): string | null {
  const inventory = Object.values(state.entities.things).filter(t => t.locationId === agentId)
  if (inventory.length === 0) return null

  return `INVENTORY:\n  ${inventory.map(t => t.name).join(', ')}`
}

// listAvailableActions returns AvailableAction[] formatted for LLM or UI display.
// Thin wrapper around getAvailableActions — kept here so the description layer
// is a single import for Zoo-3 prompt construction.
export { getAvailableActions as listAvailableActions } from '../actions/available-actions'
