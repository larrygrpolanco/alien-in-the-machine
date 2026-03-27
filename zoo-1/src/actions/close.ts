import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Close a container.
// CHECK: exists, not already closed
// EXECUTE: set isOpen to false
// REPORT: describe what happened
export function close(state: WorldState, containerId: string): ActionResult {
  const container = state.entities.containers[containerId]

  // === CHECK ===
  if (!container) {
    return { success: false, state, message: 'That does not exist.' }
  }

  if (!container.isOpen) {
    return { success: false, state, message: `The ${container.name} is already closed.` }
  }

  // === EXECUTE ===
  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      containers: {
        ...state.entities.containers,
        [containerId]: { ...container, isOpen: false },
      },
    },
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You close the ${container.name}.`,
  }
}
