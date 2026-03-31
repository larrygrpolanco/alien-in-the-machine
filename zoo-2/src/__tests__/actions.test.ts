import { describe, it, expect } from 'vitest'
import { moveTo } from '../actions/move-to'
import { take } from '../actions/take'
import { drop } from '../actions/drop'
import { open } from '../actions/open'
import { close } from '../actions/close'
import { hideIn } from '../actions/hide-in'
import { emergeFrom } from '../actions/emerge-from'
import { putIn } from '../actions/put-in'
import { unlock } from '../actions/unlock'
import { world } from '../worlds/lab-world'
import type { WorldState } from '../types/entities'

function freshWorld(): WorldState {
  return JSON.parse(JSON.stringify(world))
}

// ============================================================
// moveTo — now uses borders instead of room.exits
// ============================================================
describe('moveTo', () => {
  it('fails when the door is locked', () => {
    const state = freshWorld()
    // north_door starts locked — cannot move from lab to corridor
    const result = moveTo(state, 'player', 'corridor')
    expect(result.success).toBe(false)
    expect(result.message).toContain('locked')
  })

  it('fails when the door is unlocked but still closed', () => {
    const state = freshWorld()
    const unlocked = unlock(state, 'player', 'north_door')
    expect(unlocked.success).toBe(false) // player has no keycard yet

    // Give player the keycard first
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    expect(afterUnlock.success).toBe(true)

    // Door is unlocked but still closed — movement should fail
    const result = moveTo(afterUnlock.state, 'player', 'corridor')
    expect(result.success).toBe(false)
    expect(result.message).toContain('closed')
  })

  it('moves through a door after unlock + open', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const result = moveTo(afterOpen.state, 'player', 'corridor')
    expect(result.success).toBe(true)
    expect(result.state.entities.agents.player.locationId).toBe('corridor')
    expect(result.message).toContain('north')
  })

  it('moves freely through an open border (corridor → storage)', () => {
    const state = freshWorld()
    // Get player to corridor first
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpen.state, 'player', 'corridor')
    expect(inCorridor.success).toBe(true)

    // corridor → storage has an open border — no door required
    const result = moveTo(inCorridor.state, 'player', 'storage')
    expect(result.success).toBe(true)
    expect(result.state.entities.agents.player.locationId).toBe('storage')
  })

  it('fails when no border connects the rooms', () => {
    const state = freshWorld()
    // lab and storage are not directly connected
    const result = moveTo(state, 'player', 'storage')
    expect(result.success).toBe(false)
    expect(result.message).toContain('no path')
  })

  it('fails for a non-existent destination', () => {
    const state = freshWorld()
    const result = moveTo(state, 'player', 'void')
    expect(result.success).toBe(false)
    expect(result.message).toContain('does not exist')
  })
})

// ============================================================
// take — largely unchanged from zoo-1
// ============================================================
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
    expect(result.state.containment.desk).not.toContain('keycard')
  })

  it('fails when already holding', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const result = take(afterTake.state, 'player', 'keycard')
    expect(result.success).toBe(false)
    expect(result.message).toContain('already holding')
  })

  it('fails for a non-thing entity', () => {
    const state = freshWorld()
    const result = take(state, 'player', 'desk')
    expect(result.success).toBe(false)
    expect(result.message).toContain('not exist')
  })

  it('maintains containment consistency after take', () => {
    const state = freshWorld()
    const result = take(state, 'player', 'keycard')
    let found = 0
    for (const list of Object.values(result.state.containment)) {
      if (list.includes('keycard')) found++
    }
    expect(found).toBe(1)
    expect(result.state.containment.player).toContain('keycard')
  })

  it('fails to take item from a closed container', () => {
    // Put biosample in specimen_box, then close it, then try to take
    const state = freshWorld()
    const s1 = take(state, 'player', 'biosample')
    // Move to storage
    const s2 = take(s1.state, 'player', 'keycard')
    // Manually build state with biosample inside a closed specimen_box
    const closedState: typeof state = {
      ...state,
      entities: {
        ...state.entities,
        containers: {
          ...state.entities.containers,
          specimen_box: { ...state.entities.containers.specimen_box, isOpen: false },
        },
        things: {
          ...state.entities.things,
          biosample: { ...state.entities.things.biosample, locationId: 'specimen_box' },
        },
      },
      containment: {
        ...state.containment,
        desk: state.containment.desk.filter(id => id !== 'biosample'),
        specimen_box: ['biosample'],
      },
    }
    const result = take(closedState, 'player', 'biosample')
    expect(result.success).toBe(false)
    expect(result.message).toContain('closed')
  })
})

