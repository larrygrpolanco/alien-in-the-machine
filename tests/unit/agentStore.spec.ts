import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  agentStore,
  getAgents,
  getMarineById,
  getMarinePositions,
  isMarineAlive,
  getSurvivingMarinesCount,
  getAverageMarineStress,
  isAlienVisible,
  getDirectorAdjustments,
  updateAgentStress,
  anyMarineInPanic,
  getMarinesInZone,
  type AgentsState
} from '../../src/lib/stores/agentStore';
import { get } from 'svelte/store';

// Mock worldStore dependency for controlled testing
vi.mock('../../src/lib/stores/worldStore', () => ({
  worldStore: {
    subscribe: vi.fn((fn) => {
      fn({ agents: {
        marines: [
          { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 0, inventory: [] },
          { id: 'vasquez', personality: 'cautious', compliance: 0.9, position: 'Shuttle', health: 10, stress: 0, inventory: [] }
        ],
        alien: { position: 'Storage', hidden: true },
        director: { adjustments: [] }
      } });
      return () => {};
    })
  } as any
}));

describe('agentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should derive initial agent state correctly', () => {
    const initialState: AgentsState = get(agentStore);
    
    expect(initialState.marines).toHaveLength(2);
    expect(initialState.marines[0].id).toBe('hudson');
    expect(initialState.marines[0].position).toBe('Shuttle');
    expect(initialState.marines[0].health).toBe(10);
    expect(initialState.marines[0].stress).toBe(0);
    expect(initialState.marines[0].personality).toBe('aggressive');
    expect(initialState.marines[0].compliance).toBe(0.7);
    
    expect(initialState.marines[1].id).toBe('vasquez');
    expect(initialState.marines[1].personality).toBe('cautious');
    expect(initialState.marines[1].compliance).toBe(0.9);
    
    expect(initialState.alien.position).toBe('Storage');
    expect(initialState.alien.hidden).toBe(true);
    expect(initialState.director.adjustments).toEqual([]);
  });

  it('should provide getAgents helper', () => {
    const agents = getAgents();
    
    expect(agents).toBeDefined();
    expect(agents.marines).toHaveLength(2);
    expect(agents.alien).toBeDefined();
    expect(agents.director).toBeDefined();
  });

  it('should find marine by ID with getMarineById', () => {
    const hudson = getMarineById('hudson');
    const vasquez = getMarineById('vasquez');
    const unknown = getMarineById('nonexistent');
    
    expect(hudson?.id).toBe('hudson');
    expect(vasquez?.id).toBe('vasquez');
    expect(unknown).toBeUndefined();
  });

  it('should return marine positions with getMarinePositions', () => {
    const positions = getMarinePositions();
    
    expect(positions).toEqual({
      hudson: 'Shuttle',
      vasquez: 'Shuttle'
    });
    expect(typeof positions.hudson).toBe('string');
  });

  it('should check marine alive status with isMarineAlive', () => {
    expect(isMarineAlive('hudson')).toBe(true);
    expect(isMarineAlive('vasquez')).toBe(true);
    expect(isMarineAlive('deadMarine')).toBe(false);
  });

  it('should count surviving marines with getSurvivingMarinesCount', () => {
    const count = getSurvivingMarinesCount();
    expect(count).toBe(2);
  });

  it('should calculate average marine stress with getAverageMarineStress', () => {
    const avgStress = getAverageMarineStress();
    expect(avgStress).toBe(0);
    
    // Test with mocked stress values (would require worldStore mock update)
    // For now, verify it handles empty array
    vi.doMock('../../src/lib/stores/worldStore', () => ({
      worldStore: {
        subscribe: vi.fn((fn) => {
          fn({ agents: {
            marines: [], // Empty marines
            alien: { position: 'Storage', hidden: true },
            director: { adjustments: [] }
          } });
          return () => {};
        })
      } as any
    }));
    
    const emptyAvg = getAverageMarineStress();
    expect(emptyAvg).toBe(0);
  });

  it('should check alien visibility with isAlienVisible', () => {
    expect(isAlienVisible()).toBe(false); // Initially hidden
    
    // Test revealed alien (would require worldStore update via events)
    // For unit test, verify logic works with mocked state
    vi.doMock('../../src/lib/stores/worldStore', () => ({
      worldStore: {
        subscribe: vi.fn((fn) => {
          fn({ agents: {
            marines: [{ id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 0, inventory: [] }],
            alien: { position: 'Medbay', hidden: false }, // Revealed
            director: { adjustments: [] }
          } });
          return () => {};
        })
      } as any
    }));
    
    expect(isAlienVisible()).toBe(true);
  });

  it('should return director adjustments with getDirectorAdjustments', () => {
    const adjustments = getDirectorAdjustments();
    expect(adjustments).toEqual([]);
    
    // Test with adjustments
    vi.doMock('../../src/lib/stores/worldStore', () => ({
      worldStore: {
        subscribe: vi.fn((fn) => {
          fn({ agents: {
            marines: [],
            alien: { position: 'Storage', hidden: true },
            director: { adjustments: ['increase_threat', 'add_hazard'] }
          } });
          return () => {};
        })
      } as any
    }));
    
    const updatedAdjustments = getDirectorAdjustments();
    expect(updatedAdjustments).toEqual(['increase_threat', 'add_hazard']);
  });

  it('should detect marines in panic with anyMarineInPanic', () => {
    expect(anyMarineInPanic()).toBe(false); // Initial stress = 0
    
    // Test with high stress marine
    vi.doMock('../../src/lib/stores/worldStore', () => ({
      worldStore: {
        subscribe: vi.fn((fn) => {
          fn({ agents: {
            marines: [
              { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 5, inventory: [] },
              { id: 'vasquez', personality: 'cautious', compliance: 0.9, position: 'Shuttle', health: 10, stress: 8, inventory: [] } // >7
            ],
            alien: { position: 'Storage', hidden: true },
            director: { adjustments: [] }
          } });
          return () => {};
        })
      } as any
    }));
    
    expect(anyMarineInPanic()).toBe(true);
  });

  it('should find marines in specific zone with getMarinesInZone', () => {
    const shuttleMarines = getMarinesInZone('Shuttle');
    expect(shuttleMarines).toHaveLength(2);
    expect(shuttleMarines[0].id).toBe('hudson');
    
    const emptyZone = getMarinesInZone('Storage');
    expect(emptyZone).toHaveLength(0);
    
    // Test with mixed positions
    vi.doMock('../../src/lib/stores/worldStore', () => ({
      worldStore: {
        subscribe: vi.fn((fn) => {
          fn({ agents: {
            marines: [
              { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Corridor', health: 10, stress: 0, inventory: [] },
              { id: 'vasquez', personality: 'cautious', compliance: 0.9, position: 'Shuttle', health: 10, stress: 0, inventory: [] }
            ],
            alien: { position: 'Storage', hidden: true },
            director: { adjustments: [] }
          } });
          return () => {};
        })
      } as any
    }));
    
    const corridorMarines = getMarinesInZone('Corridor');
    expect(corridorMarines).toHaveLength(1);
    expect(corridorMarines[0].id).toBe('hudson');
  });

  it('should maintain derived state immutability', () => {
    const state1 = get(agentStore);
    
    // Trigger worldStore change (in real app, via eventStore)
    vi.doMock('../../src/lib/stores/worldStore', () => ({
      worldStore: {
        subscribe: vi.fn((fn) => {
          fn({ agents: {
            marines: [
              { ...state1.marines[0], position: 'Medbay' }, // Changed position
              state1.marines[1]
            ],
            alien: state1.alien,
            director: state1.director
          } });
          return () => {};
        })
      } as any
    }));
    
    const state2 = get(agentStore);
    
    expect(state2).not.toBe(state1); // New derived object
    expect(state1.marines[0].position).toBe('Shuttle'); // Original unchanged
    expect(state2.marines[0].position).toBe('Medbay'); // Updated
  });

  it('should handle updateAgentStress correctly', () => {
    // Note: This method directly modifies state (should trigger event in full impl)
    const initialState = get(agentStore);
    const initialStress = initialState.marines[0].stress;
    
    updateAgentStress('hudson', 3);
    
    const updatedState = get(agentStore);
    const updatedHudson = updatedState.marines.find(m => m.id === 'hudson');
    
    expect(updatedHudson?.stress).toBe(initialStress + 3);
    expect(updatedHudson?.stress).toBeLessThanOrEqual(10);
  });
});