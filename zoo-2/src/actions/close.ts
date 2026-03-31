import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Close a Container or Door.
//
// Zoo-2 change: generalized to handle both kinds.
export function close(state: WorldState, targetId: string): ActionResult {
  // === Try Container ===
  const container = state.entities.containers[targetId]
  if (container) {
    // CHECK
    if (!container.isOpen) {
      return { success: false, state, message: `The ${container.name} is already closed.` }
    }
    // EXECUTE
    const newState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        containers: {
          ...state.entities.containers,
          [targetId]: { ...container, isOpen: false },
        },
      },
    }
    // REPORT
    return { success: true, state: newState, message: `You close the ${container.name}.` }
  }

  // === Try Door ===
  const door = state.entities.doors[targetId]
  if (door) {
    // CHECK
    if (!door.isOpen) {
      return { success: false, state, message: `The ${door.name} is already closed.` }
    }
    // EXECUTE
    const newState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        doors: {
          ...state.entities.doors,
          [targetId]: { ...door, isOpen: false },
        },
      },
    }
    // REPORT
    return { success: true, state: newState, message: `You close the ${door.name}.` }
  }

  return { success: false, state, message: 'That does not exist.' }
}
