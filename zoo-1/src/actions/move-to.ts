import type { WorldState } from '../types/entities'

// Every action returns this shape — tells the caller what happened.
export interface ActionResult {
  success: boolean    // did the action work?
  state: WorldState   // the new world state (or unchanged state if it failed)
  message: string     // human-readable description of what happened
}

// Move an agent from their current room to a connected room.
//
// THREE-PHASE PATTERN (borrowed from Inform 7):
//   CHECK   — validate preconditions. If anything fails, bail out with an error message.
//   EXECUTE — produce a new state with the change applied.
//   REPORT  — describe what happened in plain English.
//
// This pattern keeps actions predictable: they never partially succeed.
// Either everything works (success: true, new state) or nothing changes (success: false, old state).

export function moveTo(state: WorldState, agentId: string, destinationId: string): ActionResult {
  const agent = state.entities.agents[agentId]
  if (!agent) {
    return { success: false, state, message: 'Agent not found.' }
  }

  const currentRoom = state.entities.rooms[agent.locationId]
  const destination = state.entities.rooms[destinationId]

  // === CHECK ===
  if (!destination) {
    return { success: false, state, message: 'That room does not exist.' }
  }

  // Look through the current room's exits to find one that leads to the destination.
  // Object.entries gives us [['north', 'hallway'], ['south', 'lab']] — we search for a match.
  const direction = Object.entries(currentRoom.exits).find(
    ([, roomId]) => roomId === destinationId
  )?.[0]  // [0] is the direction string, [1] is the roomId

  if (!direction) {
    return { success: false, state, message: `There is no exit to ${destination.name} from here.` }
  }

  // === EXECUTE ===
  // IMPORTANT: we never mutate the old state. Instead we build a new one.
  // This is called "immutable update" — React needs this to know something changed.
  // The spread operator (...) copies everything, then we override just what changed.
  const newState: WorldState = {
    ...state,                          // copy top-level fields
    entities: {
      ...state.entities,               // copy all entity tables
      agents: {
        ...state.entities.agents,      // copy all agents
        [agentId]: { ...agent, locationId: destinationId }, // override just this agent
      },
    },
  }

  // === REPORT ===
  return {
    success: true,
    state: newState,
    message: `You walk ${direction} to the ${destination.name}.`,
  }
}
