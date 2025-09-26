import { z } from 'zod';

// Zone states and configurations
const ZoneState = z.enum(['full', 'empty', 'locked', 'present', 'hidden', 'carried', 'unlocked', 'accessed', 'used']);
const Personality = z.enum(['aggressive', 'cautious']);
const Compliance = z.number().min(0).max(1);

// Connections graph for movement
export const connections: Record<string, string[]> = {
  'Shuttle': ['Shuttle Bay'],
  'Shuttle Bay': ['Shuttle', 'Corridor'],
  'Corridor': ['Shuttle Bay', 'Storage', 'Command'],
  'Storage': ['Corridor'],
  'Command': ['Corridor'],
  'Medbay': ['Corridor']
};

// Item schemas
export const ItemSchema = z.object({
  state: ZoneState,
  contents: z.array(z.string()).optional(),
  yellowBlood: z.boolean().optional(),
  carriedBy: z.string().nullable().optional()
});

export interface Item {
  state: 'full' | 'empty' | 'locked' | 'present' | 'hidden' | 'carried' | 'unlocked' | 'accessed' | 'used';
  contents?: string[];
  yellowBlood?: boolean;
  carriedBy?: string | null;
}

// Zone schemas
export const ZoneSchema = z.object({
  name: z.string(),
  connections: z.array(z.string()),
  items: z.record(z.string(), ItemSchema).optional(),
  branches: z.array(z.string()).optional(),
  door: ItemSchema.optional(),
  console: ItemSchema.optional(),
  alienStart: z.boolean().optional()
});

export interface Zone {
  name: string;
  x?: number;
  y?: number;
  connections: string[];
  items?: Record<string, Item>;
  branches?: string[];
  door?: Item;
  console?: Item;
  alienStart?: boolean;
  dangerous?: boolean;
}

// Agent schemas
export const MarineSchema = z.object({
  id: z.string(),
  personality: Personality,
  compliance: Compliance,
  position: z.string(),
  health: z.number().min(0).max(10),
  stress: z.number().min(0).max(10),
  inventory: z.array(z.string())
});

export const AlienSchema = z.object({
  position: z.string(),
  hidden: z.boolean(),
  inventory: z.array(z.string()).optional()
});

export const DirectorSchema = z.object({
  adjustments: z.array(z.string()),
  inventory: z.array(z.string()).optional()
});

export type Agent = Marine | Alien | Director;

export interface Marine extends z.infer<typeof MarineSchema> {}
export interface Alien extends z.infer<typeof AlienSchema> {}
export interface Director extends z.infer<typeof DirectorSchema> {}

// Combined entity schemas
export const EntitiesSchema = z.object({
  zones: z.record(z.string(), ZoneSchema),
  agents: z.object({
    marines: z.array(MarineSchema),
    alien: AlienSchema,
    director: DirectorSchema
  })
});

export interface Entities extends z.infer<typeof EntitiesSchema> {}

// Initial entities data (for reference/testing)
export const initialEntities: Entities = {
  zones: {
    'Shuttle': {
      name: 'Shuttle',
      connections: ['Shuttle Bay'],
      items: {
        healthKits: { state: 'full' }
      }
    },
    'Shuttle Bay': {
      name: 'Shuttle Bay',
      connections: ['Shuttle', 'Corridor']
    },
    'Corridor': {
      name: 'Corridor',
      connections: ['Shuttle Bay', 'Storage', 'Command'],
      branches: ['Storage', 'Command']
    },
    'Storage': {
      name: 'Storage',
      connections: ['Corridor'],
      items: {
        cabinet: { state: 'full', contents: ['clue'] }
      },
      alienStart: true
    },
    'Command': {
      name: 'Command',
      connections: ['Corridor'],
      console: { state: 'locked' }
    },
    'Medbay': {
      name: 'Medbay',
      connections: ['Corridor'],
      items: {
        door: { state: 'locked' },
        vial: { state: 'present', carriedBy: null, yellowBlood: true }
      }
    }
  },
  agents: {
    marines: [
      {
        id: 'hudson',
        personality: 'aggressive',
        compliance: 0.7,
        position: 'Shuttle',
        health: 10,
        stress: 0,
        inventory: []
      },
      {
        id: 'vasquez',
        personality: 'cautious',
        compliance: 0.9,
        position: 'Shuttle',
        health: 10,
        stress: 0,
        inventory: []
      }
    ],
    alien: {
      position: 'Storage',
      hidden: true,
      inventory: []
    },
    director: {
      adjustments: [],
      inventory: []
    }
  }
};

export const validateAgent = (agent: Agent): Agent => {
  const anyAgent = agent as any;
  if (!anyAgent.inventory) {
    anyAgent.inventory = { items: [] };
  } else if (Array.isArray(anyAgent.inventory)) {
    // If inventory is string[], wrap it in { items }
    anyAgent.inventory = { items: anyAgent.inventory };
  } else if (!Array.isArray(anyAgent.inventory.items)) {
    anyAgent.inventory.items = [];
  }
  return agent;
};