import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Pick up an item and put it in the agent's inventory.
//
// Three-phase: CHECK → EXECUTE → REPORT
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

  // === EXECUTE ===
  // 1. Remove thing from its current parent's containment list
  const oldParentId = thing.locationId
  const oldParentContents = state.containment[oldParentId] || []
  const newContainment = { ...state.containment }
  newContainment[oldParentId] = oldParentContents.filter(id => id !== thingId)

  // 2. Add thing to agent's containment list (inventory)
  const agentContents = newContainment[agentId] || []
  newContainment[agentId] = [...agentContents, thingId]

  // 3. Update the thing's locationId to point to the agent
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
