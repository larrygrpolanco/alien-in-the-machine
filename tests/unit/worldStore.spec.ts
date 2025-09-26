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
});