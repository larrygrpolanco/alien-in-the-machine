import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Open a container.
// CHECK: exists, not already open, not locked
// EXECUTE: set isOpen to true
// REPORT: describe what happened
export function open(state: WorldState, containerId: string): ActionResult {
  const container = state.entities.containers[containerId]

  // === CHECK ===
  if (!container) {
    return { success: false, state, message: 'That does not exist.' }
  }

  if (container.isOpen) {
    return { success: false, state, message: `The ${container.name} is already open.` }
  }

  if (container.isLocked) {
    return { success: false, state, message: `The ${container.name} is locked.` }
  }

  // === EXECUTE ===
  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      containers: {
        ...state.entities.containers,
        [containerId]: { ...container, isOpen: true },
      },
    },
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You open the ${container.name}.`,
  }
}
