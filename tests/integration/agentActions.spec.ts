import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { World, Agent, Zone, Item, Event } from '../../src/lib/models/index';
import { eventStore } from '../../src/lib/stores/eventStore';
import { worldStore } from '../../src/lib/stores/worldStore';
import { messageStore } from '../../src/lib/stores/messageStore';
import { performMarineAction } from '../../src/lib/services/marineActions'; // Will fail
import { performAlienAction } from '../../src/lib/services/alienActions'; // Will fail
import { performDirectorAction } from '../../src/lib/services/directorActions'; // Will fail

// Mock stores and services
vi.mock('../../src/lib/stores/eventStore');
vi.mock('../../src/lib/stores/worldStore');
vi.mock('../../src/lib/stores/messageStore');
vi.mock('../../src/lib/services/marineActions');
vi.mock('../../src/lib/services/alienActions');
vi.mock('../../src/lib/services/directorActions');

const mockPerformMarineAction = vi.mocked(performMarineAction);
const mockPerformAlienAction = vi.mocked(performAlienAction);
const mockPerformDirectorAction = vi.mocked(performDirectorAction);

describe('Agent Actions Integration', () => {
  let mockWorld: World;
  let mockMarine: Agent;
  let mockAlien: Agent;
  let mockDirector: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock initial world state
    mockWorld = {
      zones: {
        shuttle: { id: 'shuttle', name: 'Shuttle', adjacent: ['shuttleBay'], items: [], state: 'unlocked' } as Zone,
        shuttleBay: { id: 'shuttleBay', name: 'Shuttle Bay', adjacent: ['shuttle', 'corridor'], items: [], state: 'unlocked' } as Zone,
        storage: { id: 'storage', name: 'Storage', adjacent: ['corridor'], items: [{ id: 'cabinet', name: 'Cabinet', state: 'full' } as Item], state: 'unlocked' } as Zone,
        medbay: { id: 'medbay', name: 'Medbay', adjacent: ['commandRoom'], items: [{ id: 'vial', name: 'Vial', state: 'full' } as Item], state: 'unlocked' } as Zone,
      },
      agents: [],
      director: { hazardLevel: 0 } as any,
      alien: { position: 'corridor', health: 100, state: 'active' } as Agent,
      turn: 1,
      events: []
    } as World;

    mockMarine = {
      id: 'hudson',
      name: 'Hudson',
      type: 'aggressive',
      position: 'shuttle',
      health: 10,
      stress: 2,
      inventory: []
    } as Agent;

    mockAlien = {
      id: 'alien',
      position: 'corridor',
      health: 100,
      stress: 0,
      inventory: []
    } as Agent;

    mockDirector = { id: 'director', hazardLevel: 0 };

    // Mock store gets
    (eventStore as any).get = vi.fn(() => []);
    (worldStore as any).get = vi.fn(() => mockWorld);
    (messageStore as any).get = vi.fn(() => []);
  });

  it('marine moves to adjacent zone and updates world state immutably', async () => {
    mockPerformMarineAction.mockResolvedValue({
      type: 'move',
      agentId: 'hudson',
      from: 'shuttle',
      to: 'shuttleBay',
      timestamp: Date.now()
    } as Event);

    // Simulate action - will fail as implementation missing
    await performMarineAction(mockMarine, { type: 'move', target: 'shuttleBay' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'move',
      agentId: 'hudson',
      to: 'shuttleBay'
    }));
    expect(world.agents.find(a => a.id === 'hudson')?.position).toBe('shuttleBay');
    // Immutable: original mockWorld unchanged
    expect(mockWorld.agents.find(a => a.id === 'hudson')?.position).toBe('shuttle');
  });

  it('marine searches item and updates item state via event log', async () => {
    const cabinetItem = mockWorld.zones.storage.items[0];
    mockMarine.position = 'storage';
    
    mockPerformMarineAction.mockResolvedValue({
      type: 'search',
      agentId: 'hudson',
      zoneId: 'storage',
      itemId: 'cabinet',
      result: 'empty',
      timestamp: Date.now()
    } as Event);

    await performMarineAction(mockMarine, { type: 'search', target: 'cabinet' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'search',
      result: 'empty'
    }));
    expect(world.zones.storage.items[0].state).toBe('empty');
    // Stress increase expected
    expect(world.agents.find(a => a.id === 'hudson')?.stress).toBe(3); // +1 from search
  });

  it('marine interacts with vial and updates inventory immutably', async () => {
    const vialItem = { ...mockWorld.zones.medbay.items[0] };
    mockMarine.position = 'medbay';
    
    mockPerformMarineAction.mockResolvedValue({
      type: 'interact',
      agentId: 'hudson',
      zoneId: 'medbay',
      itemId: 'vial',
      action: 'pick up',
      timestamp: Date.now()
    } as Event);

    await performMarineAction(mockMarine, { type: 'interact', target: 'vial', action: 'pick up' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'interact',
      action: 'pick up'
    }));
    expect(world.agents.find(a => a.id === 'hudson')?.inventory).toContainEqual(expect.objectContaining({ id: 'vial' }));
    expect(world.zones.medbay.items).not.toContainEqual(expect.objectContaining({ id: 'vial' }));
  });

  it('marine attacks reduces target health and increases own stress', async () => {
    const targetAgent = { ...mockAlien, position: 'shuttleBay' };
    mockMarine.position = 'shuttleBay';
    
    mockPerformMarineAction.mockResolvedValue({
      type: 'attack',
      agentId: 'hudson',
      targetId: 'alien',
      damage: 3,
      timestamp: Date.now()
    } as Event);

    await performMarineAction(mockMarine, { type: 'attack', target: 'alien' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'attack',
      damage: expect.any(Number)
    }));
    expect(world.agents.find(a => a.id === 'alien')?.health).toBe(97); // 100 - 3
    expect(world.agents.find(a => a.id === 'hudson')?.stress).toBe(4); // +2 from combat
  });

  it('marine takes cover and lowers detection risk', async () => {
    mockMarine.stress = 5; // High stress scenario
    
    mockPerformMarineAction.mockResolvedValue({
      type: 'takeCover',
      agentId: 'hudson',
      zoneId: 'shuttle',
      detectionModifier: -0.3,
      timestamp: Date.now()
    } as Event);

    await performMarineAction(mockMarine, { type: 'takeCover' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'takeCover',
      detectionModifier: -0.3
    }));
    // Stress reduction from cover
    expect(world.agents.find(a => a.id === 'hudson')?.stress).toBe(4); // -1 from cover
  });

  it('marine reports adds message to stream', async () => {
    mockPerformMarineAction.mockResolvedValue({
      type: 'report',
      agentId: 'hudson',
      message: 'Clear in Shuttle Bay',
      timestamp: Date.now()
    } as Event);

    await performMarineAction(mockMarine, { type: 'report', message: 'Clear in Shuttle Bay' });

    const messages = get(messageStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'report',
      message: 'Clear in Shuttle Bay'
    }));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      sender: 'Hudson',
      content: 'Clear in Shuttle Bay',
      timestamp: expect.any(Number)
    }));
  });

  it('director adjusts hazard level and locks door', async () => {
    mockDirector.hazardLevel = 1;
    
    mockPerformDirectorAction.mockResolvedValue({
      type: 'directorAction',
      action: 'lockDoor',
      targetZone: 'corridor',
      hazardLevel: 2,
      timestamp: Date.now()
    } as Event);

    await performDirectorAction(mockDirector, { action: 'lockDoor', target: 'corridor' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'directorAction',
      action: 'lockDoor'
    }));
    expect(world.director.hazardLevel).toBe(2);
    expect(world.zones.corridor.state).toBe('locked');
  });

  it('alien sneaks and hides position on map', async () => {
    mockPerformAlienAction.mockResolvedValue({
      type: 'sneak',
      agentId: 'alien',
      from: 'corridor',
      to: 'hidden',
      visibility: 'hidden',
      timestamp: Date.now()
    } as Event);

    await performAlienAction(mockAlien, { type: 'sneak' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'sneak',
      visibility: 'hidden'
    }));
    expect(world.alien.position).toBe('hidden');
    // Map should not show alien dot
    expect(world.alien.state).toBe('hidden');
  });

  it('alien attacks marine and causes damage', async () => {
    mockMarine.position = 'corridor';
    mockAlien.position = 'corridor';
    
    mockPerformAlienAction.mockResolvedValue({
      type: 'attack',
      agentId: 'alien',
      targetId: 'hudson',
      damage: 4,
      timestamp: Date.now()
    } as Event);

    await performAlienAction(mockAlien, { type: 'attack', target: 'hudson' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'attack',
      damage: 4
    }));
    expect(world.agents.find(a => a.id === 'hudson')?.health).toBe(6); // 10 - 4
    // Alien stress increase from combat
    expect(world.alien.stress).toBe(1);
  });

  it('all actions update world immutably through event log', async () => {
    const initialWorld = { ...mockWorld };
    const initialEvents = get(eventStore);
    
    // Multiple actions
    await Promise.all([
      performMarineAction(mockMarine, { type: 'move', target: 'shuttleBay' }),
      performAlienAction(mockAlien, { type: 'sneak' }),
      performDirectorAction(mockDirector, { action: 'adjustHazard', level: 1 })
    ]);

    const finalWorld = get(worldStore);
    const finalEvents = get(eventStore);
    
    // Events appended
    expect(finalEvents).toHaveLength(3);
    expect(finalEvents).not.toBe(initialEvents);
    
    // World updated but original unchanged
    expect(finalWorld).not.toBe(initialWorld);
    expect(finalWorld.turn).toBe(2); // Turn advanced
    expect(initialWorld.turn).toBe(1);
    
    // Specific changes
    expect(finalWorld.agents.find(a => a.id === 'hudson')?.position).toBe('shuttleBay');
    expect(finalWorld.alien.position).toBe('hidden');
    expect(finalWorld.director.hazardLevel).toBe(1);
  });
});