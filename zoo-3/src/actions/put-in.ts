import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Place a held item into an open container.
// Zoo-2 addition — completes the take/drop/put_in triad.
//
// CHECK: agent holds the item, container exists, container is open
// EXECUTE: remove from inventory, add to container (both locationId and containment)
// REPORT: describe what happened
export function putIn(state: WorldState, agentId: string, thingId: string, containerId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  const thing = state.entities.things[thingId]
  const container = state.entities.containers[containerId]

  // === CHECK ===
  if (!thing) {
    return { success: false, state, message: 'That item does not exist.' }
  }

  if (thing.locationId !== agentId) {
    return { success: false, state, message: 'You are not holding that.' }
  }

  if (!container) {
    return { success: false, state, message: 'That container does not exist.' }
  }

  if (!container.isOpen) {
    return { success: false, state, message: `The ${container.name} is closed.` }
  }

  // === EXECUTE ===
  const newContainment = { ...state.containment }
  newContainment[agentId] = (state.containment[agentId] || []).filter(id => id !== thingId)
  newContainment[containerId] = [...(newContainment[containerId] || []), thingId]

  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      things: {
        ...state.entities.things,
        [thingId]: { ...thing, locationId: containerId },
      },
    },
    containment: newContainment,
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You put the ${thing.name} in the ${container.name}.`,
  }
}
