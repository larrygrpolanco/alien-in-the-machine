import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { World, Agent, Item, Event, Message } from '../../src/lib/models/index';
import { worldStore } from '../../src/lib/stores/worldStore';
import { eventStore } from '../../src/lib/stores/eventStore';
import { messageStore } from '../../src/lib/stores/messageStore';
import { advanceTurn } from '../../src/lib/services/turnManager'; // Will fail
import { checkWinConditions } from '../../src/lib/services/gameState'; // Will fail
import { checkLoseConditions } from '../../src/lib/services/gameState'; // Will fail
import { generateEmergentEvent } from '../../src/lib/services/emergenceService'; // Will fail

// Mock stores and services
vi.mock('../../src/lib/stores/worldStore');
vi.mock('../../src/lib/stores/eventStore');
vi.mock('../../src/lib/stores/messageStore');
vi.mock('../../src/lib/services/turnManager');
vi.mock('../../src/lib/services/gameState');
vi.mock('../../src/lib/services/emergenceService');

const mockAdvanceTurn = vi.mocked(advanceTurn);
const mockCheckWinConditions = vi.mocked(checkWinConditions);
const mockCheckLoseConditions = vi.mocked(checkLoseConditions);
const mockGenerateEmergentEvent = vi.mocked(generateEmergentEvent);

