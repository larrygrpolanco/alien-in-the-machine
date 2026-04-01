import type { WorldState, ScopeResult } from '../types/entities'

// computeScope answers: "given this world state, what can the agent perceive right now?"
//
// Zoo-2 changes from zoo-1:
//   - Returns ScopeResult { reachable, perceivable } instead of a plain string[]
//   - reachable: entities the agent can act on (same zone, doors on adjacent borders)
//   - perceivable: entities visible through open borders/doors but in an adjacent zone
//
// IMPORTANT: getAvailableActions uses only reachable.
// describeZone uses both sets to build the narrative.

export function computeScope(state: WorldState, agentId: string): ScopeResult {
  const agent = state.entities.agents[agentId]
  if (!agent) return { reachable: [], perceivable: [] }

  // === Hidden agent: scope is limited to container contents only ===
  // A hidden agent cannot perceive the room or through borders.
  if (agent.isHidden) {
    const container = state.entities.containers[agent.locationId]
    if (!container) return { reachable: [], perceivable: [] }
    const inside = (state.containment[agent.locationId] || []).filter(id => id !== agentId)
    return { reachable: inside, perceivable: [] }
  }

  const reachable: string[] = []
  const perceivable: string[] = []
  const roomId = agent.locationId
  const roomContents = state.containment[roomId] || []

  // === REACHABLE: entities in the current room ===
  for (const id of roomContents) {
    if (id === agentId) continue
    reachable.push(id)

    // Supporters are transparent — everything on top is reachable
    const supporter = state.entities.supporters[id]
    if (supporter) {
      const onTop = state.containment[id] || []
      reachable.push(...onTop)
      continue
    }

    // Containers: contents visible if open or non-opaque
    const container = state.entities.containers[id]
    if (container) {
      if (!container.isOpen && container.isOpaque) continue
      const inside = state.containment[id] || []
      reachable.push(...inside)
    }
  }

  // === BORDERS: doors + cross-zone perception ===
  for (const border of state.borders) {
    if (!border.between.includes(roomId)) continue

    const adjacentRoomId = border.between[0] === roomId
      ? border.between[1]
      : border.between[0]

    // Doors on this border are always reachable from either adjacent room.
    // The agent can open, close, or unlock a door without stepping through it.
    if (border.type === 'door' && border.doorId) {
      reachable.push(border.doorId)
    }

    // Cross-zone perception: can the agent see into the adjacent zone?
    let canSeeThrough = false
    if (border.type === 'open') {
      canSeeThrough = true
    } else if (border.type === 'door' && border.doorId) {
      const door = state.entities.doors[border.doorId]
      if (door?.isOpen) canSeeThrough = true
    }

    if (!canSeeThrough) continue

    const adjacentContents = state.containment[adjacentRoomId] || []
    for (const id of adjacentContents) {
      perceivable.push(id)

      // Supporters in adjacent zone: items on them are also perceivable
      const supporter = state.entities.supporters[id]
      if (supporter) {
        const onTop = state.containment[id] || []
        perceivable.push(...onTop)
        continue
      }

      // Open or transparent containers in adjacent zone reveal their contents
      const container = state.entities.containers[id]
      if (container && (container.isOpen || !container.isOpaque)) {
        const inside = state.containment[id] || []
        perceivable.push(...inside)
      }
    }
  }

  return { reachable, perceivable }
}
