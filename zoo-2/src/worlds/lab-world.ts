// Zoo-2 world: Laboratory → (locked door) → Maintenance Corridor → (open passage) → Storage Bay
//
// Border types in this world:
//   lab ↔ corridor  : 'door' (Security Door, starts locked — keycard required)
//   corridor ↔ storage: 'open' (unobstructed passage, cross-zone sight always on)
//
// Key scenario to test manually:
//   1. Start in Lab — can see desk, keycard, biosample, metal closet
//      North door is locked/closed: corridor NOT visible
//   2. Take keycard → unlock north door → open north door
//      Corridor becomes perceivable through open door
//   3. Move to Corridor — can now see Lab (through open door) AND Storage (open passage)
//   4. Move to Storage → put biosample in specimen_box
//   5. Return to Lab → hide in metal_closet → scope limited to closet interior

import type { WorldState } from '../types/entities'

export const world: WorldState = {
  entities: {
    rooms: {
      lab: {
        id: 'lab',
        kind: 'room',
        name: 'Laboratory',
        description:
          'A cramped research lab with flickering fluorescent lights. A heavy desk dominates one wall. A metal closet stands in the corner.',
      },
      corridor: {
        id: 'corridor',
        kind: 'room',
        name: 'Maintenance Corridor',
        description:
          'A narrow service corridor. Pipes run along the ceiling. Emergency lighting casts everything in dull orange.',
      },
      storage: {
        id: 'storage',
        kind: 'room',
        name: 'Storage Bay',
        description:
          'A wide bay lined with shelving units. Most are empty. A specimen box sits on the floor near the entrance.',
      },
    },

    things: {
      keycard: {
        id: 'keycard',
        kind: 'thing',
        name: 'Keycard',
        description: 'A laminated security card. The magnetic strip is still intact.',
        locationId: 'desk',
        isPortable: true,
        isFixed: false,
      },
      biosample: {
        id: 'biosample',
        kind: 'thing',
        name: 'Biosample Vial',
        description: 'A sealed glass vial containing a murky amber fluid.',
        locationId: 'desk',
        isPortable: true,
        isFixed: false,
      },
    },

    containers: {
      metal_closet: {
        id: 'metal_closet',
        kind: 'container',
        name: 'Metal Closet',
        description: 'A tall metal closet with a heavy door. Big enough to hide inside.',
        locationId: 'lab',
        isPortable: false,
        isFixed: true,
        isOpen: false,
        isLocked: false,
        isOpaque: true,
        isEnterable: true,
      },
      specimen_box: {
        id: 'specimen_box',
        kind: 'container',
        name: 'Specimen Box',
        description: 'A foam-lined transport box for biological samples.',
        locationId: 'storage',
        isPortable: true,
        isFixed: false,
        isOpen: true,
        isLocked: false,
        isOpaque: false,
        isEnterable: false,
      },
    },

    supporters: {
      desk: {
        id: 'desk',
        kind: 'supporter',
        name: 'Heavy Desk',
        description: 'A steel-frame desk bolted to the floor.',
        locationId: 'lab',
        isPortable: false,
        isFixed: true,
        capacity: 5,
      },
    },

    agents: {
      player: {
        id: 'player',
        kind: 'agent',
        name: 'You',
        description: 'That is you.',
        locationId: 'lab',
        isHidden: false,
      },
    },

    doors: {
      north_door: {
        id: 'north_door',
        kind: 'door',
        name: 'Security Door',
        description: 'A reinforced steel door with an electronic keycard reader.',
        isOpen: false,
        isLocked: true,
        keyItemId: 'keycard',
      },
    },
  },

  // Borders replace room.exits from zoo-1.
  // Each border is the authoritative source for connectivity between two rooms.
  borders: [
    {
      id: 'border_lab_corridor',
      between: ['lab', 'corridor'],
      type: 'door',
      doorId: 'north_door',
      direction: { lab: 'north', corridor: 'south' },
    },
    {
      id: 'border_corridor_storage',
      between: ['corridor', 'storage'],
      type: 'open',
      direction: { corridor: 'east', storage: 'west' },
    },
  ],

  // Containment: who holds what.
  // Doors are NOT in containment — they live on borders, not inside rooms.
  containment: {
    lab: ['desk', 'metal_closet'],
    desk: ['keycard', 'biosample'],
    corridor: [],
    storage: ['specimen_box'],
    specimen_box: [],
  },

  meta: {
    turn: 0,
    log: [],
  },
}
