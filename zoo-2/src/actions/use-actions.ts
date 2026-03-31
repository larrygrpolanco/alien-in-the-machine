import { useState } from 'react'
import type { WorldState } from '../types/entities'
import {
  moveTo,
  take,
  drop,
  open as openAction,
  close as closeAction,
  hideIn,
  emergeFrom,
  putIn,
  unlock,
} from './index'

// useActions is a React hook that manages action execution.
// Holds message state and provides clean handler functions for App.tsx.
export function useActions(state: WorldState, setState: (s: WorldState) => void, agentId: string) {
  const [message, setMessage] = useState('')

  return {
    message,

    move(_direction: string, destinationId: string) {
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

    open(targetId: string) {
      const result = openAction(state, targetId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    close(targetId: string) {
      const result = closeAction(state, targetId)
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

    putIn(thingId: string, containerId: string) {
      const result = putIn(state, agentId, thingId, containerId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },

    unlock(targetId: string) {
      const result = unlock(state, agentId, targetId)
      setMessage(result.message)
      if (result.success) setState(result.state)
    },
  }
}
