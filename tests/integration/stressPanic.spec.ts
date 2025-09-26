import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { Agent, World, Event, Message } from '../../src/lib/models/index';
import { worldStore } from '../../src/lib/stores/worldStore';
import { eventStore } from '../../src/lib/stores/eventStore';
import { messageStore } from '../../src/lib/stores/messageStore';
import { updateAgentStress } from '../../src/lib/services/agentService'; // Will fail
import { processPanicEvent } from '../../src/lib/services/stressService'; // Will fail
import { calculateActionSuccess } from '../../src/lib/services/agentService'; // Will fail
import { resetStressAtShuttle } from '../../src/lib/services/agentService'; // Will fail

// Mock stores and services
vi.mock('../../src/lib/stores/worldStore');
vi.mock('../../src/lib/stores/eventStore');
vi.mock('../../src/lib/stores/messageStore');
vi.mock('../../src/lib/services/agentService');
vi.mock('../../src/lib/services/stressService');

const mockUpdateAgentStress = vi.mocked(updateAgentStress);
const mockProcessPanicEvent = vi.mocked(processPanicEvent);
const mockCalculateActionSuccess = vi.mocked(calculateActionSuccess);
const mockResetStressAtShuttle = vi.mocked(resetStressAtShuttle);

describe('Stress and Panic Mechanics Integration', () => {
  let mockWorld: World;
  let mockHudson: Agent;
  let mockVasquez: Agent;
  let mockEvents: Event[];
  let mockMessages: Message[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWorld = {
      zones: {
        shuttle: { id: 'shuttle', name: 'Shuttle', adjacent: ['shuttleBay'], safeZone: true } as any,
        storage: { id: 'storage', name: 'Storage', adjacent: ['corridor'], safeZone: false } as any,
        medbay: { id: 'medbay', name: 'Medbay', adjacent: ['commandRoom'], safeZone: false } as any,
      },
      agents: [],
      turn: 5,
      gameState: 'active'
    } as World;

    mockHudson = {
      id: 'hudson',
      name: 'Hudson',
      type: 'aggressive',
      position: 'storage',
      health: 8,
      stress: 2,
      maxStress: 10,
      compliance: 0.7,
      lastAction: 'move',
      panicHistory: []
    } as Agent;

    mockVasquez = {
      id: 'vasquez',
      name: 'Vasquez',
      type: 'cautious',
      position: 'medbay',
      health: 9,
      stress: 1,
      maxStress: 10,
      compliance: 0.9,
      lastAction: 'search',
      panicHistory: []
    } as Agent;

    mockEvents = [];
    mockMessages = [];

    // Mock store gets
    (worldStore as any).get = vi.fn(() => mockWorld);
    (eventStore as any).get = vi.fn(() => mockEvents);
    (messageStore as any).get = vi.fn(() => mockMessages);
  });

  it('stress increases by 1 for each failure or combat event', async () => {
    // Setup initial state
    mockWorld.agents = [mockHudson];
    mockHudson.stress = 2;
    
    const failureEvent = {
      type: 'actionFailure',
      agentId: 'hudson',
      description: 'Failed to search cabinet - empty',
      stressImpact: 1,
      timestamp: Date.now()
    } as Event;

    const combatEvent = {
      type: 'combat',
      agentId: 'hudson',
      description: 'Engaged alien, minor injury',
      stressImpact: 1,
      damage: 2,
      timestamp: Date.now()
    } as Event;

    mockUpdateAgentStress.mockResolvedValueOnce({ ...mockHudson, stress: 3 }); // +1 failure
    mockUpdateAgentStress.mockResolvedValueOnce({ ...mockHudson, stress: 4, health: 6 }); // +1 combat

    // Simulate failure event - will fail as implementation missing
    await updateAgentStress(mockHudson, failureEvent);
    await updateAgentStress(mockHudson, combatEvent);

    const world = get(worldStore);
    const hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    
    expect(hudsonAgent.stress).toBe(4); // 2 + 1 + 1
    expect(hudsonAgent.health).toBe(6); // 8 - 2 from combat
    
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'stressUpdate',
      agentId: 'hudson',
      oldStress: 2,
      newStress: 3,
      cause: 'actionFailure'
    }));
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'stressUpdate',
      agentId: 'hudson',
      oldStress: 3,
      newStress: 4,
      cause: 'combat'
    }));
  });

  it('stress >5 reduces action success probability by 10%', async () => {
    mockWorld.agents = [mockHudson];
    mockHudson.stress = 6; // Above threshold
    
    const actionAttempt = {
      type: 'search',
      agentId: 'hudson',
      target: 'cabinet',
      baseSuccessRate: 0.8 // 80% base
    };

    // Stress penalty: 6 > 5 → -10% success
    const expectedSuccessRate = 0.7; // 80% - 10%
    
    mockCalculateActionSuccess.mockResolvedValue({
      success: true,
      probability: expectedSuccessRate,
      stressPenalty: -0.1,
      finalRoll: 0.65 // Below 70% threshold
    });

    const result = await calculateActionSuccess(mockHudson, actionAttempt);

    expect(result).toEqual(expect.objectContaining({
      success: true,
      probability: expectedSuccessRate,
      stressPenalty: -0.1,
      stressLevel: 'moderate',
      agentStress: 6
    }));
    
    expect(mockCalculateActionSuccess).toHaveBeenCalledWith(mockHudson, actionAttempt);
    
    // Event logged with probability details
    const events = get(eventStore);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'actionAttempt',
      agentId: 'hudson',
      action: 'search',
      baseProbability: 0.8,
      stressPenalty: -0.1,
      finalProbability: 0.7,
      success: true
    }));
  });

  it('stress >7 triggers panic event and freezes agent turn', async () => {
    mockWorld.agents = [mockHudson];
    mockHudson.stress = 8; // Panic threshold
    
    const panicEvent = {
      type: 'panic',
      agentId: 'hudson',
      description: 'Hudson overwhelmed by stress, freezing this turn',
      stressLevel: 8,
      action: 'skip',
      recoveryNeeded: true,
      timestamp: Date.now()
    } as Event;

    mockProcessPanicEvent.mockResolvedValue({
      ...mockHudson,
      stress: 8,
      lastAction: 'skip',
      panicStatus: 'active',
      panicDuration: 1 // Skip 1 turn
    });

    // Simulate stress reaching panic level - will fail
    await processPanicEvent(mockHudson);

    const world = get(worldStore);
    const hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    
    expect(hudsonAgent.stress).toBe(8);
    expect(hudsonAgent.lastAction).toBe('skip');
    expect(hudsonAgent.panicStatus).toBe('active');
    expect(hudsonAgent.panicHistory).toHaveLength(1);
    expect(hudsonAgent.panicHistory[0]).toEqual(expect.objectContaining({
      turn: 5,
      duration: 1,
      recovery: 'rest_required'
    }));
    
    const events = get(eventStore);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'panic',
      agentId: 'hudson',
      stressLevel: 8,
      action: 'skip',
      severity: 'high',
      recoveryAction: 'rest_at_shuttle'
    }));
    
    // Panic message to commander
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      sender: 'Hudson',
      type: 'panic_report',
      content: expect.stringContaining('overwhelmed') || expect.stringContaining('freezing'),
      priority: 'urgent',
      stressLevel: 8
    }));
  });

  it('panic reduces compliance and increases future stress accumulation', async () => {
    mockWorld.agents = [mockHudson];
    mockHudson.stress = 8; // Trigger panic
    mockHudson.compliance = 0.7; // Initial compliance
    
    // First panic reduces compliance
    mockProcessPanicEvent.mockResolvedValueOnce({
      ...mockHudson,
      stress: 8,
      compliance: 0.4, // Reduced from 0.7
      panicStatus: 'active'
    });
    
    await processPanicEvent(mockHudson);
    
    // Subsequent stress event accumulates faster post-panic
    const postPanicStressEvent = {
      type: 'minorFailure',
      agentId: 'hudson',
      stressImpact: 1,
      multiplier: 1.5 // 50% more stress after panic
    } as Event;
    
    mockUpdateAgentStress.mockResolvedValueOnce({
      ...mockHudson,
      stress: 9.5, // 8 + 1.5 (increased accumulation)
      compliance: 0.4
    });

    await updateAgentStress(mockHudson, postPanicStressEvent);

    const world = get(worldStore);
    const hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    
    expect(hudsonAgent.compliance).toBe(0.4); // Reduced after panic
    expect(hudsonAgent.stress).toBeCloseTo(9.5, 1); // Increased accumulation
    expect(hudsonAgent.panicStatus).toBe('active');
    
    // Compliance degradation logged
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'panic',
      complianceChange: -0.3, // 0.7 → 0.4
      degradation: true
    }));
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'stressUpdate',
      stressMultiplier: 1.5,
      postPanic: true,
      accumulationRate: 'increased'
    }));
  });

  it('stress resets to 0 when agent rests at shuttle', async () => {
    mockWorld.agents = [mockHudson];
    mockHudson.stress = 9; // High stress
    mockHudson.position = 'shuttle'; // Safe zone
    mockHudson.panicStatus = 'active';
    
    mockResetStressAtShuttle.mockResolvedValue({
      ...mockHudson,
      stress: 0,
      panicStatus: 'recovered',
      recoveryTurn: 5,
      compliance: 0.7 // Restored
    });

    // Simulate rest action at shuttle - will fail
    await resetStressAtShuttle(mockHudson);

    const world = get(worldStore);
    const hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    
    expect(hudsonAgent.stress).toBe(0);
    expect(hudsonAgent.panicStatus).toBe('recovered');
    expect(hudsonAgent.compliance).toBe(0.7); // Restored to normal
    expect(hudsonAgent.recoveryTurn).toBe(5);
    
    const events = get(eventStore);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'stressRecovery',
      agentId: 'hudson',
      oldStress: 9,
      newStress: 0,
      location: 'shuttle',
      fullRecovery: true,
      complianceRestored: true
    }));
    
    // Recovery message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      sender: 'Hudson',
      type: 'recovery_report',
      content: expect.stringContaining('stress relieved') || expect.stringContaining('back in action'),
      stressLevel: 0
    }));
  });

  it('high stress reduces success rates progressively: >5 (-10%), >7 (-20%), >9 (-30%)', async () => {
    mockWorld.agents = [mockHudson];
    
    const stressLevels = [
      { stress: 4, expectedPenalty: 0, description: 'normal' },
      { stress: 6, expectedPenalty: -0.1, description: 'moderate' },
      { stress: 8, expectedPenalty: -0.2, description: 'high' },
      { stress: 10, expectedPenalty: -0.3, description: 'critical' }
    ];

    const baseAction = { type: 'search', baseSuccessRate: 0.8 };

    for (const level of stressLevels) {
      mockHudson.stress = level.stress;
      
      mockCalculateActionSuccess.mockResolvedValue({
        success: level.stress < 8, // Only succeeds below high stress
        probability: 0.8 + level.expectedPenalty,
        stressPenalty: level.expectedPenalty,
        stressLevel: level.description
      });

      const result = await calculateActionSuccess(mockHudson, baseAction);

      expect(result).toEqual(expect.objectContaining({
        stress: level.stress,
        stressPenalty: level.expectedPenalty,
        probability: 0.8 + level.expectedPenalty,
        stressLevel: level.description,
        success: level.stress < 8
      }));
    }
    
    // Verify progressive degradation logged
    const events = get(eventStore);
    expect(events).toHaveLength(4);
    expect(events.map((e: any) => e.stressLevel)).toEqual([
      'normal', 'moderate', 'high', 'critical'
    ]);
    expect(events.map((e: any) => e.stressPenalty)).toEqual([0, -0.1, -0.2, -0.3]);
  });

  it('multiple agents experience cascading stress effects during combat', async () => {
    mockWorld.agents = [mockHudson, mockVasquez];
    mockHudson.stress = 5; // Near threshold
    mockVasquez.stress = 3;
    
    // Simulate combat affecting both agents
    const combatScenario = {
      type: 'groupCombat',
      agentsInvolved: ['hudson', 'vasquez'],
      enemy: 'alien',
      damage: { hudson: 3, vasquez: 2 },
      stressImpact: 2, // Per agent
      proximityEffect: true // Nearby agents get +1 stress
    };

    mockUpdateAgentStress
      .mockResolvedValueOnce({ ...mockHudson, stress: 8, health: 5 }) // 5 + 2 + 1 proximity
      .mockResolvedValueOnce({ ...mockVasquez, stress: 6, health: 7 }); // 3 + 2 + 1 proximity

    await updateAgentStress(mockHudson, combatScenario as any);
    await updateAgentStress(mockVasquez, combatScenario as any);

    const world = get(worldStore);
    const hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    const vasquezAgent = world.agents.find((a: any) => a.id === 'vasquez');
    
    // Hudson reaches panic threshold
    expect(hudsonAgent.stress).toBe(8);
    expect(hudsonAgent.health).toBe(5);
    expect(hudsonAgent.panicStatus).toBe('pending'); // Will trigger next turn
    
    // Vasquez approaches threshold
    expect(vasquezAgent.stress).toBe(6);
    expect(vasquezAgent.health).toBe(7);
    
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'stressUpdate',
      agentId: 'hudson',
      cause: 'groupCombat',
      proximityEffect: true,
      stressIncrease: 3 // 2 base + 1 proximity
    }));
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'stressUpdate',
      agentId: 'vasquez',
      cause: 'groupCombat',
      proximityEffect: true,
      stressIncrease: 3
    }));
    
    // Team stress message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'team_status',
      content: expect.stringContaining('Combat stress elevated') || expect.stringContaining('Team under pressure'),
      agentsAffected: 2,
      averageStress: 7
    }));
  });

  it('stress management: rest reduces stress gradually, full recovery only at shuttle', async () => {
    mockWorld.agents = [mockHudson];
    mockHudson.stress = 9; // High stress
    mockHudson.position = 'storage'; // Not safe zone
    
    // Partial rest in unsafe zone (reduces by 1)
    const partialRest = {
      type: 'rest',
      agentId: 'hudson',
      location: 'storage',
      safeZone: false,
      stressReduction: 1
    } as Event;
    
    mockUpdateAgentStress.mockResolvedValueOnce({
      ...mockHudson,
      stress: 8, // Only -1 in unsafe zone
      lastAction: 'rest',
      recoveryType: 'partial'
    });

    await updateAgentStress(mockHudson, partialRest);

    let world = get(worldStore);
    let hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    expect(hudsonAgent.stress).toBe(8);
    expect(hudsonAgent.recoveryType).toBe('partial');
    
    // Move to shuttle for full recovery
    mockHudson.position = 'shuttle';
    const fullRecovery = {
      type: 'rest',
      agentId: 'hudson',
      location: 'shuttle',
      safeZone: true,
      stressReduction: 8 // Full reset
    } as Event;
    
    mockResetStressAtShuttle.mockResolvedValueOnce({
      ...mockHudson,
      stress: 0,
      panicStatus: 'fully_recovered',
      compliance: 0.7,
      recoveryType: 'full'
    });

    await resetStressAtShuttle(mockHudson);

    world = get(worldStore);
    hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    
    expect(hudsonAgent.stress).toBe(0);
    expect(hudsonAgent.panicStatus).toBe('fully_recovered');
    expect(hudsonAgent.compliance).toBe(0.7);
    expect(hudsonAgent.recoveryType).toBe('full');
    
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'stressRecovery',
      recoveryType: 'partial',
      stressReduction: 1,
      location: 'storage',
      safeZone: false
    }));
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'stressRecovery',
      recoveryType: 'full',
      stressReduction: 8,
      location: 'shuttle',
      safeZone: true,
      completeReset: true
    }));
    
    // Recovery progression messages
    const messages = get(messageStore);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain('partial rest') || expect(messages[0].content).toContain('stress slightly reduced');
    expect(messages[1].content).toContain('full recovery') || expect(messages[1].content).toContain('stress cleared');
  });

  it('panic chain reaction: one agent panics, increases team stress by proximity', async () => {
    mockWorld.agents = [mockHudson, mockVasquez];
    mockHudson.stress = 8; // About to panic
    mockVasquez.stress = 4; // Nearby, will be affected
    mockHudson.position = 'storage';
    mockVasquez.position = 'storage'; // Same zone
    
    // Hudson panics first
    const hudsonPanic = {
      type: 'panic',
      agentId: 'hudson',
      stressLevel: 8,
      proximityEffect: true,
      zone: 'storage'
    } as Event;
    
    mockProcessPanicEvent.mockResolvedValueOnce({
      ...mockHudson,
      stress: 8,
      panicStatus: 'active',
      lastAction: 'skip'
    });
    
    await processPanicEvent(mockHudson);
    
    // Vasquez gets proximity stress from Hudson's panic
    const proximityStress = {
      type: 'proximityStress',
      agentId: 'vasquez',
      cause: 'hudson_panic',
      stressImpact: 2, // Panic nearby
      proximityDistance: 0 // Same zone
    } as Event;
    
    mockUpdateAgentStress.mockResolvedValueOnce({
      ...mockVasquez,
      stress: 6, // 4 + 2
      proximityAlert: true
    });

    await updateAgentStress(mockVasquez, proximityStress);

    const world = get(worldStore);
    const hudsonAgent = world.agents.find((a: any) => a.id === 'hudson');
    const vasquezAgent = world.agents.find((a: any) => a.id === 'vasquez');
    
    // Hudson in panic
    expect(hudsonAgent.panicStatus).toBe('active');
    expect(hudsonAgent.lastAction).toBe('skip');
    
    // Vasquez affected by proximity
    expect(vasquezAgent.stress).toBe(6);
    expect(vasquezAgent.proximityAlert).toBe(true);
    expect(vasquezAgent.compliance).toBeLessThan(0.9); // Slightly reduced
    
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'panic',
      agentId: 'hudson',
      proximityEffect: true,
      affectedZone: 'storage',
      nearbyAgents: 1
    }));
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'stressUpdate',
      agentId: 'vasquez',
      cause: 'proximity_panic',
      sourceAgent: 'hudson',
      stressIncrease: 2,
      chainReaction: true
    }));
    
    // Team alert message
    const messages = get(messageStore);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'panic_report',
      sender: 'Hudson',
      priority: 'urgent',
      content: expect.stringContaining('panicking')
    }));
    expect(messages[1]).toEqual(expect.objectContaining({
      type: 'team_alert',
      content: expect.stringContaining('Panic affecting team') || expect.stringContaining('Proximity stress'),
      agentsAffected: 2,
      chainReaction: true
    }));
  });
});