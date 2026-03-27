import { useState } from 'react'
import { world } from './worlds/lab-world'
import { computeScope } from './world/scope'
import { getEntity } from './world/entities'
import { useActions } from './actions/use-actions'
import type { WorldState, Entity, Container, Supporter, Thing } from './types/entities'

function App() {
  const [state, setState] = useState<WorldState>(world)

  const agent = state.entities.agents.player
  const actions = useActions(state, setState, agent.id)

  // Inventory = things whose locationId matches the agent
  const inventory = Object.values(state.entities.things).filter(
    t => t.locationId === agent.id
  )

  // === Agent is hidden inside a container ===
  const container = state.entities.containers[agent.locationId]
  if (agent.isHidden && container) {
    const containerScope = computeScope(state, agent.id)

    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Inside the {container.name}</h1>
        <p>You are hiding inside the {container.name}.</p>

        {actions.message && (
          <p style={{ background: '#1a1a1a', color: '#0f0', padding: '0.5rem', margin: '1rem 0' }}>
            {actions.message}
          </p>
        )}

        <h2>Inventory:</h2>
        {inventory.length > 0 ? (
          <ul>{inventory.map(e => <li key={e.id}>{e.name}</li>)}</ul>
        ) : (
          <p>Empty.</p>
        )}

        <button onClick={() => actions.emergeFrom()}>
          Come out
        </button>

        {/* Debug: scope */}
        <h2>Scope (what you can see):</h2>
        <ul>
          {containerScope.map(id => {
            const entity = getEntity(state, id)
            return entity ? <li key={id}>{entity.kind}: {entity.name}</li> : null
          })}
        </ul>

        {/* Debug: full state */}
        <pre style={{ background: '#1a1a1a', color: '#0f0', padding: '1rem', fontSize: '0.8rem', overflow: 'auto', marginTop: '2rem' }}>
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>
    )
  }

  // === Agent is in a room (normal view) ===
  const room = state.entities.rooms[agent.locationId]
  const roomContents = state.containment[room.id] || []
  const scope = computeScope(state, agent.id)
  const inScope = (id: string) => scope.includes(id)

  // Sort room contents into categories for display
  const directThings: Entity[] = []
  const supporters: Supporter[] = []
  const containers: Container[] = []

  for (const id of roomContents) {
    const entity = getEntity(state, id)
    if (!entity) continue
    if (entity.kind === 'supporter') supporters.push(entity)
    else if (entity.kind === 'container') containers.push(entity)
    else directThings.push(entity)
  }

  // Render a thing with a Take button if it's portable and in scope
  function renderThing(e: Thing) {
    const canTake = inScope(e.id) && e.isPortable && !e.isFixed && e.locationId !== agent.id
    return (
      <li key={e.id}>
        {e.name}
        {canTake && (
          <button onClick={() => actions.take(e.id)} style={{ marginLeft: '0.5rem' }}>
            Take
          </button>
        )}
      </li>
    )
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '600px', margin: '0 auto' }}>
      <h1>{room.name}</h1>
      <p>{room.description}</p>

      {actions.message && (
        <p style={{ background: '#1a1a1a', color: '#0f0', padding: '0.5rem', margin: '1rem 0' }}>
          {actions.message}
        </p>
      )}

      {/* Things directly in the room */}
      {directThings.length > 0 && (
        <>
          <h2>Things here:</h2>
          <ul>{directThings.map(e => {
            if (e.kind === 'thing') return renderThing(e)
            return <li key={e.id}>{e.name}</li>
          })}</ul>
        </>
      )}

      {/* Supporters — show what's on top */}
      {supporters.map(s => {
        const onTop = (state.containment[s.id] || [])
          .map(id => getEntity(state, id))
          .filter(Boolean) as Entity[]
        return (
          <div key={s.id}>
            <h2>On the {s.name}:</h2>
            {onTop.length > 0 ? (
              <ul>{onTop.map(e => {
                if (e.kind === 'thing') return renderThing(e)
                return <li key={e.id}>{e.name}</li>
              })}</ul>
            ) : (
              <p>Nothing.</p>
            )}
          </div>
        )
      })}

      {/* Containers — with open/close and hide buttons */}
      {containers.map(c => (
        <div key={c.id}>
          <h2>
            {c.name} ({c.isOpen ? 'open' : 'closed'}):
            {!c.isLocked && (
              <button
                onClick={() => c.isOpen ? actions.close(c.id) : actions.open(c.id)}
                style={{ marginLeft: '0.5rem' }}
              >
                {c.isOpen ? 'Close' : 'Open'}
              </button>
            )}
            {c.isOpen && c.isEnterable && agent.locationId === c.locationId && (
              <button onClick={() => actions.hideIn(c.id)} style={{ marginLeft: '0.5rem' }}>
                Hide inside
              </button>
            )}
          </h2>
          {(() => {
            const inside = (state.containment[c.id] || [])
              .map(id => getEntity(state, id))
              .filter(Boolean) as Entity[]
            if (inside.length === 0) return <p>{c.isOpen ? 'Nothing inside.' : 'Unknown.'}</p>
            return (
              <ul>
                {inside.map(e => (
                  <li key={e.id}>
                    {inScope(e.id) ? e.name : '(hidden)'}
                  </li>
                ))}
              </ul>
            )
          })()}
        </div>
      ))}

      {/* Exits */}
      <h2>Exits:</h2>
      <ul>
        {Object.entries(room.exits).map(([dir, roomId]) => (
          <li key={dir}>
            <button onClick={() => actions.move(dir, roomId)}>
              Go {dir} → {state.entities.rooms[roomId]?.name}
            </button>
          </li>
        ))}
      </ul>

      {/* Inventory — with Drop buttons */}
      <h2>Inventory:</h2>
      {inventory.length > 0 ? (
        <ul>
          {inventory.map(e => (
            <li key={e.id}>
              {e.name}
              <button onClick={() => actions.drop(e.id)} style={{ marginLeft: '0.5rem' }}>
                Drop
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Empty.</p>
      )}

      {/* Debug: scope */}
      <h2>Scope (what you can see):</h2>
      <ul>
        {scope.map(id => {
          const entity = getEntity(state, id)
          return entity ? <li key={id}>{entity.kind}: {entity.name}</li> : null
        })}
      </ul>

      {/* Debug: full state */}
      <pre style={{ background: '#1a1a1a', color: '#0f0', padding: '1rem', fontSize: '0.8rem', overflow: 'auto', marginTop: '2rem' }}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  )
}

export default App
