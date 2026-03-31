import { describe, it, expect } from 'vitest'
import { computeScope } from '../world/scope'
import { open } from '../actions/open'
import { close } from '../actions/close'
import { take } from '../actions/take'
import { unlock } from '../actions/unlock'
import { moveTo } from '../actions/move-to'
import { hideIn } from '../actions/hide-in'
import { world } from '../worlds/lab-world'
import type { WorldState } from '../types/entities'

function freshWorld(): WorldState {
  return JSON.parse(JSON.stringify(world))
}

describe('computeScope — reachable', () => {
  it('includes entities in the current room', () => {
    const state = freshWorld()
    const { reachable } = computeScope(state, 'player')
    // desk (supporter), metal_closet (container) are in lab
    expect(reachable).toContain('desk')
    expect(reachable).toContain('metal_closet')
  })

  it('includes items on a supporter', () => {
    const state = freshWorld()
    const { reachable } = computeScope(state, 'player')
    // keycard and biosample are on the desk
    expect(reachable).toContain('keycard')
    expect(reachable).toContain('biosample')
  })

  it('does not include contents of closed opaque container', () => {
    const state = freshWorld()
    // metal_closet starts closed and opaque
    const { reachable } = computeScope(state, 'player')
    // nothing inside the closet initially, but check that items put in are hidden
    // Put an item in the closet manually via containment tweak
    const modState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        things: {
          ...state.entities.things,
          keycard: { ...state.entities.things.keycard, locationId: 'metal_closet' },
        },
      },
      containment: {
        ...state.containment,
        desk: state.containment.desk.filter(id => id !== 'keycard'),
        metal_closet: ['keycard'],
      },
    }
    const { reachable: r } = computeScope(modState, 'player')
    expect(r).not.toContain('keycard')
  })

  it('includes contents of open container', () => {
    const state = freshWorld()
    // Put keycard in closet, open it, check scope
    const modState: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        things: {
          ...state.entities.things,
          keycard: { ...state.entities.things.keycard, locationId: 'metal_closet' },
        },
        containers: {
          ...state.entities.containers,
          metal_closet: { ...state.entities.containers.metal_closet, isOpen: true },
        },
      },
      containment: {
        ...state.containment,
        desk: state.containment.desk.filter(id => id !== 'keycard'),
        metal_closet: ['keycard'],
      },
    }
    const { reachable } = computeScope(modState, 'player')
    expect(reachable).toContain('keycard')
  })

  it('includes the door on an adjacent border', () => {
    const state = freshWorld()
    // north_door is on the lab↔corridor border — should be reachable from lab
    const { reachable } = computeScope(state, 'player')
    expect(reachable).toContain('north_door')
  })
})

describe('computeScope — perceivable (cross-zone)', () => {
  it('cannot see into corridor through closed locked door', () => {
    const state = freshWorld()
    const { perceivable } = computeScope(state, 'player')
    // Nothing in corridor, but even if there were, should not be perceivable
    expect(perceivable).toHaveLength(0)
  })

  it('can see into corridor once door is open', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const { perceivable } = computeScope(afterOpen.state, 'player')
    // Corridor is empty so perceivable should not include corridor things,
    // but the corridor IS now visible (perceivable array exists and no corridor entities to see)
    // We verify by adding something to corridor and checking
    const modState: WorldState = {
      ...afterOpen.state,
      entities: {
        ...afterOpen.state.entities,
        things: {
          ...afterOpen.state.entities.things,
          biosample: { ...afterOpen.state.entities.things.biosample, locationId: 'corridor' },
        },
      },
      containment: {
        ...afterOpen.state.containment,
        desk: afterOpen.state.containment.desk.filter(id => id !== 'biosample'),
        corridor: ['biosample'],
      },
    }
    const { perceivable: p } = computeScope(modState, 'player')
    expect(p).toContain('biosample')
  })

  it('can see into storage from corridor through open border', () => {
    const state = freshWorld()
    // Move player to corridor
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpenDoor = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpenDoor.state, 'player', 'corridor')
    const { perceivable } = computeScope(inCorridor.state, 'player')
    // specimen_box is in storage, and corridor→storage is an open border
    expect(perceivable).toContain('specimen_box')
  })

  it('cannot perceive into closed-door room after closing door', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const closed = close(afterOpen.state, 'north_door')
    const { perceivable } = computeScope(closed.state, 'player')
    // Closed door — no cross-zone perception
    expect(perceivable).toHaveLength(0)
  })
})

describe('computeScope — hidden agent', () => {
  it('hidden agent scope is limited to container contents', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const hidden = hideIn(opened.state, 'player', 'metal_closet')
    const { reachable, perceivable } = computeScope(hidden.state, 'player')
    // closet is empty — reachable is empty, perceivable is empty
    expect(reachable).toHaveLength(0)
    expect(perceivable).toHaveLength(0)
  })

  it('hidden agent does not see room or borders', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const hidden = hideIn(opened.state, 'player', 'metal_closet')
    const { reachable } = computeScope(hidden.state, 'player')
    // Should not see desk, keycard, north_door, etc.
    expect(reachable).not.toContain('desk')
    expect(reachable).not.toContain('north_door')
    expect(reachable).not.toContain('keycard')
  })
})
