import { useState } from 'react'
import type { WorldState } from '../types/entities'
import { moveTo, take, drop, open as openAction, close as closeAction, hideIn, emergeFrom } from './index'

// useActions is a React hook that manages action execution.
//
// It holds the message state and provides clean handler functions.
// Each handler follows the same pattern:
//   1. Run the action's pure function
//   2. Show the result message
//   3. Update state if the action succeeded
//
// App.tsx just calls actions.move('north', 'hallway') — no state management needed.

export function useActions(state: WorldState, setState: (s: WorldState) => void, agentId: string) {
  const [message, setMessage] = useState('')

  return {
    message,

    move(direction: string, destinationId: string) {
      const result = moveTo(state, agentId, destinationId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    take(thingId: string) {
      const result = take(state, agentId, thingId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    drop(thingId: string) {
      const result = drop(state, agentId, thingId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    open(containerId: string) {
      const result = openAction(state, containerId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    close(containerId: string) {
      const result = closeAction(state, containerId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    hideIn(containerId: string) {
      const result = hideIn(state, agentId, containerId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    emergeFrom() {
      const result = emergeFrom(state, agentId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },
  }
}
