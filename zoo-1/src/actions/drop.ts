import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Drop an item from the agent's inventory into the current room.
//
// The item lands on the "floor" of the room — its locationId becomes the room id.
// Three-phase: CHECK → EXECUTE → REPORT
export function drop(state: WorldState, agentId: string, thingId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  const thing = state.entities.things[thingId]

  // === CHECK ===
  if (!thing) {
    return { success: false, state, message: 'That item does not exist.' }
  }

  if (thing.locationId !== agentId) {
    return { success: false, state, message: 'You are not holding that.' }
  }

  // === EXECUTE ===
  // 1. Remove thing from agent's containment list
  const agentContents = state.containment[agentId] || []
  const newContainment = { ...state.containment }
  newContainment[agentId] = agentContents.filter(id => id !== thingId)

  // 2. Add thing to current room's containment list
  const roomId = agent.locationId
  const roomContents = newContainment[roomId] || []
  newContainment[roomId] = [...roomContents, thingId]

  // 3. Update the thing's locationId to point to the room
  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      things: {
        ...state.entities.things,
        [thingId]: { ...thing, locationId: roomId },
      },
    },
    containment: newContainment,
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You drop the ${thing.name}.`,
  }
}
