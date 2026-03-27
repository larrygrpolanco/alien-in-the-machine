import type { WorldState, Entity } from '../types/entities'

// Look up any entity by id across all the entity tables.
// Needed because our data is split into separate tables (rooms, things, containers, etc.)
export function getEntity(state: WorldState, id: string): Entity | undefined {
  return (
    state.entities.rooms[id]
    || state.entities.things[id]
    || state.entities.containers[id]
    || state.entities.supporters[id]
    || state.entities.agents[id]
  )
}
