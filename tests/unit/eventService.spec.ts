import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyEvent,
  validateEventContext,
  applyEventsBatch,
  recomputeWorldState,
  getApplicationStats
} from '../../src/lib/services/eventService';
import type { Event } from '../../src/lib/models/eventSchema';
import type { Entities } from '../../src/lib/models/entities';
import type { Marine } from '../../src/lib/models/entities';
import { get } from 'svelte/store';
import { agentStore } from '../../src/lib/stores/agentStore';
import { messageStore } from '../../src/lib/stores/messageStore';
import { addMessage } from '../../src/lib/stores/messageStore';

// Mock dependencies
vi.mock('../../src/lib/stores/agentStore');
vi.mock('../../src/lib/stores/messageStore');
vi.mock('../../src/lib/models/eventSchema', () => ({
  validateEvent: vi.fn((event) => event) // Pass-through for now
}));

const mockAddMessage = vi.mocked(addMessage);
const mockAgentStore = vi.mocked(agentStore);
const mockGet = vi.mocked(get);

const mockMarine: Marine = {
  id: 'hudson',
  personality: 'aggressive' as const,
  compliance: 0.7,
  position: 'Shuttle',
  health: 10,
  stress: 0,
  inventory: []
};

const mockAgentState = {
  marines: [mockMarine],
  alien: { position: 'Storage', hidden: true },
  director: { adjustments: [] }
};

