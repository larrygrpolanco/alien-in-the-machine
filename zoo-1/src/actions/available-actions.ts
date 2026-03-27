import type { WorldState } from '../types/entities'
import { computeScope } from '../world/scope'
import { getEntity } from '../world/entities'

// An AvailableAction is a valid thing the agent could do right now.
export interface AvailableAction {
  name: string         // action function name: 'take', 'open', 'move', etc.
  targetId: string     // the entity this action targets
  label: string        // human-readable: "Take Keycard", "Open Metal Closet"
}

// Given world state and an agent, return all valid actions the agent can currently take.
// This is derived from scope + entity features — no guessing, no hallucination.
export function getAvailableActions(state: WorldState, agentId: string): AvailableAction[] {
  const agent = state.entities.agents[agentId]
  if (!agent) return []

  const actions: AvailableAction[] = []
  const room = state.entities.rooms[agent.locationId]
  const scope = computeScope(state, agentId)

  // === MOVE: any exit from the current room ===
  if (room) {
    for (const [dir, destId] of Object.entries(room.exits)) {
      const dest = state.entities.rooms[destId]
      if (dest) {
        actions.push({
          name: 'move',
          targetId: destId,
          label: `Go ${dir} → ${dest.name}`,
        })
      }
    }
  }

  // === For each entity in scope, check what actions apply ===
  for (const id of scope) {
    const entity = getEntity(state, id)
    if (!entity) continue

    // TAKE: thing is portable, not fixed, and not already held
    if (entity.kind === 'thing' && entity.isPortable && !entity.isFixed && entity.locationId !== agentId) {
      actions.push({
        name: 'take',
        targetId: id,
        label: `Take ${entity.name}`,
      })
    }

    // OPEN: container is closed and not locked
    if (entity.kind === 'container' && !entity.isOpen && !entity.isLocked) {
      actions.push({
        name: 'open',
        targetId: id,
        label: `Open ${entity.name}`,
      })
    }

    // CLOSE: container is open
    if (entity.kind === 'container' && entity.isOpen) {
      actions.push({
        name: 'close',
        targetId: id,
        label: `Close ${entity.name}`,
      })
    }

    // HIDE IN: container is open, enterable, in same room as agent
    if (entity.kind === 'container' && entity.isOpen && entity.isEnterable && entity.locationId === agent.locationId) {
      actions.push({
        name: 'hideIn',
        targetId: id,
        label: `Hide in ${entity.name}`,
      })
    }
  }

  // DROP: anything in inventory
  const inventory = Object.values(state.entities.things).filter(t => t.locationId === agentId)
  for (const thing of inventory) {
    actions.push({
      name: 'drop',
      targetId: thing.id,
      label: `Drop ${thing.name}`,
    })
  }

  // EMERGE: if hidden in a container
  if (agent.isHidden) {
    actions.push({
      name: 'emergeFrom',
      targetId: agent.locationId,
      label: 'Come out',
    })
  }

  return actions
}
