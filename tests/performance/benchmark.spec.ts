import { describe, it, expect, vi } from 'vitest';
import { 
  advanceTurn,
  simulateTurns,
  getCurrentTurn,
  getTurnSummary
} from '../../src/lib/services/turnService';
import { get } from 'svelte/store';
import { agentStore, worldStore } from '../../src/lib/stores';

// Mock dependencies for performance testing
vi.mock('../../src/lib/services/agentService');
vi.mock('../../src/lib/stores/agentStore');
vi.mock('../../src/lib/stores/worldStore');
vi.mock('../../src/lib/stores/messageStore');
vi.mock('../../src/lib/stores/eventStore');

const mockAgentState = {
  marines: [
    { id: 'hudson', personality: 'aggressive' as const, compliance: 0.8, position: 'Shuttle', health: 10, stress: 2, inventory: [] },
    { id: 'vasquez', personality: 'cautious' as const, compliance: 0.9, position: 'Shuttle', health: 10, stress: 1, inventory: [] }
  ],
  alien: { position: 'Storage', hidden: true },
  director: { adjustments: [] }
};

describe('performance benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset turn counter
    vi.doMock('../../src/lib/services/turnService', () => {
      const actual = vi.importActual('../../src/lib/services/turnService');
      return {
        ...actual,
        resetTurnCounter: vi.fn()
      };
    });
  });

  it('should advance single turn within 500ms', async () => {
    const startTime = performance.now();
    
    await advanceTurn('Performance test');
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(500);
    expect(getCurrentTurn()).toBe(1);
  }, 1000);

  it('should simulate 10 turns within 5 seconds', async () => {
    const startTime = performance.now();
    
    await simulateTurns(10);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(5000);
    expect(getCurrentTurn()).toBe(10);
  }, 6000);

  it('should handle 50 turns without memory issues', async () => {
    const startTime = performance.now();
    
    await simulateTurns(50);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(30000); // 30 second limit for 50 turns
    expect(getCurrentTurn()).toBe(50);
  }, 35000);

  it('should maintain consistent performance across multiple runs', async () => {
    const runs = 5;
    const turnCounts = [];
    
    for (let run = 0; run < runs; run++) {
      const startTime = performance.now();
      
      await simulateTurns(5);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(3000); // 3 seconds for 5 turns
      turnCounts.push(getCurrentTurn());
      
      // Reset for next run
      vi.doMock('../../src/lib/services/turnService', () => {
        const actual = vi.importActual('../../src/lib/services/turnService');
        return {
          ...actual,
          resetTurnCounter: vi.fn()
        };
      });
      resetTurnCounter();
    }
    
    // All runs should end at turn 5
    expect(turnCounts).toEqual([5, 5, 5, 5, 5]);
  }, 20000);

  it('should generate turn summaries efficiently', () => {
    const startTime = performance.now();
    
    const summary = getTurnSummary();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(10); // Summary should be very fast
    expect(summary).toContain('Turn 0: 0 events processed');
  });

  it('should calculate marine initiative quickly', () => {
    const marine: Marine = {
      id: 'test',
      personality: 'aggressive' as const,
      compliance: 0.8,
      position: 'Shuttle',
      health: 8,
      stress: 3,
      inventory: []
    };

    const startTime = performance.now();
    
    const initiative = calculateMarineInitiative(marine);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(1); // Simple calculation
    expect(initiative).toBe(6); // 2 (aggressive) - 0 (stress 3<5) + 4 (health 8/2)
  });

  it('should handle director adjustment checks efficiently', () => {
    const startTime = performance.now();
    
    const canAdjust = canDirectorAdjust();
    const used = useDirectorAdjustment();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(1);
    expect(canAdjust).toBe(true);
    expect(used).toBe(true);
  });
});