describe('Win/Lose Conditions Integration', () => {
  let mockWorld: World;
  let mockMarines: Agent[];
  let mockVial: Item;
  let mockEvents: Event[];
  let mockMessages: Message[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock initial world state
    mockWorld = {
      zones: {
        shuttle: { 
          id: 'shuttle', 
          name: 'Shuttle', 
          adjacent: ['shuttleBay'], 
          items: [],
          state: 'unlocked'
        } as any,
        medbay: { 
          id: 'medbay', 
          name: 'Medbay', 
          adjacent: ['commandRoom'], 
          items: [],
          state: 'unlocked'
        } as any,
        storage: { 
          id: 'storage', 
          name: 'Storage', 
          adjacent: ['corridor'], 
          items: [],
          state: 'unlocked'
        } as any,
      },
      agents: [],
      director: { hazardLevel: 1 },
      alien: { position: 'corridor', health: 80, state: 'active' },
      turn: 1,
      events: [],
      gameState: 'active'
    } as World;

    mockMarines = [
      { 
        id: 'hudson', 
        name: 'Hudson', 
        type: 'aggressive', 
        position: 'shuttle', 
        health: 10, 
        stress: 3, 
        inventory: [],
        alive: true
      } as Agent,
      { 
        id: 'vasquez', 
        name: 'Vasquez', 
        type: 'cautious', 
        position: 'shuttle', 
        health: 8, 
        stress: 5, 
        inventory: [],
        alive: true
      } as Agent,
      { 
        id: 'hicks', 
        name: 'Hicks', 
        type: 'balanced', 
        position: 'medbay', 
        health: 6, 
        stress: 7, 
        inventory: [],
        alive: true
      } as Agent
    ];

    mockVial = {
      id: 'vial',
      name: 'Vial',
      state: 'full',
      zone: 'medbay'
    } as Item;

    mockEvents = [];
    mockMessages = [];

    // Mock store gets
    (worldStore as any).get = vi.fn(() => mockWorld);
    (eventStore as any).get = vi.fn(() => mockEvents);
    (messageStore as any).get = vi.fn(() => mockMessages);
  });

  it('win condition: vial returned to shuttle with >=2 survivors after 15-25 turns', async () => {
    // Setup win state
    mockWorld.turn = 18; // Within 15-25 range
    mockWorld.agents = [...mockMarines]; // 3 survivors
    mockWorld.zones.shuttle.items = [mockVial]; // Vial returned
    mockVial.zone = 'shuttle';
    
    mockCheckWinConditions.mockResolvedValue({ won: true, reason: 'vial_returned_survivors' });

    // Simulate turn advance that triggers win check - will fail
    await advanceTurn(mockWorld);

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(world.gameState).toBe('won');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'gameEnd',
      outcome: 'win',
      reason: 'vial_returned_survivors',
      turn: 18,
      survivors: 3
    }));
    
    // Victory message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Mission Success') || expect(messages[0].content).toContain('Vial secured');
    expect(messages[0].type).toBe('gameEnd');
  });

  it('lose condition: all marines dead before vial retrieval', async () => {
    // Setup lose state - all dead
    mockWorld.agents = mockMarines.map(m => ({ ...m, alive: false, health: 0 }));
    mockWorld.zones.shuttle.items = []; // No vial
    mockWorld.turn = 12;
    
    mockCheckLoseConditions.mockResolvedValue({ lost: true, reason: 'all_dead' });

    await advanceTurn(mockWorld);

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(world.gameState).toBe('lost');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'gameEnd',
      outcome: 'lose',
      reason: 'all_dead',
      turn: 12,
      survivors: 0
    }));
    
    // Defeat message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Mission Failure') || expect(messages[0].content).toContain('All personnel lost');
  });

  it('lose condition: 30 turns reached without win', async () => {
    // Setup timeout lose
    mockWorld.turn = 30;
    mockWorld.agents = [...mockMarines]; // Still alive but timed out
    mockWorld.zones.shuttle.items = []; // No vial
    mockWorld.gameState = 'active';
    
    mockCheckLoseConditions.mockResolvedValue({ lost: true, reason: 'timeout' });

    await advanceTurn(mockWorld);

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(world.gameState).toBe('lost');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'gameEnd',
      outcome: 'lose',
      reason: 'timeout',
      turn: 30,
      survivors: 3
    }));
    
    const messages = get(messageStore);
    expect(messages[0].content).toContain('Time expired') || expect(messages[0].content).toContain('Evacuation timeout');
  });

  it('partial success: vial lost but intel gained through events', async () => {
    // Setup partial scenario - vial lost, but events show intel
    mockWorld.turn = 22;
    mockWorld.agents = mockMarines.slice(0, 2); // 2 survivors
    mockWorld.zones.shuttle.items = []; // No vial
    mockVial.zone = 'lost'; // Somewhere else
    
    // Mock intel events (alien position discovered, etc.)
    mockEvents.push(
      { type: 'discovery', content: 'Alien nest located in storage', intelValue: 3 } as Event,
      { type: 'discovery', content: 'Hazard level increased', intelValue: 2 } as Event
    );
    (eventStore as any).get = vi.fn(() => mockEvents);
    
    mockCheckWinConditions.mockResolvedValue({ won: false, partial: true, intel: 5 });

    await advanceTurn(mockWorld);

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(world.gameState).toBe('partial');
    expect(events).toHaveLength(3); // 2 intel + 1 game end
    expect(events[2]).toEqual(expect.objectContaining({
      type: 'gameEnd',
      outcome: 'partial',
      intelGained: 5,
      reason: 'vial_lost_intel_gained'
    }));
    
    const messages = get(messageStore);
    expect(messages[0].content).toContain('Partial Success') || expect(messages[0].content).toContain('Intel recovered');
  });

  it('emergence: search action triggers alien ambush branch', async () => {
    // Setup emergence scenario
    mockWorld.turn = 8;
    mockMarines[0].position = 'storage'; // Hudson searching storage
    
    const ambushEvent = {
      type: 'emergence',
      trigger: 'search',
      branch: 'alien_ambush',
      description: 'Search triggered alien ambush in storage',
      consequences: { damage: 5, stressIncrease: 3 },
      probability: 0.3
    } as Event;
    
    mockGenerateEmergentEvent.mockResolvedValue(ambushEvent);

    // Simulate search that triggers emergence - will fail
    await generateEmergentEvent(mockMarines[0], { type: 'search', zone: 'storage' });

    const world = get(worldStore);
    const events = get(eventStore);
    
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'emergence',
      branch: 'alien_ambush',
      trigger: 'search'
    }));
    
    // Consequences applied
    expect(world.agents.find((a: any) => a.id === 'hudson')?.health).toBe(5); // 10 - 5 damage
    expect(world.agents.find((a: any) => a.id === 'hudson')?.stress).toBe(6); // 3 + 3 stress
    
    // Alien position revealed
    expect(world.alien.state).toBe('visible');
    expect(world.alien.position).toBe('storage');
    
    // Message to commander
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('AMBUSH') || expect(messages[0].content).toContain('Alien contact');
  });

  it('emergence: >=3 unique branches occur during gameplay', async () => {
    // Setup multiple emergence branches
    mockWorld.turn = 15;
    
    const branches = [
      { type: 'emergence', branch: 'alien_ambush', trigger: 'search', turn: 5 },
      { type: 'emergence', branch: 'director_escalation', trigger: 'low_hazard', turn: 10 },
      { type: 'emergence', branch: 'marine_panic', trigger: 'high_stress', turn: 14 }
    ];
    
    mockEvents.push(...branches);
    (eventStore as any).get = vi.fn(() => mockEvents);
    
    // Simulate turn that analyzes branches
    await advanceTurn(mockWorld);

    const world = get(worldStore);
    const events = get(eventStore);
    
    // Verify 3+ unique branches
    const uniqueBranches = events.filter((e: any) => e.type === 'emergence').map((e: any) => e.branch);
    expect(uniqueBranches).toHaveLength(3);
    expect(new Set(uniqueBranches).size).toBe(3); // All unique
    
    expect(world.gameState).toBe('active'); // Still playing
    expect(world.turn).toBe(16);
    
    // Emergence tracked in world state
    expect(world).toHaveProperty('emergenceBranches');
    expect(world.emergenceBranches).toEqual(expect.arrayContaining(['alien_ambush', 'director_escalation', 'marine_panic']));
  });

  it('panic events: >=2 agents reach stress >7 triggering freeze', async () => {
    // Setup high stress scenario
    mockWorld.turn = 20;
    mockMarines[0].stress = 8; // Hudson panicked
    mockMarines[1].stress = 9; // Vasquez panicked
    mockMarines[2].stress = 6; // Hicks ok
    
    const panicEvents = [
      {
        type: 'panic',
        agentId: 'hudson',
        description: 'Hudson overwhelmed, freezing turn',
        stress: 8,
        action: 'skip'
      } as Event,
      {
        type: 'panic',
        agentId: 'vasquez', 
        description: 'Vasquez overwhelmed, freezing turn',
        stress: 9,
        action: 'skip'
      } as Event
    ];
    
    mockEvents.push(...panicEvents);
    (eventStore as any).get = vi.fn(() => mockEvents);

    await advanceTurn(mockWorld);

    const world = get(worldStore);
    const events = get(eventStore);
    
    // Verify panic events
    const panicCount = events.filter((e: any) => e.type === 'panic').length;
    expect(panicCount).toBeGreaterThanOrEqual(2);
    
    // Panicked agents skip actions
    expect(world.agents.find((a: any) => a.id === 'hudson')?.lastAction).toBe('skip');
    expect(world.agents.find((a: any) => a.id === 'vasquez')?.lastAction).toBe('skip');
    expect(world.agents.find((a: any) => a.id === 'hicks')?.lastAction).not.toBe('skip');
    
    // Messages sent
    const messages = get(messageStore);
    expect(messages.length).toBe(2); // One per panic
    expect(messages[0].content).toContain('overwhelmed') || expect(messages[0].content).toContain('freezing');
    expect(messages[1].sender).toBe('Vasquez');
  });

  it('full turn loop: commander message → agent phases → reports → condition check', async () => {
    // Setup complete turn cycle
    mockWorld.turn = 10;
    mockWorld.agents = [...mockMarines];
    mockWorld.gameState = 'active';
    
    // Mock commander message
    const commanderMsg = { content: 'Team, secure vial', type: 'commander', turn: 10 } as Message;
    mockMessages.push(commanderMsg);
    
    // Mock agent actions
    mockAdvanceTurn.mockResolvedValue({
      agentsProcessed: 3,
      eventsGenerated: 5,
      turnAdvanced: true
    });
    
    // Mock reports
    const reports = [
      { sender: 'Hudson', content: 'Moving to medbay', type: 'report' },
      { sender: 'Vasquez', content: 'Covering Hudson', type: 'report' },
      { sender: 'Hicks', content: 'Vial secured', type: 'report' }
    ];
    mockMessages.push(...reports);

    // Simulate full turn - will fail
    await advanceTurn(mockWorld);

    const world = get(worldStore);
    const events = get(eventStore);
    const messages = get(messageStore);
    
    // Turn advanced
    expect(world.turn).toBe(11);
    
    // All agents processed
    expect(events).toHaveLength(5); // Actions + reports
    expect(world.agents.length).toBe(3);
    expect(world.agents.every((a: any) => a.lastAction !== undefined)).toBe(true);
    
    // Reports in stream
    expect(messages.length).toBe(4); // Commander + 3 reports
    expect(messages.slice(1).map((m: any) => m.type)).toEqual(['report', 'report', 'report']);
    
    // No win/lose yet
    expect(world.gameState).toBe('active');
    
    // Vial progress (Hicks has it)
    expect(mockMarines[2].inventory).toContainEqual(expect.objectContaining({ id: 'vial' }));
  });

  it('game continues after near-miss conditions but ends on exact triggers', async () => {
    // Setup near-miss scenarios
    mockWorld.turn = 29; // One turn from timeout
    mockWorld.agents = mockMarines.slice(0, 1); // 1 survivor (near all dead)
    mockWorld.zones.shuttle.items = []; // No vial yet
    
    // Mock no win conditions yet
    mockCheckWinConditions.mockResolvedValue({ won: false });
    mockCheckLoseConditions.mockResolvedValue({ lost: false }); // Not quite timeout

    await advanceTurn(mockWorld);

    const world = get(worldStore);
    
    // Game continues
    expect(world.gameState).toBe('active');
    expect(world.turn).toBe(30);
    
    // Now trigger timeout lose
    mockCheckLoseConditions.mockResolvedValueOnce({ lost: true, reason: 'timeout' });
    await advanceTurn(world);

    expect(world.gameState).toBe('lost');
    expect(get(eventStore)()).toContainEqual(expect.objectContaining({
      type: 'gameEnd',
      outcome: 'lose',
      reason: 'timeout'
    }));
    
    // Messages show progression
    const messages = get(messageStore)();
    expect(messages.some((m: any) => m.content.includes('29'))).toBe(true);
    expect(messages.some((m: any) => m.content.includes('timeout'))).toBe(true);
  });
});