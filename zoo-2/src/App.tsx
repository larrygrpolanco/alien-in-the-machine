import { useState } from 'react'
import { world } from './worlds/lab-world'
import { computeScope } from './world/scope'
import { getEntity } from './world/entities'
import { describeZone } from './world/describe'
import { useActions } from './actions/use-actions'
import { getAvailableActions } from './actions/available-actions'
import type { WorldState } from './types/entities'

function App() {
  const [state, setState] = useState<WorldState>(world)
  const agent = state.entities.agents.player
  const actions = useActions(state, setState, agent.id)

  const inventory = Object.values(state.entities.things).filter(t => t.locationId === agent.id)
  const { reachable, perceivable } = computeScope(state, agent.id)
  const availableActions = getAvailableActions(state, agent.id)
  const zoneDescription = describeZone(state, agent.id)

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '680px', margin: '0 auto' }}>
      <h1>Zoo-2 — Zones &amp; Borders</h1>

      {/* Zone description (the describeZone output — what Zoo-3 will feed to the LLM) */}
      <pre style={{ background: '#111', color: '#cfc', padding: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.5, border: '1px solid #333' }}>
        {zoneDescription}
      </pre>

      {/* Action feedback */}
      {actions.message && (
        <p style={{ background: '#1a1a1a', color: '#0f0', padding: '0.5rem', margin: '1rem 0', border: '1px solid #333' }}>
          &gt; {actions.message}
        </p>
      )}

      {/* Available actions — numbered list, click to execute */}
      <h2>Available Actions</h2>
      {availableActions.length > 0 ? (
        <ol>
          {availableActions.map((a, i) => (
            <li key={i}>
              <button
                style={{ fontFamily: 'monospace', cursor: 'pointer', marginBottom: '0.25rem' }}
                onClick={() => {
                  if (a.name === 'move') actions.move('', a.targetId)
                  else if (a.name === 'take') actions.take(a.targetId)
                  else if (a.name === 'drop') actions.drop(a.targetId)
                  else if (a.name === 'open') actions.open(a.targetId)
                  else if (a.name === 'close') actions.close(a.targetId)
                  else if (a.name === 'hideIn') actions.hideIn(a.targetId)
                  else if (a.name === 'emergeFrom') actions.emergeFrom()
                  else if (a.name === 'putIn' && a.secondaryId) actions.putIn(a.targetId, a.secondaryId)
                  else if (a.name === 'unlock') actions.unlock(a.targetId)
                }}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p>No actions available.</p>
      )}

      {/* Scope debug panels */}
      <details style={{ marginTop: '2rem' }}>
        <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Debug: Scope</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <h3>Reachable (can act on)</h3>
            <ul>
              {reachable.map(id => {
                const entity = getEntity(state, id)
                return entity ? <li key={id}><em>{entity.kind}</em>: {entity.name}</li> : null
              })}
            </ul>
          </div>
          <div>
            <h3>Perceivable (can see, not act)</h3>
            {perceivable.length > 0 ? (
              <ul>
                {perceivable.map(id => {
                  const entity = getEntity(state, id)
                  return entity ? <li key={id}><em>{entity.kind}</em>: {entity.name}</li> : null
                })}
              </ul>
            ) : (
              <p>Nothing visible through borders.</p>
            )}
          </div>
        </div>
      </details>

      {/* Inventory */}
      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Inventory ({inventory.length})</summary>
        {inventory.length > 0 ? (
          <ul>{inventory.map(e => <li key={e.id}>{e.name}</li>)}</ul>
        ) : (
          <p>Empty.</p>
        )}
      </details>

      {/* Full world state */}
      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer' }}>Debug: Full World State</summary>
        <pre style={{ background: '#111', color: '#0f0', padding: '1rem', fontSize: '0.75rem', overflow: 'auto', marginTop: '0.5rem' }}>
          {JSON.stringify(state, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default App
