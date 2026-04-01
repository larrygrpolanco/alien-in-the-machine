import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Open a Container or Door.
//
// Zoo-2 change: generalized to handle both kinds.
// Tries Container first, then Door. Same check/execute/report logic for both.
export function open(state: WorldState, targetId: string): ActionResult {
  // === Try Container ===
  const container = state.entities.containers[targetId]
  if (container) {
    // CHECK
    if (container.isOpen) {
      return { success: false, state, message: `The ${container.name} is already open.` }
    }
    if (container.isLocked) {
      return { success: false, state, message: `The ${container.name} is locked.` }
    }
    // EXECUTE
    const newState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        containers: {
          ...state.entities.containers,
          [targetId]: { ...container, isOpen: true },
        },
      },
    }
    // REPORT
    return { success: true, state: newState, message: `You open the ${container.name}.` }
  }

  // === Try Door ===
  const door = state.entities.doors[targetId]
  if (door) {
    // CHECK
    if (door.isOpen) {
      return { success: false, state, message: `The ${door.name} is already open.` }
    }
    if (door.isLocked) {
      return { success: false, state, message: `The ${door.name} is locked.` }
    }
    // EXECUTE
    const newState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        doors: {
          ...state.entities.doors,
          [targetId]: { ...door, isOpen: true },
        },
      },
    }
    // REPORT
    return { success: true, state: newState, message: `You open the ${door.name}.` }
  }

  return { success: false, state, message: 'That does not exist.' }
}
