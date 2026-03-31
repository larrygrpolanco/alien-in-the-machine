import type { WorldState, Entity } from '../types/entities'

// Look up any entity by id across all entity tables.
// Includes the new doors table added in zoo-2.
export function getEntity(state: WorldState, id: string): Entity | undefined {
  return (
    state.entities.rooms[id]
    || state.entities.things[id]
    || state.entities.containers[id]
    || state.entities.supporters[id]
    || state.entities.agents[id]
    || state.entities.doors[id]
  )
}