// ============================================================
// drop
// ============================================================
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

  it('item stays in room after agent moves away', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterTake2 = take(afterTake.state, 'player', 'biosample')
    const afterUnlock = unlock(afterTake2.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpen.state, 'player', 'corridor')
    const afterDrop = drop(inCorridor.state, 'player', 'biosample')

    expect(afterDrop.state.entities.things.biosample.locationId).toBe('corridor')
    expect(afterDrop.state.containment.corridor).toContain('biosample')

    // Move back — biosample stays in corridor
    const back = moveTo(afterDrop.state, 'player', 'lab')
    expect(back.state.containment.lab).not.toContain('biosample')
  })
})

// ============================================================
// open / close — generalized for Container and Door
// ============================================================
describe('open / close', () => {
  it('opens a closed container', () => {
    const state = freshWorld()
    const result = open(state, 'metal_closet')
    expect(result.success).toBe(true)
    expect(result.state.entities.containers.metal_closet.isOpen).toBe(true)
  })

  it('fails to open an already-open container', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const result = open(opened.state, 'metal_closet')
    expect(result.success).toBe(false)
    expect(result.message).toContain('already open')
  })

  it('closes an open container', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const result = close(opened.state, 'metal_closet')
    expect(result.success).toBe(true)
    expect(result.state.entities.containers.metal_closet.isOpen).toBe(false)
  })

  it('fails to close an already-closed container', () => {
    const state = freshWorld()
    const result = close(state, 'metal_closet')
    expect(result.success).toBe(false)
    expect(result.message).toContain('already closed')
  })

  it('opens a door after it is unlocked', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const result = open(afterUnlock.state, 'north_door')
    expect(result.success).toBe(true)
    expect(result.state.entities.doors.north_door.isOpen).toBe(true)
  })

  it('fails to open a locked door', () => {
    const state = freshWorld()
    const result = open(state, 'north_door')
    expect(result.success).toBe(false)
    expect(result.message).toContain('locked')
  })

  it('closes an open door', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const result = close(afterOpen.state, 'north_door')
    expect(result.success).toBe(true)
    expect(result.state.entities.doors.north_door.isOpen).toBe(false)
  })
})

// ============================================================
// hideIn / emergeFrom
// ============================================================
describe('hideIn / emergeFrom', () => {
  it('hides in an open enterable container', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const result = hideIn(opened.state, 'player', 'metal_closet')
    expect(result.success).toBe(true)
    expect(result.state.entities.agents.player.locationId).toBe('metal_closet')
    expect(result.state.entities.agents.player.isHidden).toBe(true)
    expect(result.state.containment.metal_closet).toContain('player')
    expect(result.state.containment.lab).not.toContain('player')
  })

  it('fails to hide in a closed container', () => {
    const state = freshWorld()
    const result = hideIn(state, 'player', 'metal_closet')
    expect(result.success).toBe(false)
    expect(result.message).toContain('closed')
  })

  it('fails to hide in a non-enterable container', () => {
    const state = freshWorld()
    // Need to get player to storage first
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpen.state, 'player', 'corridor')
    const inStorage = moveTo(inCorridor.state, 'player', 'storage')
    const result = hideIn(inStorage.state, 'player', 'specimen_box')
    expect(result.success).toBe(false)
    expect(result.message).toContain("can't get inside")
  })

  it('emerges back to the room', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const hidden = hideIn(opened.state, 'player', 'metal_closet')
    const result = emergeFrom(hidden.state, 'player')
    expect(result.success).toBe(true)
    expect(result.state.entities.agents.player.locationId).toBe('lab')
    expect(result.state.entities.agents.player.isHidden).toBe(false)
    expect(result.state.containment.lab).toContain('player')
    expect(result.state.containment.metal_closet).not.toContain('player')
  })

  it('fails to emerge when not hidden', () => {
    const state = freshWorld()
    const result = emergeFrom(state, 'player')
    expect(result.success).toBe(false)
    expect(result.message).toContain('not inside')
  })
})

