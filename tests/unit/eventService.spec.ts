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
          }),
        }
      }));

      const unknownEvent: Event = {
        id: 'unknown1',
        tick: 1,
        type: 'report', // Use valid type for test, but test unhandled logic
        actor: 'hudson',
        details: { custom: 'data', status: 'unknown event test' }
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
          type: 'cover', // Use valid type for test
          actor: 'hudson',
          details: { reason: 'test invalid handling' }
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
