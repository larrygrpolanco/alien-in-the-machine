import { describe, it, expect, vi, beforeEach } from 'vitest';
import { worldStore } from '../../src/lib/stores/worldStore';
import { eventStore } from '../../src/lib/stores/eventStore';
import type { Event } from '../../src/lib/models/eventSchema';
import type { Entities } from '../../src/lib/models/entities';
import { get } from 'svelte/store';

// Mock eventStore as writable for testing
const mockEventStore = {
  set: vi.fn(),
  update: vi.fn()
};
vi.mock('../../src/lib/stores/eventStore', () => ({
  eventStore: mockEventStore
}));

describe('worldStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventStore.set([]);
  });

  it('should derive initial world state from empty events', () => {
    mockEventStore.set([]);
    const initialState: Entities = get(worldStore);
    
    expect(initialState).toBeDefined();
    expect(initialState.zones.Shuttle.items?.healthKits?.state).toBe('full');
    expect(initialState.agents.marines[0].position).toBe('Shuttle');
    expect(initialState.agents.marines[0].health).toBe(10);
    expect(initialState.agents.alien.position).toBe('Storage');
    expect(initialState.agents.alien.hidden).toBe(true);
  });

  it('should apply move event to update marine position', () => {
    const moveEvent: Event = {
      id: 'move1',
      tick: 1,
      type: 'move',
      actor: 'hudson',
      target: 'Shuttle Bay',
      details: { from: 'Shuttle', to: 'Shuttle Bay' }
    };
    
    mockEventStore.set([moveEvent]);
    const state: Entities = get(worldStore);
    
    const hudson = state.agents.marines.find(m => m.id === 'hudson');
    expect(hudson?.position).toBe('Shuttle Bay');
    
    // Verify immutability - new state object
    mockEventStore.set([]);
    const emptyState = get(worldStore);
    expect(state).not.toBe(emptyState);
  });

  it('should apply move event to update alien position', () => {
    const alienMove: Event = {
      id: 'alien1',
      tick: 1,
      type: 'move',
      actor: 'alien',
      target: 'Corridor',
      details: { stealth: true }
    };
    
    mockEventStore.set([alienMove]);
    const state: Entities = get(worldStore);
    
    expect(state.agents.alien.position).toBe('Corridor');
    expect(state.agents.alien.hidden).toBe(true); // Still hidden
  });

  it('should apply search event to update item state', () => {
    const searchEvent: Event = {
      id: 'search1',
      tick: 2,
      type: 'search',
      actor: 'vasquez',
      target: 'cabinet',
      details: { zone: 'Storage', found: 'clue' }
    };
    
    mockEventStore.set([searchEvent]);
    const state: Entities = get(worldStore);
    
    const cabinet = state.zones.Storage.items?.cabinet;
    expect(cabinet?.state).toBe('empty');
  });

  it('should apply interact event to pickup vial', () => {
    const pickupEvent: Event = {
      id: 'pickup1',
      tick: 3,
      type: 'interact',
      actor: 'hudson',
      target: 'vial',
      details: { zone: 'Medbay', action: 'pickup' }
    };
    
    mockEventStore.set([pickupEvent]);
    const state: Entities = get(worldStore);
    
    const vial = state.zones.Medbay.items?.vial;
    expect(vial?.state).toBe('carried');
    expect(vial?.carriedBy).toBe('hudson');
    expect(vial?.yellowBlood).toBe(true);
  });

  it('should apply interact event to unlock door', () => {
    const unlockEvent: Event = {
      id: 'unlock1',
      tick: 4,
      type: 'interact',
      actor: 'vasquez',
      target: 'door',
      details: { zone: 'Medbay', unlocked: true }
    };
    
    mockEventStore.set([unlockEvent]);
    const state: Entities = get(worldStore);
    
    const door = state.zones.Medbay.items?.door;
    expect(door?.state).toBe('unlocked');
  });

  it('should apply attack event to reduce marine health', () => {
    const attackEvent: Event = {
      id: 'attack1',
      tick: 5,
      type: 'attack',
      actor: 'alien',
      target: 'hudson',
      details: { damage: 3, type: 'claw' }
    };
    
    mockEventStore.set([attackEvent]);
    const state: Entities = get(worldStore);
    
    const hudson = state.agents.marines.find(m => m.id === 'hudson');
    expect(hudson?.health).toBe(7); // 10 - 3
  });

  it('should apply attack event to reveal alien', () => {
    const attackEvent: Event = {
      id: 'attack2',
      tick: 6,
      type: 'attack',
      actor: 'hudson',
      target: 'alien',
      details: { damage: 2, hit: true }
    };
    
    mockEventStore.set([attackEvent]);
    const state: Entities = get(worldStore);
    
    expect(state.agents.alien.hidden).toBe(false);
  });

  it('should apply cover event to increase stress', () => {
    const coverEvent: Event = {
      id: 'cover1',
      tick: 7,
      type: 'cover',
      actor: 'vasquez',
      details: { reason: 'gunfire' }
    };
    
    mockEventStore.set([coverEvent]);
    const state: Entities = get(worldStore);
    
    const vasquez = state.agents.marines.find(m => m.id === 'vasquez');
    expect(vasquez?.stress).toBe(1); // 0 + 1
  });

  it('should detect vial drop in shuttle for win condition', () => {
    const dropEvent: Event = {
      id: 'drop1',
      tick: 8,
      type: 'interact',
      actor: 'hudson',
      target: 'shuttleDrop',
      details: { zone: 'Shuttle', action: 'drop' }
    };
    
    mockEventStore.set([dropEvent]);
    const state: Entities = get(worldStore);
    
    const vial = state.zones.Shuttle.items?.vial;
    expect(vial?.state).toBe('present');
    expect(vial?.carriedBy).toBeNull();
    expect(vial?.yellowBlood).toBe(true);
  });

  it('should handle multiple events in sequence', () => {
    const events: Event[] = [
      { id: 'm1', tick: 1, type: 'move', actor: 'hudson', target: 'Corridor', details: {} },
      { id: 's1', tick: 2, type: 'search', actor: 'hudson', target: 'cabinet', details: { zone: 'Storage' } },
      { id: 'i1', tick: 3, type: 'interact', actor: 'hudson', target: 'vial', details: { zone: 'Medbay' } }
    ];
    
    mockEventStore.set(events);
    const state: Entities = get(worldStore);
    
    // Verify cumulative effects
    const hudson = state.agents.marines.find(m => m.id === 'hudson');
    expect(hudson?.position).toBe('Corridor'); // Last move
    
    const cabinet = state.zones.Storage.items?.cabinet;
    expect(cabinet?.state).toBe('empty');
    
    const vial = state.zones.Medbay.items?.vial;
    expect(vial?.state).toBe('carried');
    expect(vial?.carriedBy).toBe('hudson');
  });

  it('should maintain immutability across derivations', () => {
    const events1: Event[] = [{ id: 'e1', tick: 1, type: 'move', actor: 'hudson', target: 'Medbay', details: {} }];
    mockEventStore.set(events1);
    const state1: Entities = get(worldStore);
    
    const events2: Event[] = [...events1, { id: 'e2', tick: 2, type: 'search', actor: 'hudson', target: 'door', details: { zone: 'Medbay' } }];
    mockEventStore.set(events2);
    const state2: Entities = get(worldStore);
    
    expect(state1).not.toBe(state2);
    expect(state1.agents.marines[0].position).toBe('Medbay');
    expect(state2.agents.marines[0].position).toBe('Medbay'); // Same value, different object
  });

  describe('new event handlers', () => {
    it('should handle nudge event - increase marine stress by 0.5-1', () => {
      const nudgeEvent: Event = {
        id: 'nudge1',
        tick: 9,
        type: 'nudge',
        actor: 'director',
        target: 'hudson',
        details: { intensity: 0.7 } // Between 0.5-1
      };
      
      mockEventStore.set([nudgeEvent]);
      const state: Entities = get(worldStore);
      
      const hudson = state.agents.marines.find(m => m.id === 'hudson');
      expect(hudson?.stress).toBeCloseTo(0.7, 1); // 0 + 0.7
      expect(hudson?.stress).toBeGreaterThanOrEqual(0);
      expect(hudson?.stress).toBeLessThanOrEqual(10); // Clamped
    });

    it('should handle hunt event - alien moves and becomes visible', () => {
      const huntEvent: Event = {
        id: 'hunt1',
        tick: 10,
        type: 'hunt',
        actor: 'alien',
        target: 'Corridor',
        details: { from: 'Storage', stealth: false }
      };
      
      mockEventStore.set([huntEvent]);
      const state: Entities = get(worldStore);
      
      expect(state.agents.alien.position).toBe('Corridor');
      expect(state.agents.alien.hidden).toBe(false); // Revealed during hunt
    });

    it('should handle lurk event - alien becomes hidden without position change', () => {
      // First make alien visible
      const revealEvent: Event = {
        id: 'reveal1',
        tick: 11,
        type: 'attack',
        actor: 'hudson',
        target: 'alien',
        details: { hit: true }
      };
      
      // Then lurk
      const lurkEvent: Event = {
        id: 'lurk1',
        tick: 12,
        type: 'lurk',
        actor: 'alien',
        details: { silent: true }
      };
      
      mockEventStore.set([revealEvent, lurkEvent]);
      const state: Entities = get(worldStore);
      
      expect(state.agents.alien.position).toBe('Storage'); // No position change
      expect(state.agents.alien.hidden).toBe(true); // Hidden again
    });

    it('should handle stalk event - alien follows marine to same zone', () => {
      const moveEvent: Event = {
        id: 'move2',
        tick: 13,
        type: 'move',
        actor: 'vasquez',
        target: 'Medbay',
        details: { from: 'Shuttle' }
      };
      
      const stalkEvent: Event = {
        id: 'stalk1',
        tick: 14,
        type: 'stalk',
        actor: 'alien',
        target: 'vasquez',
        details: { silent: true }
      };
      
      mockEventStore.set([moveEvent, stalkEvent]);
      const state: Entities = get(worldStore);
      
      const vasquez = state.agents.marines.find(m => m.id === 'vasquez');
      expect(vasquez?.position).toBe('Medbay');
      expect(state.agents.alien.position).toBe('Medbay'); // Follows target
      expect(state.agents.alien.hidden).toBe(true); // Still hidden
    });

    it('should handle hide event - alien becomes hidden in current position', () => {
      const hideEvent: Event = {
        id: 'hide1',
        tick: 15,
        type: 'hide',
        actor: 'alien',
        details: { zone: 'Storage' }
      };
      
      mockEventStore.set([hideEvent]);
      const state: Entities = get(worldStore);
      
      expect(state.agents.alien.position).toBe('Storage'); // No move
      expect(state.agents.alien.hidden).toBe(true);
    });

    it('should handle escalate event - director increases overall tension', () => {
      const escalateEvent: Event = {
        id: 'escalate1',
        tick: 16,
        type: 'escalate',
        actor: 'director',
        details: { tension: 2, reason: 'lights flickering' }
      };
      
      mockEventStore.set([escalateEvent]);
      const state: Entities = get(worldStore);
      
      // All marines get stress increase
      const totalStress = state.agents.marines.reduce((sum, m) => sum + (m.stress || 0), 0);
      expect(totalStress).toBeGreaterThan(0);
      expect(totalStress).toBeLessThanOrEqual(20); // 2 marines max 10 each
    });
  });

  describe('event handler edge cases', () => {
    it('should handle nudge without target - apply to all marines', () => {
      const nudgeEvent: Event = {
        id: 'nudge2',
        tick: 17,
        type: 'nudge',
        actor: 'director',
        details: { intensity: 0.5 } // No specific target
      };
      
      mockEventStore.set([nudgeEvent]);
      const state: Entities = get(worldStore);
      
      const totalStress = state.agents.marines.reduce((sum, m) => sum + (m.stress || 0), 0);
      expect(totalStress).toBeCloseTo(1.0, 1); // 0.5 to each of 2 marines
    });

    it('should clamp stress at 0-10 bounds', () => {
      // First max out stress
      const maxStressEvent: Event = {
        id: 'max1',
        tick: 18,
        type: 'nudge',
        actor: 'director',
        target: 'hudson',
        details: { intensity: 15 } // Way above max
      };
      
      mockEventStore.set([maxStressEvent]);
      let state: Entities = get(worldStore);
      let hudson = state.agents.marines.find(m => m.id === 'hudson');
      expect(hudson?.stress).toBe(10); // Clamped to max
      
      // Try negative stress (shouldn't happen but test clamping)
      const minStressEvent: Event = {
        id: 'min1',
        tick: 19,
        type: 'cover', // Should reduce stress
        actor: 'hudson',
        details: { reason: 'situation calmed' }
      };
      
      mockEventStore.set([maxStressEvent, minStressEvent]);
      state = get(worldStore);
      hudson = state.agents.marines.find(m => m.id === 'hudson');
      expect(hudson?.stress).toBeGreaterThanOrEqual(0); // Clamped to min
    });

    it('should handle hunt without target - move to random adjacent zone', () => {
      const huntEvent: Event = {
        id: 'hunt2',
        tick: 20,
        type: 'hunt',
        actor: 'alien',
        details: { stealth: false } // No specific target
      };
      
      mockEventStore.set([huntEvent]);
      const state: Entities = get(worldStore);
      
      // Should move to adjacent zone from Storage (Corridor or Medbay)
      const adjacentZones = ['Corridor', 'Medbay'];
      expect(adjacentZones.includes(state.agents.alien.position)).toBe(true);
      expect(state.agents.alien.hidden).toBe(false);
    });

    it('should maintain TypeScript type safety for new events', () => {
      const complexEvent: Event = {
        id: 'complex1',
        tick: 21,
        type: 'stalk' as const,
        actor: 'alien',
        target: 'vasquez',
        details: { 
          silent: true,
          distance: 1,
          timestamp: Date.now()
        } as any, // Complex details
        result: { success: true, stressImpact: 0.3 }
      };
      
      mockEventStore.set([complexEvent]);
      const state: Entities = get(worldStore);
      
      // Type system should handle the event without errors
      expect(state).toBeDefined();
      const vasquez = state.agents.marines.find(m => m.id === 'vasquez');
      expect(vasquez).toBeDefined();
      expect(vasquez?.stress).toBeGreaterThan(0); // Stress from being stalked
    });

    it('should handle multiple new events in sequence without conflicts', () => {
      const events: Event[] = [
        // Director escalates tension
        { id: 'e1', tick: 22, type: 'escalate', actor: 'director', details: { tension: 1 } },
        // Alien hunts (moves and reveals)
        { id: 'e2', tick: 23, type: 'hunt', actor: 'alien', target: 'Corridor', details: { stealth: false } },
        // Alien lurks (hides again)
        { id: 'e3', tick: 24, type: 'lurk', actor: 'alien', details: { silent: true } },
        // Director nudges specific marine
        { id: 'e4', tick: 25, type: 'nudge', actor: 'director', target: 'hudson', details: { intensity: 0.8 } }
      ];
      
      mockEventStore.set(events);
      const state: Entities = get(worldStore);
      
      // Verify cumulative effects
      expect(state.agents.alien.position).toBe('Corridor'); // From hunt
      expect(state.agents.alien.hidden).toBe(true); // From lurk
      const hudson = state.agents.marines.find(m => m.id === 'hudson');
      expect(hudson?.stress).toBeCloseTo(1.8, 1); // 1 from escalate + 0.8 from nudge
    });
  });
});