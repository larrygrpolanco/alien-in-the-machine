import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Drop an item from inventory onto the floor of the agent's current room.
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
  const roomId = agent.locationId
  const newContainment = { ...state.containment }
  newContainment[agentId] = (state.containment[agentId] || []).filter(id => id !== thingId)
  newContainment[roomId] = [...(newContainment[roomId] || []), thingId]

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
