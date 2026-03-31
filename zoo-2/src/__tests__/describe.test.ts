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
  it('describes the current room header and atmosphere', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).toContain('=== LABORATORY ===')
    expect(text).toContain('fluorescent')
  })

  it('has a FURNITURE section with supporter and its contents', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).toContain('FURNITURE:')
    expect(text).toContain('Heavy Desk')
    expect(text).toContain('Keycard')
    expect(text).toContain('Biosample Vial')
  })

  it('describes a closed locked container in FURNITURE', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).toContain('Metal Closet')
    expect(text).toContain('(closed)')
  })

  it('has an EXITS section with the locked security door', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).toContain('EXITS:')
    expect(text).toContain('north')
    expect(text).toContain('Security Door')
    expect(text).toContain('(locked)')
  })

  it('does not show corridor contents when door is closed', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).not.toContain('Maintenance Corridor')
  })

  it('shows corridor as visible once door is open', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpen = open(afterUnlock.state, 'north_door')
    const text = describeZone(afterOpen.state, 'player')
    expect(text).toContain('Security Door')
    expect(text).toContain('(open)')
    expect(text).toContain('Maintenance Corridor')
  })

  it('describes storage through open corridor border', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const afterUnlock = unlock(afterTake.state, 'player', 'north_door')
    const afterOpenDoor = open(afterUnlock.state, 'north_door')
    const inCorridor = moveTo(afterOpenDoor.state, 'player', 'corridor')
    const text = describeZone(inCorridor.state, 'player')
    expect(text).toContain('=== MAINTENANCE CORRIDOR ===')
    expect(text).toContain('east')
    expect(text).toContain('Storage Bay')
    expect(text).toContain('Specimen Box')
  })

  it('describes hidden state when inside a container', () => {
    const state = freshWorld()
    const opened = open(state, 'metal_closet')
    const hidden = hideIn(opened.state, 'player', 'metal_closet')
    const text = describeZone(hidden.state, 'player')
    expect(text).toContain('=== INSIDE METAL CLOSET ===')
  })

  it('shows INVENTORY section when carrying items', () => {
    const state = freshWorld()
    const afterTake = take(state, 'player', 'keycard')
    const text = describeZone(afterTake.state, 'player')
    expect(text).toContain('INVENTORY:')
    expect(text).toContain('Keycard')
  })

  it('omits INVENTORY section when carrying nothing', () => {
    const state = freshWorld()
    const text = describeZone(state, 'player')
    expect(text).not.toContain('INVENTORY:')
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
