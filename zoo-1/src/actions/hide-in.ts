import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Hide inside an enterable container.
// CHECK: container is open, enterable, in same room
// EXECUTE: move agent into container, set isHidden
// REPORT: describe what happened
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

  // Container must be in the same room as the agent
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
  // 1. Remove agent from room's containment
  const roomId = agent.locationId
  const roomContents = state.containment[roomId] || []
  const newContainment = { ...state.containment }
  newContainment[roomId] = roomContents.filter(id => id !== agentId)

  // 2. Add agent to container's containment
  const containerContents = newContainment[containerId] || []
  newContainment[containerId] = [...containerContents, agentId]

  // 3. Update agent's locationId and isHidden
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
