import { describe, it, expect } from 'vitest'
import { describeZone } from '../world/describe'
import { getAvailableActions } from '../actions/available-actions'
import { open } from '../actions/open'
import { take } from '../actions/take'
import { unlock } from '../actions/unlock'
import { moveTo } from '../actions/move-to'
import { hideIn } from '../actions/hide-in'
import { world } from '../worlds/lab-world'
import type { WorldState } from '../types/entities'

function freshWorld(): WorldState {
  return JSON.parse(JSON.stringify(world))
}

describe('describeZone', () => {
  it('describes the current room name and description', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).toContain('Laboratory')
    expect(text).toContain('fluorescent')
  })

  it('describes a supporter and its contents', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).toContain('Heavy Desk')
    expect(text).toContain('Keycard')
    expect(text).toContain('Biosample Vial')
  })

  it('describes a closed locked door to the north', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).toContain('north')
    expect(text).toContain('Security Door')
    expect(text).toContain('locked')
  })

  it('does not describe corridor contents when door is closed', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).not.toContain('Maintenance Corridor')
  })

  it('describes corridor as visible once door is open', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const text = describeZone(afterOpen.state, 'player')
    expect(text).toContain('Security Door')
    expect(text).toContain('open')
    // Corridor is now visible through open door — door state should mention open
    expect(text).toContain('Through the open door')
  })

  it('describes storage through open corridor border', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpenDoor = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpenDoor.state, 'player', 'corridor')
    const text = describeZone(inCorridor.state, 'player')
    expect(text).toContain('Maintenance Corridor')
    expect(text).toContain('east')
    expect(text).toContain('Storage Bay')
    // specimen_box is perceivable through open border
    expect(text).toContain('Specimen Box')
  })

  it('describes hidden state when inside a container', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const hidden = hideIn(opened.state, 'player', 'metal_closet')
    const text = describeZone(hidden.state, 'player')
    expect(text).toContain('Metal Closet')
    expect(text).toContain('inside')
  })
})

describe('getAvailableActions', () => {
  it('does not include move to corridor when door is locked', () => {
    const state = freshWorld()
    const actions = getAvailableActions(state, 'player')
    const moveActions = actions.filter(a => a.name === 'move')
    expect(moveActions.every(a => a.targetId !== 'corridor')).toBe(true)
  })

  it('includes move to corridor after unlock + open', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const actions = getAvailableActions(afterOpen.state, 'player')
    const moveActions = actions.filter(a => a.name === 'move')
    expect(moveActions.some(a => a.targetId === 'corridor')).toBe(true)
  })

  it('includes unlock action when holding keycard', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const actions = getAvailableActions(afterTake.state, 'player')
    const unlockActions = actions.filter(a => a.name === 'unlock')
    expect(unlockActions.some(a => a.targetId === 'north_door')).toBe(true)
  })

  it('does not include unlock when not holding the key', () => {
    const state = freshWorld()
    const actions = getAvailableActions(state, 'player')
    const unlockActions = actions.filter(a => a.name === 'unlock')
    expect(unlockActions).toHaveLength(0)
  })

  it('includes putIn when holding an item and an open container is reachable', () => {
    // Travel to storage and check putIn is available for specimen_box
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterTake2 = take(afterTake.state, 'player', 'biosample')
    const afterUnlock = unlock(afterTake2.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpen.state, 'player', 'corridor')
    const inStorage = moveTo(inCorridor.state, 'player', 'storage')
    const actions = getAvailableActions(inStorage.state, 'player')
    const putInActions = actions.filter(a => a.name === 'putIn')
    expect(putInActions.some(a => a.secondaryId === 'specimen_box')).toBe(true)
  })

  it('only returns emergeFrom when hidden', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const hidden = hideIn(opened.state, 'player', 'metal_closet')
    const actions = getAvailableActions(hidden.state, 'player')
    expect(actions).toHaveLength(1)
    expect(actions[0].name).toBe('emergeFrom')
  })
})