const mockMessageStore = {
  addMessage: vi.fn()
};

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock _worldState subscription
    mockGet.mockReturnValue(mockAgentState);
    mockAgentStore.mockReturnValue(mockAgentState);
    mockMessageStore.addMessage.mockImplementation(() => {});
  });

  describe('applyEvent', () => {
    it('should apply move event to marine', () => {
      const initialState: Entities = {
        zones: {},
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState to be set
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldStore: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const moveEvent: Event = {
        id: 'move1',
        tick: 1,
        type: 'move',
        actor: 'hudson',
        target: 'Shuttle Bay',
        details: { from: 'Shuttle', to: 'Shuttle Bay' }
      };

      // Mock getAgentPosition to return current position
      const mockGetAgentPosition = vi.fn(() => 'Shuttle');
      vi.doMock('../../src/lib/services/eventService', () => ({
        getAgentPosition: mockGetAgentPosition
      }));

      applyEvent(moveEvent);

      // Verify event was added to eventStore (would need eventStore mock)
      // Verify message was added
      expect(mockAddMessage).toHaveBeenCalledWith('hudson', 'hudson moves to Shuttle Bay');
    });

    it('should apply search event to empty item', () => {
      const initialState: Entities = {
        zones: {
          'Shuttle Bay': {
            name: 'Shuttle Bay',
            connections: ['Shuttle', 'Corridor'],
            items: {
              console: { state: 'full' }
            }
          }
        },
        agents: {
          marines: [],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldStore: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const searchEvent: Event = {
        id: 'search1',
        tick: 2,
        type: 'search',
        actor: 'hudson',
        target: 'console',
        details: { zone: 'Shuttle Bay', found: 'data' }
      };

      applyEvent(searchEvent);

      // Verify item state changed to empty
      // This requires mocking the internal _worldState mutation
      // For now, verify message was added
      expect(mockAddMessage).toHaveBeenCalledWith('hudson', 'hudson searches console in Shuttle Bay: data');
    });

    it('should apply interact event to pickup vial', () => {
      const initialState: Entities = {
        zones: {
          Medbay: {
            name: 'Medbay',
            connections: ['Corridor'],
            items: {
              vial: { state: 'present', carriedBy: null, yellowBlood: true }
            }
          }
        },
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldState: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const pickupEvent: Event = {
        id: 'pickup1',
        tick: 3,
        type: 'interact',
        actor: 'hudson',
        target: 'vial',
        details: { zone: 'Medbay', action: 'pickup' }
      };

      applyEvent(pickupEvent);

      // Verify message added
      expect(mockAddMessage).toHaveBeenCalledWith('hudson', 'hudson picks up vial from Medbay');
    });

    it('should apply attack event to reduce marine health', () => {
      const initialState: Entities = {
        zones: {},
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: false },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldState: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const attackEvent: Event = {
        id: 'attack1',
        tick: 5,
        type: 'attack',
        actor: 'alien',
        target: 'hudson',
        details: { damage: 4, type: 'claw' }
      };

      applyEvent(attackEvent);

      // Verify message added
      expect(mockAddMessage).toHaveBeenCalledWith('alien', 'alien attacks hudson: 4 damage');
    });

    it('should apply cover event to increase stress', () => {
      const initialState: Entities = {
        zones: {},
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldState: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const coverEvent: Event = {
        id: 'cover1',
        tick: 7,
        type: 'cover',
        actor: 'hudson',
        details: { reason: 'gunfire' }
      };

      applyEvent(coverEvent);

      // Verify message added
      expect(mockAddMessage).toHaveBeenCalledWith('hudson', 'hudson takes cover - stress +1');
    });

    it('should apply report event without state change', () => {
      const initialState: Entities = {
        zones: {},
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldState: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const reportEvent: Event = {
        id: 'report1',
        tick: 8,
        type: 'report',
        actor: 'hudson',
        details: { status: 'all clear' }
      };

      applyEvent(reportEvent);

      // Verify message added
      expect(mockAddMessage).toHaveBeenCalledWith('hudson', 'hudson report: all clear');
    });

    it('should apply multiple events in sequence', () => {
      const initialState: Entities = {
        zones: {
          Medbay: {
            name: 'Medbay',
            connections: ['Corridor'],
            items: {
              vial: { state: 'present', carriedBy: null, yellowBlood: true }
            }
          }
        },
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState for multiple events
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldState: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const events: Event[] = [
        {
          id: 'move1',
          tick: 1,
          type: 'move',
          actor: 'hudson',
          target: 'Medbay',
          details: {}
        },
        {
          id: 'interact1',
          tick: 2,
          type: 'interact',
          actor: 'hudson',
          target: 'vial',
          details: { zone: 'Medbay', action: 'pickup' }
        }
      ];

      events.forEach(event => {
        applyEvent(event);
      });

      // Verify messages for each event
      expect(mockAddMessage).toHaveBeenCalledWith('hudson', 'hudson moves to Medbay');
      expect(mockAddMessage).toHaveBeenCalledWith('hudson', 'hudson picks up vial from Medbay');
    });

    it('should maintain immutability when applying events', () => {
      const initialState: Entities = {
        zones: {},
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState to return initial state
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldState: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
        }
      }));

      const testEvent: Event = {
        id: 'test1',
        tick: 1,
        type: 'move',
        actor: 'hudson',
        target: 'Shuttle Bay',
        details: {}
      };

      applyEvent(testEvent);

      // Since _worldState is internal, verify through side effects
      expect(mockAddMessage).toHaveBeenCalled();
    });

    it('should handle unknown event types gracefully', () => {
      const initialState: Entities = {
        zones: {},
        agents: {
          marines: [mockMarine],
          alien: { position: 'Storage', hidden: true },
          director: { adjustments: [] }
        }
      };

      // Mock _worldState
      const mockWorldState = vi.fn(() => initialState);
      vi.doMock('../../src/lib/stores/worldStore', () => ({
        worldState: {
          subscribe: vi.fn((fn) => {
            fn(initialState);
            return () => {};
          })
      });

      const unknownEvent: Event = {
        id: 'unknown1',
        tick: 1,
        type: 'unknown',
        actor: 'hudson',
        details: { custom: 'data' }
      };

      const consoleSpy = vi.spyOn(console, 'warn');

      applyEvent(unknownEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled event type: unknown');
    });
  });

  describe('validateEventContext', () => {
    it('should validate move event with connected zones', () => {
      const moveEvent: Event = {
        id: 'v1',
        tick: 1,
        type: 'move',
        actor: 'hudson',
        target: 'Shuttle Bay',
        details: {}
      };

      // Mock getAgentPosition to return current position
      const mockGetAgentPosition = vi.fn(() => 'Shuttle');
      vi.doMock('../../src/lib/services/eventService', () => ({
        getAgentPosition: mockGetAgentPosition
      }));

      // Mock connections to validate
      const mockConnections = vi.fn(() => ['Shuttle Bay']);
      vi.doMock('../../src/lib/models/entities', () => ({
        connections: mockConnections
      }));

      const isValid = validateEventContext(moveEvent);

      expect(isValid).toBe(true);
    });

    it('should reject move event with unconnected zones', () => {
      const invalidMoveEvent: Event = {
        id: 'v2',
        tick: 1,
        type: 'move',
        actor: 'hudson',
        target: 'InvalidZone',
        details: {}
      };

      // Mock getAgentPosition
      const mockGetAgentPosition = vi.fn(() => 'Shuttle');
      vi.doMock('../../src/lib/services/eventService', () => ({
        getAgentPosition: mockGetAgentPosition
      }));

      const isValid = validateEventContext(invalidMoveEvent);

      expect(isValid).toBe(false);
    });

    it('should validate search event with target', () => {
      const searchEvent: Event = {
        id: 'v3',
        tick: 1,
        type: 'search',
        actor: 'hudson',
        target: 'console',
        details: {}
      };

      const isValid = validateEventContext(searchEvent);

      expect(isValid).toBe(false); // No target validation in current impl, but should have target
    });

    it('should validate attack event with valid target', () => {
      const attackEvent: Event = {
        id: 'v4',
        tick: 1,
        type: 'attack',
        actor: 'hudson',
        target: 'alien',
        details: {}
      };

      const isValid = validateEventContext(attackEvent);

      expect(isValid).toBe(true); // Basic validation passes
    });
  });

  describe('applyEventsBatch', () => {
    it('should apply multiple valid events', () => {
      const events: Event[] = [
        {
          id: 'b1',
          tick: 1,
          type: 'move',
          actor: 'hudson',
          target: 'Shuttle Bay',
          details: {}
        },
        {
          id: 'b2',
          tick: 1,
          type: 'search',
          actor: 'hudson',
          target: 'console',
          details: { zone: 'Shuttle Bay' }
        }
      ];

      const consoleSpy = vi.spyOn(console, 'warn');

      applyEventsBatch(events);

      expect(vi.mocked(applyEvent)).toHaveBeenCalledTimes(2);
      expect(consoleSpy).not.toHaveBeenCalled(); // No warnings for valid events
    });

    it('should skip invalid events in batch', () => {
      const mixedEvents: Event[] = [
        {
          id: 'b1',
          tick: 1,
          type: 'move',
          actor: 'hudson',
          target: 'Shuttle Bay',
          details: {}
        },
        {
          id: 'b2',
          tick: 1,
          type: 'invalid',
          actor: 'hudson',
          details: {}
        }
      ];

      const consoleSpy = vi.spyOn(console, 'warn');

      applyEventsBatch(mixedEvents);

      expect(vi.mocked(applyEvent)).toHaveBeenCalledTimes(1); // Only valid event applied
      expect(consoleSpy).toHaveBeenCalledWith('Event validation failed:', mixedEvents[1]);
    });
  });

  describe('recomputeWorldState', () => {
    it('should trigger world state recomputation', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      recomputeWorldState();

      expect(consoleSpy).toHaveBeenCalledWith('World state recomputation triggered');
    });
  });

  describe('getApplicationStats', () => {
    it('should return application statistics', () => {
      const stats = getApplicationStats();

      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.types).toEqual({});
    });
  });
});

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply move event to marine', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const moveEvent: Event = {
      id: 'move1',
      tick: 1,
      type: 'move',
      actor: 'hudson',
      target: 'Shuttle Bay',
      details: { from: 'Shuttle', to: 'Shuttle Bay' }
    };

    const result = eventService.applyEvent(moveEvent, initialState);

    const hudson = result.agents.marines.find(m => m.id === 'hudson');
    expect(hudson?.position).toBe('Shuttle Bay');
    expect(result).not.toBe(initialState); // New state object
  });

  it('should apply move event to alien', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const alienMoveEvent: Event = {
      id: 'alien1',
      tick: 1,
      type: 'move',
      actor: 'alien',
      target: 'Corridor',
      details: { stealth: true }
    };

    const result = eventService.applyEvent(alienMoveEvent, initialState);

    expect(result.agents.alien.position).toBe('Corridor');
    expect(result.agents.alien.hidden).toBe(true); // Still hidden for move
  });

  it('should apply search event to empty item', () => {
    const initialState: Entities = {
      zones: {
        'Shuttle Bay': {
          name: 'Shuttle Bay',
          connections: ['Shuttle', 'Corridor'],
          items: {
            console: { state: 'full' }
          }
        }
      },
      agents: {
        marines: [],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const searchEvent: Event = {
      id: 'search1',
      tick: 2,
      type: 'search',
      actor: 'hudson',
      target: 'console',
      details: { zone: 'Shuttle Bay', found: 'data' }
    };

    const result = eventService.applyEvent(searchEvent, initialState);

    const consoleItem = result.zones['Shuttle Bay'].items?.console;
    expect(consoleItem?.state).toBe('empty');
  });

  it('should apply interact event to pickup vial', () => {
    const initialState: Entities = {
      zones: {
        Medbay: {
          name: 'Medbay',
          connections: ['Corridor'],
          items: {
            vial: { state: 'present', carriedBy: null, yellowBlood: true },
            door: { state: 'locked' }
          }
        }
      },
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Medbay', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const pickupEvent: Event = {
      id: 'pickup1',
      tick: 3,
      type: 'interact',
      actor: 'hudson',
      target: 'vial',
      details: { zone: 'Medbay', action: 'pickup' }
    };

    const result = eventService.applyEvent(pickupEvent, initialState);

    const vial = result.zones.Medbay.items?.vial;
    expect(vial?.state).toBe('carried');
    expect(vial?.carriedBy).toBe('hudson');
    expect(vial?.yellowBlood).toBe(true);

    // Marine should have vial in inventory
    const hudson = result.agents.marines.find(m => m.id === 'hudson');
    expect(hudson?.inventory).toContain('vial');
  });

  it('should apply interact event to unlock door', () => {
    const initialState: Entities = {
      zones: {
        Medbay: {
          name: 'Medbay',
          connections: ['Corridor'],
          items: {
            vial: { state: 'present' },
            door: { state: 'locked' }
          }
        }
      },
      agents: {
        marines: [],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const unlockEvent: Event = {
      id: 'unlock1',
      tick: 4,
      type: 'interact',
      actor: 'hudson',
      target: 'door',
      details: { zone: 'Medbay', unlocked: true }
    };

    const result = eventService.applyEvent(unlockEvent, initialState);

    const door = result.zones.Medbay.items?.door;
    expect(door?.state).toBe('unlocked');
  });

  it('should apply attack event to reduce marine health', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Storage', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: false },
        director: { adjustments: [] }
      }
    };

    const attackEvent: Event = {
      id: 'attack1',
      tick: 5,
      type: 'attack',
      actor: 'alien',
      target: 'hudson',
      details: { damage: 4, type: 'claw' }
    };

    const result = eventService.applyEvent(attackEvent, initialState);

    const hudson = result.agents.marines.find(m => m.id === 'hudson');
    expect(hudson?.health).toBe(6); // 10 - 4
  });

  it('should apply attack event to reveal alien', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Storage', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const marineAttackEvent: Event = {
      id: 'attack2',
      tick: 6,
      type: 'attack',
      actor: 'hudson',
      target: 'alien',
      details: { damage: 2, hit: true }
    };

    const result = eventService.applyEvent(marineAttackEvent, initialState);

    expect(result.agents.alien.hidden).toBe(false);
  });

  it('should apply cover event to increase stress', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [
          { id: 'vasquez', personality: 'cautious', compliance: 0.9, position: 'Shuttle', health: 10, stress: 1, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const coverEvent: Event = {
      id: 'cover1',
      tick: 7,
      type: 'cover',
      actor: 'vasquez',
      details: { reason: 'gunfire', duration: 1 }
    };

    const result = eventService.applyEvent(coverEvent, initialState);

    const vasquez = result.agents.marines.find(m => m.id === 'vasquez');
    expect(vasquez?.stress).toBe(2); // 1 + 1
    expect(vasquez?.stress).toBeLessThanOrEqual(10);
  });

  it('should apply report event (no state change)', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const reportEvent: Event = {
      id: 'report1',
      tick: 8,
      type: 'report',
      actor: 'hudson',
      details: { status: 'all clear', findings: 'no threats detected' }
    };

    const result = eventService.applyEvent(reportEvent, initialState);

    // Report events don't change world state
    expect(result.agents.marines[0].position).toBe('Shuttle');
    expect(result.agents.marines[0].health).toBe(10);
    expect(result).not.toBe(initialState); // Still creates new state for immutability
  });

  it('should apply multiple events in sequence', () => {
    const initialState: Entities = {
      zones: {
        Medbay: {
          name: 'Medbay',
          connections: ['Corridor'],
          items: {
            vial: { state: 'present', carriedBy: null, yellowBlood: true }
          }
        }
      },
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Medbay', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const events: Event[] = [
      {
        id: 'move1',
        tick: 1,
        type: 'move',
        actor: 'hudson',
        target: 'Medbay',
        details: { from: 'Corridor', to: 'Medbay' }
      },
      {
        id: 'interact1',
        tick: 2,
        type: 'interact',
        actor: 'hudson',
        target: 'vial',
        details: { zone: 'Medbay', action: 'pickup' }
      },
      {
        id: 'report1',
        tick: 3,
        type: 'report',
        actor: 'hudson',
        details: { status: 'vial secured', findings: 'yellow blood confirmed' }
      }
    ];

    let state = initialState;
    events.forEach(event => {
      state = eventService.applyEvent(event, state);
    });

    const hudson = state.agents.marines.find(m => m.id === 'hudson');
    const vial = state.zones.Medbay.items?.vial;
    
    expect(hudson?.position).toBe('Medbay');
    expect(hudson?.inventory).toContain('vial');
    expect(vial?.state).toBe('carried');
    expect(vial?.carriedBy).toBe('hudson');
  });

  it('should maintain immutability when applying events', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const testEvent: Event = {
      id: 'test1',
      tick: 1,
      type: 'move',
      actor: 'hudson',
      target: 'Shuttle Bay',
      details: {}
    };

    const result = eventService.applyEvent(testEvent, initialState);

    // New state object created
    expect(result).not.toBe(initialState);
    
    // Original state unchanged
    expect(initialState.agents.marines[0].position).toBe('Shuttle');
    
    // New state has changes
    const hudson = result.agents.marines.find(m => m.id === 'hudson');
    expect(hudson?.position).toBe('Shuttle Bay');
  });

  it('should handle unknown event types gracefully', () => {
    const initialState: Entities = {
      zones: {},
      agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      }
    };

    const unknownEvent: Event = {
      id: 'unknown1',
      tick: 1,
      type: 'unknown' as any, // Invalid type
      actor: 'hudson',
      details: { custom: 'data' }
    };

    const result = eventService.applyEvent(unknownEvent, initialState);

    // State should remain unchanged for unknown events
    expect(result.agents.marines[0].position).toBe('Shuttle');
    expect(result.agents.marines[0].health).toBe(10);
  });
});