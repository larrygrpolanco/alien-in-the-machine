import { useMemo } from 'react'
import type { WorldState } from '../types/entities'

const ROOM_W = 160
const ROOM_H = 80
const GAP = 60

const DIR_OFFSETS: Record<string, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
}

interface RoomPos {
  id: string
  name: string
  x: number
  y: number
}

interface BorderLine {
  id: string
  type: 'open' | 'wall' | 'door'
  doorName?: string
  direction: string
  x1: number
  y1: number
  x2: number
  y2: number
  mx: number
  my: number
}

function computeLayout(state: WorldState): { rooms: RoomPos[]; borders: BorderLine[] } {
  const rooms: RoomPos[] = []
  const positions = new Map<string, [number, number]>()

  // Place the first room at origin
  const roomIds = Object.keys(state.entities.rooms)
  if (roomIds.length === 0) return { rooms: [], borders: [] }

  positions.set(roomIds[0], [0, 0])

  // BFS to place remaining rooms
  const queue = [roomIds[0]]
  const visited = new Set<string>([roomIds[0]])

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const [cx, cy] = positions.get(currentId)!

    for (const border of state.borders) {
      if (!border.between.includes(currentId)) continue

      const otherId = border.between[0] === currentId ? border.between[1] : border.between[0]
      if (visited.has(otherId)) continue

      const dir = border.direction[currentId]
      const offset = DIR_OFFSETS[dir] ?? [1, 0]
      positions.set(otherId, [cx + offset[0] * (ROOM_W + GAP), cy + offset[1] * (ROOM_H + GAP)])
      visited.add(otherId)
      queue.push(otherId)
    }
  }

  // Normalize to positive coordinates
  let minX = Infinity, minY = Infinity
  for (const [, [x, y]] of positions) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
  }

  for (const [id, [x, y]] of positions) {
    const room = state.entities.rooms[id]
    rooms.push({
      id,
      name: room.name,
      x: x - minX + 20,
      y: y - minY + 20,
    })
  }

  const roomMap = new Map(rooms.map(r => [r.id, r]))
  const borders: BorderLine[] = []

  for (const border of state.borders) {
    const r1 = roomMap.get(border.between[0])
    const r2 = roomMap.get(border.between[1])
    if (!r1 || !r2) continue

    const x1 = r1.x + ROOM_W / 2
    const y1 = r1.y + ROOM_H / 2
    const x2 = r2.x + ROOM_W / 2
    const y2 = r2.y + ROOM_H / 2

    const doorName = border.doorId ? state.entities.doors[border.doorId]?.name : undefined
    const dir = border.direction[border.between[0]]

    borders.push({
      id: border.id,
      type: border.type,
      doorName,
      direction: dir,
      x1, y1, x2, y2,
      mx: (x1 + x2) / 2,
      my: (y1 + y2) / 2,
    })
  }

  return { rooms, borders }
}

export function WorldMap({ state }: { state: WorldState }) {
  const { rooms, borders } = useMemo(() => computeLayout(state), [state])

  const agent = Object.values(state.entities.agents)[0]
  const agentRoomId = agent?.isHidden
    ? Object.entries(state.containment).find(([, children]) => children.includes(agent.id))?.[0]
    : agent?.locationId

  // Calculate SVG dimensions
  const maxX = rooms.length > 0 ? Math.max(...rooms.map(r => r.x + ROOM_W)) + 40 : 240
  const maxY = rooms.length > 0 ? Math.max(...rooms.map(r => r.y + ROOM_H)) + 40 : 120

  return (
    <svg width={maxX} height={maxY} style={{ display: 'block' }}>
      {/* Borders */}
      {borders.map(b => (
        <g key={b.id}>
          <line
            x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
            stroke={b.type === 'wall' ? '#666' : b.type === 'door' ? '#da0' : '#4a4'}
            strokeWidth={b.type === 'wall' ? 4 : 2}
            strokeDasharray={b.type === 'door' ? '6,4' : undefined}
          />
          <rect
            x={b.mx - 24} y={b.my - 8}
            width={48} height={16} rx={3}
            fill="#111" stroke="#333"
          />
          <text
            x={b.mx} y={b.my + 3}
            textAnchor="middle"
            fill="#aaa" fontSize={9} fontFamily="monospace"
          >
            {b.doorName ?? b.type}
          </text>
        </g>
      ))}

      {/* Rooms */}
      {rooms.map(r => {
        const isAgentHere = r.id === agentRoomId
        return (
          <g key={r.id}>
            <rect
              x={r.x} y={r.y}
              width={ROOM_W} height={ROOM_H} rx={4}
              fill={isAgentHere ? '#1a2a1a' : '#1a1a1a'}
              stroke={isAgentHere ? '#4a4' : '#333'}
              strokeWidth={isAgentHere ? 2 : 1}
            />
            <text
              x={r.x + ROOM_W / 2} y={r.y + ROOM_H / 2 - 4}
              textAnchor="middle"
              fill="#ccc" fontSize={11} fontFamily="monospace"
            >
              {r.name}
            </text>
            {isAgentHere && (
              <circle
                cx={r.x + ROOM_W / 2}
                cy={r.y + ROOM_H / 2 + 14}
                r={5}
                fill="#0f0"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
