import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Emerge from a container back into the room it's in.
// This is the reverse of hideIn.
// CHECK: agent is inside the container
// EXECUTE: move agent back to the container's room, set isHidden false
// REPORT: describe what happened
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

  // 1. Remove agent from container's containment
  const containerContents = state.containment[containerId] || []
  const newContainment = { ...state.containment }
  newContainment[containerId] = containerContents.filter(id => id !== agentId)

  // 2. Add agent to room's containment
  const roomContents = newContainment[roomId] || []
  newContainment[roomId] = [...roomContents, agentId]

  // 3. Update agent's locationId and isHidden
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
