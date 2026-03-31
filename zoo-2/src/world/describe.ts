import type { WorldState } from '../types/entities'
import { computeScope } from './scope'
import { getEntity } from './entities'

// describeZone renders a natural language description of what the agent perceives.
//
// Unlike zoo-1 which had no description layer, zoo-2 produces text ready for
// a human (or LLM in zoo-3) to read. It covers:
//   - The agent's current zone (room name, room description, contents)
//   - Adjacent zones visible through open borders / open doors (perceivable scope)
//   - Borders and their current state (locked door, open corridor, etc.)
//
// The name is "describeZone" rather than "describeRoom" because the output
// spans multiple zones whenever perception crosses a border.
export function describeZone(state: WorldState, agentId: string): string {
  const agent = state.entities.agents[agentId]
  if (!agent) return ''

  // Special case: hidden inside a container
  if (agent.isHidden) {
    const container = state.entities.containers[agent.locationId]
    if (!container) return ''
    return `You are inside the ${container.name}. It is close and dark.`
  }

  const room = state.entities.rooms[agent.locationId]
  if (!room) return ''

  const { reachable, perceivable } = computeScope(state, agentId)
  const lines: string[] = []

  lines.push(`${room.name}. ${room.description}`)

  // --- Current room contents ---
  const roomContents = state.containment[room.id] || []
  for (const id of roomContents) {
    if (id === agentId) continue
    const entity = getEntity(state, id)
    if (!entity) continue

    if (entity.kind === 'supporter') {
      const onTop = (state.containment[id] || [])
        .map(cid => getEntity(state, cid))
        .filter(Boolean)
      if (onTop.length > 0) {
        lines.push(`On the ${entity.name}: ${onTop.map(e => e!.name).join(', ')}.`)
      } else {
        lines.push(`The ${entity.name} is here, empty.`)
      }
    } else if (entity.kind === 'container') {
      const stateStr = entity.isLocked ? 'locked' : (entity.isOpen ? 'open' : 'closed')
      lines.push(`The ${entity.name} is ${stateStr}.`)
      if (entity.isOpen) {
        const inside = (state.containment[id] || [])
          .map(cid => getEntity(state, cid))
          .filter(Boolean)
        if (inside.length > 0) {
          lines.push(`  Inside: ${inside.map(e => e!.name).join(', ')}.`)
        }
      }
    } else if (entity.kind === 'thing') {
      lines.push(`A ${entity.name} is here.`)
    } else if (entity.kind === 'agent' && id !== agentId) {
      lines.push(`${entity.name} is here.`)
    }
  }

  // --- Inventory ---
  const inventory = Object.values(state.entities.things).filter(t => t.locationId === agentId)
  if (inventory.length > 0) {
    lines.push(`You are carrying: ${inventory.map(t => t.name).join(', ')}.`)
  }

  // --- Borders: exits, doors, and cross-zone visibility ---
  for (const border of state.borders) {
    if (!border.between.includes(room.id)) continue
    const adjacentRoomId = border.between[0] === room.id ? border.between[1] : border.between[0]
    const adjacentRoom = state.entities.rooms[adjacentRoomId]
    const direction = border.direction[room.id]

    if (border.type === 'open') {
      lines.push(`To the ${direction}: an open passage leads to the ${adjacentRoom?.name}.`)

      // Describe what's visible through the open border
      const adjVisible = (state.containment[adjacentRoomId] || [])
        .filter(id => perceivable.includes(id))
        .map(id => getEntity(state, id))
        .filter(Boolean)
      if (adjVisible.length > 0) {
        lines.push(`  Through the passage you can see: ${adjVisible.map(e => e!.name).join(', ')}.`)
      } else {
        lines.push(`  Through the passage, the ${adjacentRoom?.name} looks empty.`)
      }
    } else if (border.type === 'door' && border.doorId) {
      const door = state.entities.doors[border.doorId]
      if (!door) continue
      const doorStateStr = door.isLocked ? 'locked' : (door.isOpen ? 'open' : 'closed')
      lines.push(`To the ${direction}: ${door.name} (${doorStateStr}).`)

      if (door.isOpen) {
        const adjVisible = (state.containment[adjacentRoomId] || [])
          .filter(id => perceivable.includes(id))
          .map(id => getEntity(state, id))
          .filter(Boolean)
        if (adjVisible.length > 0) {
          lines.push(`  Through the open door you can see: ${adjVisible.map(e => e!.name).join(', ')}.`)
        } else {
          lines.push(`  Through the open door, the ${adjacentRoom?.name} appears empty.`)
        }
      }
    } else if (border.type === 'wall') {
      // Walls are not listed — they're just absence of passage.
    }
  }

  return lines.join('\n')
}

// listAvailableActions returns AvailableAction[] formatted for LLM or UI display.
// Thin wrapper around getAvailableActions — kept here so the description layer
// is a single import for Zoo-3 prompt construction.
export { getAvailableActions as listAvailableActions } from '../actions/available-actions'
