// This file defines the starting world — the data that loads when the app starts.
// Everything is hand-written. Later zoos might generate worlds or load from JSON files.
//
// KEY CONCEPT: containment is separate from entities.
// The desk's data says WHERE it is (locationId: 'lab'), but what's INSIDE the desk
// is in the containment map: containment.desk = ['keycard'].
// This two-part structure lets you answer "where is X?" (check locationId) and
// "what's inside X?" (check containment[id]) with direct lookups instead of scanning.

import type { WorldState } from '../types/entities'

export const world: WorldState = {
  entities: {
    rooms: {
      lab: {
        id: 'lab',
        kind: 'room',
        name: 'Laboratory',
        description:
          'A cluttered lab with flickering fluorescent lights. A heavy desk sits against the wall. A metal closet stands in the corner.',
        exits: { north: 'hallway' },
      },
      hallway: {
        id: 'hallway',
        kind: 'room',
        name: 'Hallway',
        description:
          'A long, dim hallway. A locked door blocks the way forward.',
        exits: { south: 'lab' },
      },
    },
    things: {
      keycard: {
        id: 'keycard',
        kind: 'thing',
        name: 'Keycard',
        description: 'A small plastic keycard with a blinking red light.',
        locationId: 'desk', // it's ON the desk (not directly in the lab)
        isPortable: true, // you can pick it up
        isFixed: false,
      },
      glizzy: {
        id: 'glizzy',
        kind: 'thing',
        name: 'Glizzy',
        description: 'A long juicy hot dog.',
        locationId: 'lab', // it's directly in the lab (on the floor)
        isPortable: true, // you can pick it up
        isFixed: false,
      },
    },
    containers: {
      closet: {
        id: 'closet',
        kind: 'container',
        name: 'Metal Closet',
        description: 'A tall metal closet with a heavy door.',
        locationId: 'lab', // it's IN the lab
        isPortable: false,
        isFixed: true, // you can't pick up a closet
        isOpen: false, // starts closed
        isLocked: false, // not locked, just closed
        isOpaque: true, // can't see inside when closed
        isEnterable: true, // an agent could go inside
      },
      door: {
        id: 'door',
        kind: 'container',
        name: 'Locked Door',
        description: 'A reinforced door with a keycard reader. It is locked.',
        locationId: 'hallway',
        isPortable: false,
        isFixed: true,
        isOpen: false,
        isLocked: true, // starts locked — needs keycard to open
        isOpaque: false, // you can see through it (glass? gap?)
        isEnterable: false, // can't walk through it while locked
      },
    },
    supporters: {
      desk: {
        id: 'desk',
        kind: 'supporter',
        name: 'Heavy Desk',
        description: 'A scarred wooden desk covered in old coffee stains.',
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
        locationId: 'lab', // player starts in the lab
        isHidden: false,
      },
    },
  },
  containment: {
    lab: ['desk', 'closet', 'glizzy'], // the lab contains the desk, closet, and glizzy
    desk: ['keycard'], // the desk has the keycard on it
    hallway: ['door'], // the hallway has the door
  },
  meta: {
    turn: 0,
    log: [],
  },
};
