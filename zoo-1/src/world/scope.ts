import type { WorldState } from '../types/entities'

// computeScope answers: "given this world state, what can the agent see right now?"
//
// It returns an array of entity IDs. Anything NOT in this array is invisible
// to the agent — they can't see it or interact with it.
//
// This function is called every render, derived from state. It is NOT stored
// in the state itself. This is important: scope changes automatically when
// you open a container or move to a new room, because it's computed fresh each time.

export function computeScope(state: WorldState, agentId: string): string[] {
  const agent = state.entities.agents[agentId]
  if (!agent) return []

  const scope: string[] = []

  // Step 1: find what's directly in the agent's room
  const roomId = agent.locationId
  const roomContents = state.containment[roomId] || []

  for (const id of roomContents) {
    // Everything in the room is visible by default
    scope.push(id)

    // Step 2: supporters are transparent — things on top are always visible
    const supporter = state.entities.supporters[id]
    if (supporter) {
      const onTop = state.containment[id] || []
      scope.push(...onTop)  // spread operator adds all items to the array
      continue
    }

    // Step 3: containers depend on their state
    const container = state.entities.containers[id]
    if (container) {
      // Closed + opaque = can't see inside (like a closed metal closet)
      if (!container.isOpen && container.isOpaque) continue

      // Open or transparent = contents visible
      const inside = state.containment[id] || []
      scope.push(...inside)
    }
  }

  return scope
}
