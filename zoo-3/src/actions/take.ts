import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Pick up a portable item and add it to the agent's inventory.
// Inventory = things whose locationId === agentId.
// Updates both entity.locationId AND containment to keep them in sync.
export function take(state: WorldState, agentId: string, thingId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  const thing = state.entities.things[thingId]

  // === CHECK ===
  if (!thing) {
    return { success: false, state, message: 'That item does not exist.' }
  }

  if (thing.locationId === agentId) {
    return { success: false, state, message: 'You are already holding that.' }
  }

  if (!thing.isPortable) {
    return { success: false, state, message: `You can't pick up the ${thing.name}.` }
  }

  if (thing.isFixed) {
    return { success: false, state, message: `The ${thing.name} is fixed in place.` }
  }

  // Check if the item is inside a closed container
  const parentContainer = state.entities.containers[thing.locationId]
  if (parentContainer && !parentContainer.isOpen) {
    return { success: false, state, message: `The ${parentContainer.name} is closed.` }
  }

  // === EXECUTE ===
  const oldParentId = thing.locationId
  const newContainment = { ...state.containment }
  newContainment[oldParentId] = (state.containment[oldParentId] || []).filter(id => id !== thingId)
  newContainment[agentId] = [...(newContainment[agentId] || []), thingId]

  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      things: {
        ...state.entities.things,
        [thingId]: { ...thing, locationId: agentId },
      },
    },
    containment: newContainment,
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You pick up the ${thing.name}.`,
  }
}
