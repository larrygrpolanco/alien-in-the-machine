import type { WorldState } from '../types/entities'
import type { ActionResult } from './move-to'

// Unlock a Door or Container using a key item from the agent's inventory.
// Zoo-2 addition — needed for the keycard → north_door scenario.
//
// CHECK: target exists and is locked, target has a keyItemId, agent holds that item
// EXECUTE: set isLocked = false on the target
// REPORT: describe what happened
export function unlock(state: WorldState, agentId: string, targetId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  const agentInventory = state.containment[agentId] || []

  // === Try Door ===
  const door = state.entities.doors[targetId]
  if (door) {
    if (!door.isLocked) {
      return { success: false, state, message: `The ${door.name} is not locked.` }
    }
    if (!door.keyItemId) {
      return { success: false, state, message: `The ${door.name} has no keyhole.` }
    }
    if (!agentInventory.includes(door.keyItemId)) {
      const keyItem = state.entities.things[door.keyItemId]
      return {
        success: false,
        state,
        message: `You need the ${keyItem?.name ?? 'required key'} to unlock this.`,
      }
    }
    // EXECUTE
    const newState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        doors: {
          ...state.entities.doors,
          [targetId]: { ...door, isLocked: false },
        },
      },
    }
    return { success: true, state: newState, message: `You unlock the ${door.name}.` }
  }

  // === Try Container ===
  const container = state.entities.containers[targetId]
  if (container) {
    if (!container.isLocked) {
      return { success: false, state, message: `The ${container.name} is not locked.` }
    }
    if (!container.keyItemId) {
      return { success: false, state, message: `The ${container.name} has no keyhole.` }
    }
    if (!agentInventory.includes(container.keyItemId)) {
      const keyItem = state.entities.things[container.keyItemId]
      return {
        success: false,
        state,
        message: `You need the ${keyItem?.name ?? 'required key'} to unlock this.`,
      }
    }
    // EXECUTE
    const newState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        containers: {
          ...state.entities.containers,
          [targetId]: { ...container, isLocked: false },
        },
      },
    }
    return { success: true, state: newState, message: `You unlock the ${container.name}.` }
  }

  return { success: false, state, message: 'That does not exist.' }
}
