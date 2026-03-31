import type { WorldState } from '../types/entities'

export interface ActionResult {
  success: boolean
  state: WorldState
  message: string
}

// Move an agent from their current room to an adjacent room.
//
// Zoo-2 change: movement checks the borders array instead of room.exits.
// A border of type 'door' requires the door to be unlocked AND open.
// A border of type 'open' always allows movement.
// A border of type 'wall' always blocks movement.
// If no border exists between the two rooms, movement fails.
//
// THREE-PHASE PATTERN: CHECK → EXECUTE → REPORT
export function moveTo(state: WorldState, agentId: string, destinationId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  // === CHECK ===
  const destination = state.entities.rooms[destinationId]
  if (!destination) {
    return { success: false, state, message: 'That room does not exist.' }
  }

  const currentRoomId = agent.locationId

  // Find the border that connects both rooms
  const border = state.borders.find(b =>
    b.between.includes(currentRoomId) && b.between.includes(destinationId)
  )

  if (!border) {
    return { success: false, state, message: `There is no path to the ${destination.name} from here.` }
  }

  const direction = border.direction[currentRoomId]

  if (border.type === 'wall') {
    return { success: false, state, message: 'A wall blocks the way.' }
  }

  if (border.type === 'door' && border.doorId) {
    const door = state.entities.doors[border.doorId]
    if (!door) {
      return { success: false, state, message: 'The door cannot be found.' }
    }
    if (door.isLocked) {
      return { success: false, state, message: `The ${door.name} is locked.` }
    }
    if (!door.isOpen) {
      return { success: false, state, message: `The ${door.name} is closed.` }
    }
  }

  // === EXECUTE ===
  const newState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      agents: {
        ...state.entities.agents,
        [agentId]: { ...agent, locationId: destinationId },
      },
    },
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You go ${direction} to the ${destination.name}.`,
  }
}
