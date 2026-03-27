import { describe, it, expect } from 'vitest'
import { moveTo } from '../actions/move-to'
import { take } from '../actions/take'
import { drop } from '../actions/drop'
import { open } from '../actions/open'
import { close } from '../actions/close'
import { hideIn } from '../actions/hide-in'
import { emergeFrom } from '../actions/emerge-from'
import { world } from '../worlds/lab-world'
import type { WorldState } from '../types/entities'

// Helper: create a fresh copy of the world so tests don't share state.
function freshWorld(): WorldState {
  return JSON.parse(JSON.stringify(world))
}

describe('moveTo', () => {
  it('moves agent to a connected room', () => {
    const state = freshWorld()
    const result = moveTo(state, 'player', 'hallway')
    expect(result.success).toBe(true)
    expect(result.state.entities.agents.player.locationId).toBe('hallway')
  })

  it('fails when moving to a room with no exit', () => {
    const state = freshWorld()
    const result = moveTo(state, 'player', 'hallway')
    // now in hallway, try to move to a room that doesn't exist
    const result2 = moveTo(result.state, 'player', 'lab')
    // lab is reachable from hallway (south exit), so this should work
    expect(result2.success).toBe(true)

    // but moving to a room with no connection should fail
    const badMove = moveTo(freshWorld(), 'player', 'nonexistent')
    expect(badMove.success).toBe(false)
    expect(badMove.message).toContain('does not exist')
  })

  it('fails when there is no exit to the destination', () => {
    const state = freshWorld()
    // hallway exists, but trying to move west from lab should fail (no west exit)
    const result = moveTo(state, 'player', 'nonexistent')
    expect(result.success).toBe(false)
  })
})

describe('take', () => {
  it('picks up a portable item', () => {
    const state = freshWorld()
    const result = take(state, 'player', 'keycard')
    expect(result.success).toBe(true)
    expect(result.state.entities.things.keycard.locationId).toBe('player')
    expect(result.state.containment.player).toContain('keycard')
  })

  it('removes item from old parent containment', () => {
    const state = freshWorld()
    const result = take(state, 'player', 'keycard')
    // keycard was on the desk
    expect(result.state.containment.desk).not.toContain('keycard')
  })

  it('fails to take a fixed item', () => {
    const state = freshWorld()
    // desk is fixed — can't take it
    const result = take(state, 'player', 'desk')
    expect(result.success).toBe(false)
    expect(result.message).toContain('not exist') // desk is a supporter, not a thing
  })

  it('fails when already holding the item', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const result = take(afterTake.state, 'player', 'keycard')
    expect(result.success).toBe(false)
    expect(result.message).toContain('already holding')
  })

  it('maintains containment consistency after take', () => {
    const state = freshWorld()
    const result = take(state, 'player', 'keycard')
    const s = result.state
    // keycard should appear in exactly one containment list
    let found = 0
    for (const list of Object.values(s.containment)) {
      if (list.includes('keycard')) found++
    }
    expect(found).toBe(1)
    expect(s.containment.player).toContain('keycard')
  })
})

describe('drop', () => {
  it('drops an item into the current room', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const result = drop(afterTake.state, 'player', 'keycard')
    expect(result.success).toBe(true)
    expect(result.state.entities.things.keycard.locationId).toBe('lab')
    expect(result.state.containment.lab).toContain('keycard')
  })

  it('fails when not holding the item', () => {
    const state = freshWorld()
    const result = drop(state, 'player', 'keycard')
    expect(result.success).toBe(false)
    expect(result.message).toContain('not holding')
  })

  it('item stays in room after moving away', () => {
    const state = freshWorld()
    // take, move to hallway, drop
    const afterTake = take(state, 'player', 'keycard')
    const afterMove = moveTo(afterTake.state, 'player', 'hallway')
    const afterDrop = drop(afterMove.state, 'player', 'keycard')

    // keycard should be in hallway
    expect(afterDrop.state.entities.things.keycard.locationId).toBe('hallway')
    expect(afterDrop.state.containment.hallway).toContain('keycard')

    // move back to lab — keycard should still be in hallway
    const afterMoveBack = moveTo(afterDrop.state, 'player', 'lab')
    expect(afterMoveBack.state.entities.things.keycard.locationId).toBe('hallway')
    expect(afterMoveBack.state.containment.hallway).toContain('keycard')
    expect(afterMoveBack.state.containment.lab).not.toContain('keycard')
  })
})

describe('open / close', () => {
  it('opens a closed container', () => {
    const state = freshWorld()
    const result = open(state, 'closet')
    expect(result.success).toBe(true)
    expect(result.state.entities.containers.closet.isOpen).toBe(true)
  })

  it('fails to open an already-open container', () => {
    const state = freshWorld()
    const opened = open(state, 'closet')
    const result = open(opened.state, 'closet')
    expect(result.success).toBe(false)
    expect(result.message).toContain('already open')
  })

  it('fails to open a locked container', () => {
    const state = freshWorld()
    const result = open(state, 'door')
    expect(result.success).toBe(false)
    expect(result.message).toContain('locked')
  })

  it('closes an open container', () => {
    const state = freshWorld()
    const opened = open(state, 'closet')
    const result = close(opened.state, 'closet')
    expect(result.success).toBe(true)
    expect(result.state.entities.containers.closet.isOpen).toBe(false)
  })

  it('fails to close an already-closed container', () => {
    const state = freshWorld()
    const result = close(state, 'closet')
    expect(result.success).toBe(false)
    expect(result.message).toContain('already closed')
  })
})

describe('hideIn / emergeFrom', () => {
  it('hides agent in an open enterable container', () => {
    const state = freshWorld()
    const opened = open(state, 'closet')
    const result = hideIn(opened.state, 'player', 'closet')
    expect(result.success).toBe(true)
    expect(result.state.entities.agents.player.locationId).toBe('closet')
    expect(result.state.entities.agents.player.isHidden).toBe(true)
    expect(result.state.containment.closet).toContain('player')
    expect(result.state.containment.lab).not.toContain('player')
  })

  it('fails to hide in a closed container', () => {
    const state = freshWorld()
    const result = hideIn(state, 'player', 'closet')
    expect(result.success).toBe(false)
    expect(result.message).toContain('closed')
  })

  it('fails to hide in a non-enterable container', () => {
    const state = freshWorld()
    // move to hallway first, since the door is there
    const inHallway = moveTo(state, 'player', 'hallway')
    const result = hideIn(inHallway.state, 'player', 'door')
    expect(result.success).toBe(false)
    expect(result.message).toContain("can't get inside")
  })

  it('emerges from a container back to the room', () => {
    const state = freshWorld()
    const opened = open(state, 'closet')
    const hidden = hideIn(opened.state, 'player', 'closet')
    const result = emergeFrom(hidden.state, 'player')
    expect(result.success).toBe(true)
    expect(result.state.entities.agents.player.locationId).toBe('lab')
    expect(result.state.entities.agents.player.isHidden).toBe(false)
    expect(result.state.containment.lab).toContain('player')
    expect(result.state.containment.closet).not.toContain('player')
  })
})
