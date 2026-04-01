import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Hide inside an enterable container.
// The agent's locationId moves to the container. isHidden is set true.
// The agent no longer appears in the room's containment list.
export function hideIn(state: WorldState, agentId: string, containerId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  const container = state.entities.containers[containerId]

  // === CHECK ===
  if (!container) {
    return { success: false, state, message: 'That does not exist.' }
  }

  if (container.locationId !== agent.locationId) {
    return { success: false, state, message: `The ${container.name} is not here.` }
  }

  if (!container.isEnterable) {
    return { success: false, state, message: `You can't get inside the ${container.name}.` }
  }

  if (!container.isOpen) {
    return { success: false, state, message: `The ${container.name} is closed.` }
  }

  // === EXECUTE ===
  const roomId = agent.locationId
  const newContainment = { ...state.containment }
  newContainment[roomId] = (state.containment[roomId] || []).filter(id => id !== agentId)
  newContainment[containerId] = [...(newContainment[containerId] || []), agentId]

  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      agents: {
        ...state.entities.agents,
        [agentId]: { ...agent, locationId: containerId, isHidden: true },
      },
    },
    containment: newContainment,
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You climb into the ${container.name} and pull the door shut.`,
  }
}
