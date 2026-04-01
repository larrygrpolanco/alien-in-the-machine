import type { WorldState } from '../types/entities'
import { computeScope } from '../world/scope'
import { getEntity } from '../world/entities'

// An AvailableAction is a valid thing the agent can do right now.
export interface AvailableAction {
  name: string      // action identifier: 'move', 'take', 'open', 'unlock', 'putIn', etc.
  targetId: string  // primary entity this action targets
  secondaryId?: string // for putIn: the container id
  label: string     // human-readable: "Take Keycard", "Unlock Security Door"
}

// Given world state and an agent, return all valid actions the agent can currently take.
// Zoo-2 changes from zoo-1:
//   - Uses ScopeResult.reachable (not the full flat scope)
//   - Movement derived from borders instead of room.exits
//   - OPEN/CLOSE/UNLOCK generated for Door entities (reached via borders)
//   - PUT_IN generated when agent holds items and reachable containers are open
export function getAvailableActions(state: WorldState, agentId: string): AvailableAction[] {
  const agent = state.entities.agents[agentId]
  if (!agent) return []

  // Hidden agents can only emerge
  if (agent.isHidden) {
    return [{
      name: 'emergeFrom',
      targetId: agent.locationId,
      label: 'Come out',
    }]
  }

  const actions: AvailableAction[] = []
  const { reachable } = computeScope(state, agentId)
  const roomId = agent.locationId

  // === MOVE: derive from borders (replaces room.exits) ===
  for (const border of state.borders) {
    if (!border.between.includes(roomId)) continue

    const destId = border.between[0] === roomId ? border.between[1] : border.between[0]
    const dest = state.entities.rooms[destId]
    if (!dest) continue

    const direction = border.direction[roomId]

    // Check if border is passable
    if (border.type === 'wall') continue
    if (border.type === 'door' && border.doorId) {
      const door = state.entities.doors[border.doorId]
      if (!door || door.isLocked || !door.isOpen) continue
    }

    actions.push({
      name: 'move',
      targetId: destId,
      label: `Go ${direction} → ${dest.name}`,
    })
  }

  // Inventory: things held by agent
  const inventory = Object.values(state.entities.things).filter(t => t.locationId === agentId)

  // === Actions for each reachable entity ===
  for (const id of reachable) {
    const entity = getEntity(state, id)
    if (!entity) continue

    // TAKE: portable thing not already held
    if (entity.kind === 'thing' && entity.isPortable && !entity.isFixed && entity.locationId !== agentId) {
      actions.push({ name: 'take', targetId: id, label: `Take ${entity.name}` })
    }

    // Container actions
    if (entity.kind === 'container') {
      if (!entity.isOpen && !entity.isLocked) {
        actions.push({ name: 'open', targetId: id, label: `Open ${entity.name}` })
      }
      if (entity.isOpen) {
        actions.push({ name: 'close', targetId: id, label: `Close ${entity.name}` })
      }
      if (entity.isOpen && entity.isEnterable && entity.locationId === roomId) {
        actions.push({ name: 'hideIn', targetId: id, label: `Hide in ${entity.name}` })
      }
      // PUT_IN: agent has inventory + container is open
      if (entity.isOpen) {
        for (const thing of inventory) {
          actions.push({
            name: 'putIn',
            targetId: thing.id,
            secondaryId: id,
            label: `Put ${thing.name} in ${entity.name}`,
          })
        }
      }
    }

    // Door actions (doors are reachable from adjacent rooms via border)
    if (entity.kind === 'door') {
      if (!entity.isOpen && !entity.isLocked) {
        actions.push({ name: 'open', targetId: id, label: `Open ${entity.name}` })
      }
      if (entity.isOpen) {
        actions.push({ name: 'close', targetId: id, label: `Close ${entity.name}` })
      }
      if (entity.isLocked && entity.keyItemId) {
        const hasKey = inventory.some(t => t.id === entity.keyItemId)
        if (hasKey) {
          const keyItem = state.entities.things[entity.keyItemId]
          actions.push({
            name: 'unlock',
            targetId: id,
            label: `Unlock ${entity.name} with ${keyItem?.name ?? 'key'}`,
          })
        }
      }
    }
  }

  // DROP: anything in inventory
  for (const thing of inventory) {
    actions.push({ name: 'drop', targetId: thing.id, label: `Drop ${thing.name}` })
  }

  return actions
}
