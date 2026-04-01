import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Emerge from a container back into the room it occupies.
// Reverse of hideIn.
export function emergeFrom(state: WorldState, agentId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  const container = state.entities.containers[agent.locationId]

  // === CHECK ===
  if (!agent.isHidden || !container) {
    return { success: false, state, message: 'You are not inside anything.' }
  }

  // === EXECUTE ===
  const containerId = agent.locationId
  const roomId = container.locationId
  const newContainment = { ...state.containment }
  newContainment[containerId] = (state.containment[containerId] || []).filter(id => id !== agentId)
  newContainment[roomId] = [...(newContainment[roomId] || []), agentId]

  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      agents: {
        ...state.entities.agents,
        [agentId]: { ...agent, locationId: roomId, isHidden: false },
      },
    },
    containment: newContainment,
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You climb out of the ${container.name}.`,
  }
}