// ============================================================
// putIn — Zoo-2 addition
// ============================================================
describe('putIn', () => {
  it('puts a held item into an open container', () => {
    const state = freshWorld()
    // Take biosample, travel to storage, put it in specimen_box
    const afterTake = take(state, 'player', 'keycard')
    const afterTake2 = take(afterTake.state, 'player', 'biosample')
    const afterUnlock = unlock(afterTake2.state, 'player', 'north_door')
    const afterOpenDoor = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpenDoor.state, 'player', 'corridor')
    const inStorage = moveTo(inCorridor.state, 'player', 'storage')
    const result = putIn(inStorage.state, 'player', 'biosample', 'specimen_box')

    expect(result.success).toBe(true)
    expect(result.state.entities.things.biosample.locationId).toBe('specimen_box')
    expect(result.state.containment.specimen_box).toContain('biosample')
    expect(result.state.containment.player).not.toContain('biosample')
  })

  it('fails when not holding the item', () => {
    const state = freshWorld()
    // Biosample is on desk, not held
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpen.state, 'player', 'corridor')
    const inStorage = moveTo(inCorridor.state, 'player', 'storage')
    const result = putIn(inStorage.state, 'player', 'biosample', 'specimen_box')
    expect(result.success).toBe(false)
    expect(result.message).toContain('not holding')
  })

  it('fails when container is closed', () => {
    const state = freshWorld()
    // Close the specimen_box first, then try putIn
    const afterTake = take(state, 'player', 'keycard')
    const afterTake2 = take(afterTake.state, 'player', 'biosample')
    const afterUnlock = unlock(afterTake2.state, 'player', 'north_door')
    const afterOpenDoor = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpenDoor.state, 'player', 'corridor')
    const inStorage = moveTo(inCorridor.state, 'player', 'storage')
    const closed = close(inStorage.state, 'specimen_box')
    const result = putIn(closed.state, 'player', 'biosample', 'specimen_box')
    expect(result.success).toBe(false)
    expect(result.message).toContain('closed')
  })

  it('maintains containment consistency after putIn', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterTake2 = take(afterTake.state, 'player', 'biosample')
    const afterUnlock = unlock(afterTake2.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpen.state, 'player', 'corridor')
    const inStorage = moveTo(inCorridor.state, 'player', 'storage')
    const result = putIn(inStorage.state, 'player', 'biosample', 'specimen_box')

    // biosample should appear in exactly one containment list
    let found = 0
    for (const list of Object.values(result.state.containment)) {
      if (list.includes('biosample')) found++
    }
    expect(found).toBe(1)
  })
})

// ============================================================
// unlock — Zoo-2 addition
// ============================================================
describe('unlock', () => {
  it('unlocks a door when holding the key item', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const result = unlock(afterTake.state, 'player', 'north_door')
    expect(result.success).toBe(true)
    expect(result.state.entities.doors.north_door.isLocked).toBe(false)
  })

  it('fails to unlock without the key item', () => {
    const state = freshWorld()
    const result = unlock(state, 'player', 'north_door')
    expect(result.success).toBe(false)
    expect(result.message).toContain('Keycard')
  })

  it('fails to unlock something that is not locked', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const result = unlock(afterUnlock.state, 'player', 'north_door')
    expect(result.success).toBe(false)
    expect(result.message).toContain('not locked')
  })

  it('fails for a non-existent target', () => {
    const state = freshWorld()
    const result = unlock(state, 'player', 'ghost_door')
    expect(result.success).toBe(false)
    expect(result.message).toContain('does not exist')
  })
})
