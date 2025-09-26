import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { Agent, World, Event, Message } from '../../src/lib/models/index';
import { worldStore } from '../../src/lib/stores/worldStore';
import { eventStore } from '../../src/lib/stores/eventStore';
import { messageStore } from '../../src/lib/stores/messageStore';
import { agentStore } from '../../src/lib/stores/agentStore';
import { pruneAgentMemory } from '../../src/lib/services/agentService'; // Will fail
import { summarizeOldMemory } from '../../src/lib/services/memoryService'; // Will fail
import { calculateTokenUsage } from '../../src/lib/services/llmService'; // Will fail
import { buildAgentPrompt } from '../../src/lib/services/promptService'; // Will fail

// Mock stores and services
vi.mock('../../src/lib/stores/worldStore');
vi.mock('../../src/lib/stores/eventStore');
vi.mock('../../src/lib/stores/messageStore');
vi.mock('../../src/lib/stores/agentStore');
vi.mock('../../src/lib/services/agentService');
vi.mock('../../src/lib/services/memoryService');
vi.mock('../../src/lib/services/llmService');
vi.mock('../../src/lib/services/promptService');

const mockPruneAgentMemory = vi.mocked(pruneAgentMemory);
const mockSummarizeOldMemory = vi.mocked(summarizeOldMemory);
const mockCalculateTokenUsage = vi.mocked(calculateTokenUsage);
const mockBuildAgentPrompt = vi.mocked(buildAgentPrompt);

describe('Memory Pruning and Token Limits Integration', () => {
  let mockWorld: World;
  let mockHudson: Agent;
  let mockEvents: Event[];
  let mockMessages: Message[];
  let longMemoryHistory: Event[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWorld = {
      zones: {
        shuttle: { id: 'shuttle', name: 'Shuttle' } as any,
        storage: { id: 'storage', name: 'Storage' } as any,
      },
      agents: [],
      turn: 1,
      gameState: 'active'
    } as World;

    mockHudson = {
      id: 'hudson',
      name: 'Hudson',
      type: 'aggressive',
      position: 'shuttle',
      health: 10,
      stress: 2,
      memory: [],
      memoryTokenCount: 0,
      compliance: 0.7
    } as Agent;

    mockEvents = [];
    mockMessages = [];

    // Create long memory history (60 events over 25 turns)
    longMemoryHistory = [];
    for (let turn = 1; turn <= 25; turn++) {
      for (let event = 1; event <= 2; event++) { // 2 events per turn
        longMemoryHistory.push({
          type: turn % 3 === 0 ? 'combat' : 'move',
          agentId: 'hudson',
          turn,
          description: `Turn ${turn} Event ${event}: ${turn % 3 === 0 ? 'Combat encounter' : 'Moved to zone'}`,
          timestamp: Date.now() - (25 - turn) * 86400000, // Backdated
          tokens: Math.floor(Math.random() * 50) + 20 // 20-70 tokens per event
        } as Event);
      }
    }

    // Mock store gets
    (worldStore as any).get = vi.fn(() => mockWorld);
    (eventStore as any).get = vi.fn(() => mockEvents);
    (messageStore as any).get = vi.fn(() => mockMessages);
    (agentStore as any).get = vi.fn(() => [mockHudson]);
  });

  it('memory stream grows beyond 50 events after 20+ turns', async () => {
    // Setup long memory history
    mockHudson.memory = [...longMemoryHistory];
    mockHudson.memoryTokenCount = longMemoryHistory.reduce((sum, e) => sum + (e.tokens || 0), 0);
    
    // Simulate 25 turns of gameplay
    mockWorld.turn = 25;
    mockEvents.push(...longMemoryHistory);
    (eventStore as any).get = vi.fn(() => mockEvents);

    const memoryState = await pruneAgentMemory(mockHudson);

    expect(memoryState).toEqual(expect.objectContaining({
      totalEvents: 50, // 25 turns × 2 events
      totalTokens: expect.any(Number).greaterThan(1000),
      growthConfirmed: true,
      turnsElapsed: 25
    }));
    
    expect(mockPruneAgentMemory).toHaveBeenCalledWith(mockHudson);
    
    // Events show memory growth
    const events = get(eventStore);
    const memoryEvents = events.filter((e: any) => e.type === 'memoryUpdate');
    expect(memoryEvents).toHaveLength(1);
    expect(memoryEvents[0]).toEqual(expect.objectContaining({
      type: 'memoryUpdate',
      agentId: 'hudson',
      milestone: 'memory_growth_threshold',
      eventCount: 50,
      tokenCount: expect.any(Number).greaterThan(1000),
      turns: 25
    }));
  });

  it('prunes memory to last 10 turns (20 events) when exceeding limits', async () => {
    // Setup oversized memory
    mockHudson.memory = [...longMemoryHistory]; // 50 events
    mockHudson.memoryTokenCount = 2500; // Over limit
    
    const expectedPruned = longMemoryHistory.slice(-20); // Last 10 turns (20 events)
    const expectedTokens = expectedPruned.reduce((sum, e) => sum + (e.tokens || 0), 0);
    
    mockPruneAgentMemory.mockResolvedValue({
      ...mockHudson,
      memory: expectedPruned,
      memoryTokenCount: expectedTokens,
      pruning: {
        removedEvents: 30,
        removedTurns: 15,
        keptTurns: 10,
        keptEvents: 20,
        tokenSavings: 1500 // Approximate
      }
    });

    // Trigger pruning - will fail as implementation missing
    const result = await pruneAgentMemory(mockHudson);

    expect(result).toEqual(expect.objectContaining({
      memory: expect.arrayContaining(expectedPruned.map(e => expect.objectContaining({ turn: expect.any(Number) }))),
      memoryTokenCount: expectedTokens,
      pruning: expect.objectContaining({
        removedEvents: 30,
        keptTurns: 10,
        tokenSavings: expect.any(Number).greaterThan(1000)
      })
    }));
    
    expect(mockPruneAgentMemory).toHaveBeenCalledTimes(1);
    
    // Pruning event logged
    const events = get(eventStore);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'memoryPruning',
      agentId: 'hudson',
      beforeCount: 50,
      afterCount: 20,
      removedTurns: 15,
      tokenReduction: expect.any(Number).greaterThan(1000),
      strategy: 'last_10_turns'
    }));
    
    // System message about pruning
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'system_info',
      sender: 'Memory Manager',
      content: expect.stringContaining('Memory pruned') || expect.stringContaining('Token limit reached'),
      agent: 'Hudson',
      savings: expect.any(Number).greaterThan(1000)
    }));
  });

  it('summarizes old memory as "Previous: X searches, Y combats" for pruned content', async () => {
    // Setup memory to summarize (first 15 turns, 30 events)
    const oldMemory = longMemoryHistory.slice(0, 30); // First 15 turns
    const recentMemory = longMemoryHistory.slice(-20); // Last 10 turns
    
    // Analyze old memory content
    const searchCount = oldMemory.filter((e: any) => e.type === 'move').length; // Assuming move = search-like
    const combatCount = oldMemory.filter((e: any) => e.type === 'combat').length;
    const oldTokenCount = oldMemory.reduce((sum, e) => sum + (e.tokens || 0), 0);
    
    const summary = {
      summary: `Previous: ${searchCount} searches, ${combatCount} combats, ${oldTokenCount} tokens`,
      oldEvents: 30,
      oldTurns: 15,
      summaryTokens: 50, // Approximate summary size
      compressionRatio: 0.02 // 50/2500 ≈ 2%
    };

    mockSummarizeOldMemory.mockResolvedValue(summary);

    const result = await summarizeOldMemory(oldMemory, { agentId: 'hudson', turns: 15 });

    expect(result).toEqual(expect.objectContaining({
      summary: expect.stringContaining('Previous:'),
      oldEvents: 30,
      oldTurns: 15,
      summaryTokens: expect.any(Number).lessThan(100),
      compressionRatio: expect.any(Number).lessThan(0.05),
      agentId: 'hudson'
    }));
    
    expect(mockSummarizeOldMemory).toHaveBeenCalledWith(oldMemory, expect.objectContaining({
      agentId: 'hudson',
      turns: 15,
      maxSummaryTokens: 100
    }));
    
    // Summary event logged
    const events = get(eventStore);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'memorySummary',
      agentId: 'hudson',
      oldEvents: 30,
      summary: expect.stringContaining('Previous:'),
      compression: expect.any(Number).greaterThan(0.9), // 95%+ compression
      summaryTokens: expect.any(Number).lessThan(100)
    }));
  });

  it('token usage stays <2000 per prompt after pruning and summarization', async () => {
    // Setup oversized scenario
    mockHudson.memory = [...longMemoryHistory]; // 50 events, ~2500 tokens
    mockHudson.memoryTokenCount = 2500;
    
    // Mock pruning + summarization
    const prunedMemory = longMemoryHistory.slice(-20); // 20 events, ~1000 tokens
    const summary = 'Previous: 18 searches, 12 combats, 1500 tokens'; // 50 tokens
    const promptComponents = {
      agentInfo: 200, // Agent state
      worldState: 300, // Current world
      recentMemory: 1000, // 20 events
      summary: 50, // Old memory summary
      commanderMessage: 100, // Current orders
      actionChoices: 150, // Available actions
      total: 1800 // Under 2000 limit
    };
    
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: prunedMemory,
      memoryTokenCount: 1000
    });
    
    mockSummarizeOldMemory.mockResolvedValueOnce({
      summary,
      summaryTokens: 50
    });
    
    mockCalculateTokenUsage.mockResolvedValueOnce(promptComponents);

    // Build prompt after pruning - will fail
    const prompt = await buildAgentPrompt(mockHudson, mockWorld, [], 'Search storage');

    expect(prompt).toEqual(expect.objectContaining({
      totalTokens: 1800,
      underLimit: true,
      limit: 2000,
      components: expect.objectContaining({
        recentMemory: 1000,
        summary: 50,
        total: 1800
      })
    }));
    
    expect(mockBuildAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ memoryTokenCount: 1000 }), // Pruned
      mockWorld,
      [],
      'Search storage'
    );
    
    // Token usage logged
    const events = get(eventStore);
    expect(events).toHaveLength(2); // Pruning + token calculation
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'tokenUsage',
      agentId: 'hudson',
      promptTokens: 1800,
      limit: 2000,
      underLimit: true,
      memoryPruned: true,
      summaryUsed: true
    }));
    
    // No overflow warning
    const messages = get(messageStore);
    expect(messages).toHaveLength(0); // No warning needed
  });

  it('prompt includes memory summary when old events pruned', async () => {
    // Setup with pruning
    const oldEvents = longMemoryHistory.slice(0, 30); // First 15 turns to summarize
    const recentEvents = longMemoryHistory.slice(-20); // Last 10 turns to keep
    
    mockHudson.memory = [...oldEvents, ...recentEvents];
    mockHudson.memoryTokenCount = 2000; // Over limit
    
    const summary = 'Previous 15 turns: 18 moves, 12 combats, stress events: 5, total tokens saved: 1500';
    
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: recentEvents,
      memoryTokenCount: 1000,
      oldMemorySummary: summary
    });
    
    mockSummarizeOldMemory.mockResolvedValueOnce({
      summary,
      oldEvents: 30,
      compression: 0.95
    });

    // Build prompt with summary - will fail
    const prompt = await buildAgentPrompt(mockHudson, mockWorld, [], 'Status report');

    expect(prompt).toEqual(expect.objectContaining({
      memory: expect.arrayContaining(recentEvents.map((e: any) => expect.objectContaining({ turn: expect.any(Number) }))),
      memorySummary: summary,
      usesSummary: true,
      recentTurns: 10,
      totalMemoryTurns: 25,
      tokenEfficient: true
    }));
    
    // Verify summary included in prompt structure
    expect(prompt.components).toEqual(expect.objectContaining({
      recentMemory: expect.any(Array).length(20),
      memorySummary: summary,
      summaryTokens: expect.any(Number).lessThan(100),
      totalTokens: expect.any(Number).lessThan(2000)
    }));
    
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'promptConstruction',
      agentId: 'hudson',
      includesSummary: true,
      recentEvents: 20,
      summaryLength: summary.length,
      tokenSavings: expect.any(Number).greaterThan(1000)
    }));
  });

  it('maintains 10-turn memory window across multiple pruning cycles', async () => {
    // Simulate multiple pruning cycles over extended play
    mockWorld.turn = 35; // Well past initial 25 turns
    
    // Initial long history + additional turns
    const extendedHistory = [...longMemoryHistory];
    for (let turn = 26; turn <= 35; turn++) {
      extendedHistory.push({
        type: 'report',
        agentId: 'hudson',
        turn,
        description: `Turn ${turn}: Status report`,
        timestamp: Date.now(),
        tokens: 30
      } as Event);
    }
    
    mockHudson.memory = extendedHistory; // 50 + 10 = 60 events
    mockHudson.memoryTokenCount = 3000;
    
    // First pruning: keep last 10 turns (turns 26-35, 20 events)
    const firstPruning = extendedHistory.slice(-20);
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: firstPruning,
      memoryTokenCount: 600,
      pruningCycle: 1
    });
    
    // Simulate more turns (36-40)
    const moreEvents = [];
    for (let turn = 36; turn <= 40; turn++) {
      moreEvents.push({
        type: 'move',
        agentId: 'hudson',
        turn,
        description: `Turn ${turn}: Moved to storage`,
        tokens: 40
      } as Event);
    }
    
    // Second pruning: now keep turns 31-40 (still 10 turns, 20 events)
    const secondPruning = [...firstPruning.slice(-10), ...moreEvents]; // Last 10 from first + 5 new = 15 events
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: secondPruning,
      memoryTokenCount: 750,
      pruningCycle: 2,
      maintainedWindow: true
    });

    // First pruning cycle
    await pruneAgentMemory(mockHudson);
    
    // Add new events
    mockEvents.push(...moreEvents);
    mockHudson.memory.push(...moreEvents);
    mockHudson.memoryTokenCount += 200;
    
    // Second pruning cycle
    const finalResult = await pruneAgentMemory(mockHudson);

    expect(finalResult).toEqual(expect.objectContaining({
      memory: expect.arrayContaining(secondPruning.map((e: any) => expect.objectContaining({ turn: expect.any(Number) }))),
      memoryTokenCount: 750,
      pruningCycle: 2,
      windowTurns: 10,
      consistentWindow: true,
      totalPrunings: 2
    }));
    
    // Verify 10-turn sliding window maintained
    const memoryTurns = finalResult.memory.map((e: any) => e.turn);
    const minTurn = Math.min(...memoryTurns);
    const maxTurn = Math.max(...memoryTurns);
    expect(maxTurn - minTurn + 1).toBe(10); // Exactly 10 turns
    
    const events = get(eventStore);
    expect(events.filter((e: any) => e.type === 'memoryPruning')).toHaveLength(2);
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'memoryPruning',
      pruningCycle: 2,
      windowMaintained: true,
      turnWindow: 10,
      eventsKept: 20,
      slidingWindow: true
    }));
  });

  it('token pruning prevents prompt overflow during high-activity turns', async () => {
    // Setup high-activity scenario (many events in short time)
    mockWorld.turn = 28;
    
    // Generate burst of 15 events in single turn (unusually high activity)
    const highActivityEvents = [];
    for (let i = 0; i < 15; i++) {
      highActivityEvents.push({
        type: i % 3 === 0 ? 'combat' : 'move',
        agentId: 'hudson',
        turn: 28,
        description: `Turn 28 Event ${i + 1}: ${i % 3 === 0 ? 'Combat!' : 'Movement'}`,
        tokens: Math.floor(Math.random() * 80) + 40, // 40-120 tokens each
        timestamp: Date.now() - (15 - i) * 1000 // Recent events
      } as Event);
    }
    
    // Total tokens would be ~900 for this turn alone
    const burstTokens = highActivityEvents.reduce((sum, e) => sum + e.tokens, 0);
    
    // Plus recent memory from previous turns
    const recentMemory = longMemoryHistory.slice(-10); // Previous 5 turns, ~500 tokens
    const totalWithoutPruning = burstTokens + 500; // ~1400 tokens
    
    mockHudson.memory = [...recentMemory, ...highActivityEvents];
    mockHudson.memoryTokenCount = totalWithoutPruning;
    
    // Pruning keeps only most critical events
    const criticalEvents = highActivityEvents.filter((e: any) => e.type === 'combat').concat(
      highActivityEvents.slice(-5) // Last 5 events regardless of type
    );
    const prunedTokens = criticalEvents.reduce((sum, e) => sum + e.tokens, 0) + 300; // ~800 total
    
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: criticalEvents,
      memoryTokenCount: prunedTokens,
      highActivity: true,
      criticalOnly: true,
      eventsKept: criticalEvents.length,
      tokenReduction: totalWithoutPruning - prunedTokens
    });

    // Build prompt during high activity - will fail
    const prompt = await buildAgentPrompt(mockHudson, mockWorld, [], 'Emergency: multiple contacts!');

    expect(prompt).toEqual(expect.objectContaining({
      totalTokens: prunedTokens + 800, // Memory + other prompt parts < 2000
      underLimit: true,
      highActivityMode: true,
      criticalEventsOnly: true,
      eventsKept: criticalEvents.length,
      tokenReduction: expect.any(Number).greaterThan(500)
    }));
    
    expect(prompt.components).toEqual(expect.objectContaining({
      memoryTokens: prunedTokens,
      criticalEvents: criticalEvents.length,
      activityLevel: 'high',
      emergencyMode: true,
      total: expect.any(Number).lessThan(2000)
    }));
    
    const events = get(eventStore);
    expect(events).toHaveLength(2); // Pruning + token calculation
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'memoryPruning',
      highActivity: true,
      criticalOnly: true,
      burstEvents: 15,
      keptEvents: criticalEvents.length,
      emergencyPruning: true,
      tokenSavings: expect.any(Number).greaterThan(500)
    }));
    
    // Emergency system message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'system_emergency',
      priority: 'critical',
      content: expect.stringContaining('High activity detected') || expect.stringContaining('Memory emergency pruning'),
      agent: 'Hudson',
      eventsProcessed: 15,
      tokensSaved: expect.any(Number).greaterThan(500)
    }));
  });

  it('memory pruning preserves key narrative events across summarization', async () => {
    // Setup narrative-rich history
    const narrativeEvents = [
      // Critical mission events (always preserved)
      { type: 'missionCritical', description: 'Vial discovered in medbay', turn: 3, tokens: 60, priority: 'high' },
      { type: 'combatCritical', description: 'First alien encounter - Hicks injured', turn: 7, tokens: 80, priority: 'high' },
      { type: 'teamEvent', description: 'Vasquez saves Hudson from ambush', turn: 12, tokens: 70, priority: 'medium' },
      
      // Regular events to prune
      ...Array.from({ length: 20 }, (_, i) => ({
        type: 'move',
        description: `Routine movement turn ${i + 1}`,
        turn: i + 1,
        tokens: 30,
        priority: 'low'
      })),
      
      // Recent critical events
      { type: 'emergency', description: 'Alien breach in shuttle bay!', turn: 24, tokens: 90, priority: 'critical' },
      { type: 'commanderOrder', description: 'Emergency evac ordered', turn: 25, tokens: 50, priority: 'high' }
    ];
    
    mockHudson.memory = narrativeEvents;
    mockHudson.memoryTokenCount = narrativeEvents.reduce((sum, e) => sum + (e.tokens || 0), 0);
    
    // Pruning preserves high-priority events, summarizes low-priority
    const preservedEvents = narrativeEvents.filter((e: any) => 
      e.priority === 'high' || e.priority === 'critical' || e.turn > 20
    );
    const summarizedEvents = narrativeEvents.filter((e: any) => 
      e.priority === 'low' && e.turn <= 20
    );
    
    const summary = `Routine: ${summarizedEvents.length} movements, no major incidents (turns 1-20)`;
    
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: preservedEvents,
      memoryTokenCount: preservedEvents.reduce((sum, e) => sum + (e.tokens || 0), 0),
      preservedCritical: true,
      summaryAdded: summary,
      narrativeIntegrity: true
    });
    
    mockSummarizeOldMemory.mockResolvedValueOnce({
      summary,
      preservedEvents: preservedEvents.length,
      summarizedEvents: summarizedEvents.length,
      narrativeKeyEvents: 3 // Critical events kept
    });

    const result = await pruneAgentMemory(mockHudson);

    expect(result).toEqual(expect.objectContaining({
      memory: expect.arrayContaining([
        expect.objectContaining({ description: 'Vial discovered in medbay' }),
        expect.objectContaining({ description: 'First alien encounter' }),
        expect.objectContaining({ description: 'Alien breach in shuttle bay!' }),
        expect.objectContaining({ description: 'Emergency evac ordered' })
      ]),
      preservedCritical: true,
      narrativeIntegrity: true,
      highPriorityKept: 4,
      lowPrioritySummarized: 20,
      summary: summary
    }));
    
    // Verify key narrative events preserved
    const memoryEvents = result.memory as any[];
    const criticalPreserved = memoryEvents.filter(e => e.priority === 'high' || e.priority === 'critical');
    expect(criticalPreserved.length).toBe(4);
    
    const recentPreserved = memoryEvents.filter(e => e.turn > 20);
    expect(recentPreserved.length).toBe(2);
    
    // No low-priority events from early turns
    const oldRoutine = memoryEvents.filter(e => e.priority === 'low' && e.turn <= 20);
    expect(oldRoutine.length).toBe(0);
    
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'memoryPruning',
      narrativePreserved: true,
      criticalEventsKept: 4,
      summarizedRoutine: 20,
      storyIntegrity: 'maintained',
      keyMoments: ['vial_discovery', 'first_contact', 'team_save', 'emergency_breach']
    }));
    
    // Narrative summary message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'narrative_summary',
      content: expect.stringContaining('Memory preserved:') || expect.stringContaining('Key events maintained'),
      criticalEvents: 4,
      summarized: 20,
      narrativeHealth: 'good'
    }));
  });

  it('pruning strategy adapts to different agent personalities', async () => {
    // Test different agent types with different pruning strategies
    
    const agentTypes = [
      {
        type: 'cautious',
        expectedStrategy: 'safety_first',
        preservedPriorities: ['safe_moves', 'rest_events', 'recovery'],
        pruningAggressiveness: 'conservative'
      },
      {
        type: 'aggressive',
        expectedStrategy: 'combat_focus',
        preservedPriorities: ['combat', 'attacks', 'pursuits'],
        pruningAggressiveness: 'moderate'
      },
      {
        type: 'balanced',
        expectedStrategy: 'mission_priority',
        preservedPriorities: ['objectives', 'team_events', 'progress'],
        pruningAggressiveness: 'balanced'
      }
    ];

    for (const agentConfig of agentTypes) {
      const testAgent = { ...mockHudson, type: agentConfig.type };
      
      // Create personality-specific event history
      const personalityEvents = [
        // Common events
        { type: 'move', turn: 1, tokens: 30, priority: 'low' },
        { type: 'combat', turn: 5, tokens: 80, priority: 'high' },
        { type: 'rest', turn: 10, tokens: 40, priority: 'medium' },
        
        // Personality-specific events
        ...(agentConfig.type === 'cautious' ? [
          { type: 'safe_move', turn: 15, tokens: 50, priority: 'high' },
          { type: 'recovery', turn: 20, tokens: 60, priority: 'critical' }
        ] : []),
        ...(agentConfig.type === 'aggressive' ? [
          { type: 'attack', turn: 15, tokens: 70, priority: 'critical' },
          { type: 'pursuit', turn: 20, tokens: 65, priority: 'high' }
        ] : []),
        ...(agentConfig.type === 'balanced' ? [
          { type: 'objective', turn: 15, tokens: 55, priority: 'high' },
          { type: 'team_event', turn: 20, tokens: 75, priority: 'medium' }
        ] : [])
      ];
      
      testAgent.memory = personalityEvents;
      testAgent.memoryTokenCount = personalityEvents.reduce((sum, e) => sum + (e.tokens || 0), 0);
      
      // Mock personality-specific pruning
      const preservedEvents = personalityEvents.filter(e => 
        agentConfig.preservedPriorities.includes(e.type) || e.priority === 'critical'
      );
      
      mockPruneAgentMemory.mockResolvedValueOnce({
        ...testAgent,
        memory: preservedEvents,
        memoryTokenCount: preservedEvents.reduce((sum, e) => sum + (e.tokens || 0), 0),
        strategy: agentConfig.expectedStrategy,
        personalityAdapted: true,
        aggressiveness: agentConfig.pruningAggressiveness
      });

      const result = await pruneAgentMemory(testAgent);

      expect(result).toEqual(expect.objectContaining({
        type: agentConfig.type,
        strategy: agentConfig.expectedStrategy,
        personalityAdapted: true,
        preservedPriorities: agentConfig.preservedPriorities,
        aggressiveness: agentConfig.pruningAggressiveness
      }));
      
      // Verify personality-specific preservation
      const memoryEvents = result.memory as any[];
      const preservedTypes = memoryEvents.map((e: any) => e.type);
      
      // Critical events preserved for all
      expect(preservedTypes).toContain('combat');
      
      // Personality-specific preservation
      if (agentConfig.type === 'cautious') {
        expect(preservedTypes).toContain('safe_move');
        expect(preservedTypes).toContain('recovery');
        expect(preservedTypes.filter(t => t === 'attack').length).toBe(0); // Avoid aggressive actions
      }
      
      if (agentConfig.type === 'aggressive') {
        expect(preservedTypes).toContain('attack');
        expect(preservedTypes).toContain('pursuit');
        expect(preservedTypes.filter(t => t === 'rest').length).toBe(0); // Avoid passive actions
      }
      
      if (agentConfig.type === 'balanced') {
        expect(preservedTypes).toContain('objective');
        expect(preservedTypes).toContain('team_event');
        // Balanced keeps variety
        expect(new Set(preservedTypes).size).toBeGreaterThan(3);
      }
      
      const events = get(eventStore);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(expect.objectContaining({
        type: 'memoryPruning',
        agentType: agentConfig.type,
        strategy: agentConfig.expectedStrategy,
        personalityAdapted: true,
        preservedTypes: expect.arrayContaining(agentConfig.preservedPriorities),
        aggressiveness: agentConfig.pruningAggressiveness
      }));
    }
  });

  it('pruning maintains memory coherence by preserving event chains', async () => {
    // Setup event chain that tells a story
    const storyChain = [
      // Mission start chain
      { type: 'missionStart', turn: 1, description: 'Mission: Retrieve vial from medbay', tokens: 60, chainId: 'mission_vial' },
      { type: 'move', turn: 2, description: 'Moving toward medbay', tokens: 30, chainId: 'mission_vial' },
      
      // Discovery chain  
      { type: 'search', turn: 8, description: 'Searching medbay cabinets', tokens: 40, chainId: 'vial_discovery' },
      { type: 'discovery', turn: 9, description: 'Vial found! Securing sample', tokens: 70, chainId: 'vial_discovery' },
      
      // Combat chain
      { type: 'alienSighting', turn: 15, description: 'Alien detected in corridor', tokens: 50, chainId: 'first_contact' },
      { type: 'combat', turn: 16, description: 'Engaging alien - Vasquez covering', tokens: 80, chainId: 'first_contact' },
      { type: 'retreat', turn: 17, description: 'Team retreating to shuttle bay', tokens: 45, chainId: 'first_contact' },
      
      // Resolution chain
      { type: 'vialReturn', turn: 23, description: 'Vial returned to shuttle', tokens: 65, chainId: 'mission_vial' },
      { type: 'extraction', turn: 24, description: 'Preparing for evac', tokens: 55, chainId: 'mission_vial' }
    ];
    
    // Add filler events that can be pruned
    const fillerEvents = Array.from({ length: 25 }, (_, i) => ({
      type: 'routine',
      turn: i + 1,
      description: `Routine activity ${i + 1}`,
      tokens: 25,
      chainId: null
    }));
    
    const fullHistory = [...fillerEvents, ...storyChain];
    mockHudson.memory = fullHistory;
    mockHudson.memoryTokenCount = fullHistory.reduce((sum, e) => sum + (e.tokens || 0), 0);
    
    // Pruning should preserve complete chains, summarize fillers
    const preservedChains = storyChain.filter(e => e.chainId); // All chain events preserved
    const summarizedFillers = fillerEvents.length; // Count only
    
    const summary = `Routine activities: ${summarizedFillers} events across 25 turns, no major incidents`;
    
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: preservedChains,
      memoryTokenCount: preservedChains.reduce((sum, e) => sum + (e.tokens || 0), 0),
      chainPreservation: true,
      chainsMaintained: 3, // mission_vial, vial_discovery, first_contact
      summary: summary,
      narrativeCoherence: 'complete'
    });
    
    mockSummarizeOldMemory.mockResolvedValueOnce({
      summary,
      preservedChains: 3,
      chainEvents: storyChain.length,
      summarizedFillers: summarizedFillers,
      coherenceScore: 1.0
    });

    const result = await pruneAgentMemory(mockHudson);

    expect(result).toEqual(expect.objectContaining({
      memory: expect.arrayContaining(storyChain.map((e: any) => expect.objectContaining({
        chainId: expect.any(String),
        description: expect.any(String)
      }))),
      chainPreservation: true,
      chainsMaintained: 3,
      narrativeCoherence: 'complete',
      summary: summary
    }));
    
    // Verify all chain events preserved
    const memoryEvents = result.memory as any[];
    const chainEvents = memoryEvents.filter(e => e.chainId);
    expect(chainEvents.length).toBe(storyChain.length); // All 8 chain events preserved
    
    // No filler events preserved
    const routineEvents = memoryEvents.filter(e => e.type === 'routine');
    expect(routineEvents.length).toBe(0);
    
    // All chains complete (no broken chains)
    const chainIds = [...new Set(storyChain.map((e: any) => e.chainId))];
    const completeChains = chainIds.every(chainId => 
      chainEvents.filter((e: any) => e.chainId === chainId).length > 0
    );
    expect(completeChains).toBe(true);
    
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'memoryPruning',
      chainPreservation: true,
      chainsMaintained: 3,
      chainEventsPreserved: 8,
      fillerSummarized: 25,
      coherenceScore: 1.0,
      narrativeComplete: true
    }));
    
    // Story preservation message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'narrative_maintenance',
      content: expect.stringContaining('Story chains preserved') || expect.stringContaining('Narrative coherence maintained'),
      chainsKept: 3,
      criticalEvents: 8,
      coherence: 'complete'
    }));
  });

  it('token limits enforce prompt structure optimization during memory overflow', async () => {
    // Setup extreme memory overflow scenario
    mockWorld.turn = 45; // Long game
    
    // Massive event history (100+ events)
    const massiveHistory = [];
    for (let turn = 1; turn <= 45; turn++) {
      for (let event = 1; event <= 3; event++) { // 3 events per turn
        massiveHistory.push({
          type: Math.random() > 0.7 ? 'combat' : 'move',
          agentId: 'hudson',
          turn,
          description: `Turn ${turn} Event ${event}`,
          tokens: Math.floor(Math.random() * 100) + 30, // 30-130 tokens
          priority: Math.random() > 0.8 ? 'high' : 'low'
        } as Event);
      }
    }
    
    mockHudson.memory = massiveHistory;
    mockHudson.memoryTokenCount = massiveHistory.reduce((sum, e) => sum + e.tokens, 0); // ~6000 tokens
    
    // Optimization strategy: aggressive pruning + heavy summarization
    const highPriorityEvents = massiveHistory.filter((e: any) => e.priority === 'high'); // ~20 events
    const recentCritical = massiveHistory.filter((e: any) => e.turn > 35 && e.type === 'combat'); // Last 10 turns combat only
    const summaryLevels = {
      earlyGame: 'Turns 1-15: Initial exploration, 2 combats, no objectives (800 tokens summarized)',
      midGame: 'Turns 16-25: First contacts, vial pursuit, team stress building (1200 tokens summarized)', 
      lateGame: 'Turns 26-35: Escalation phase, multiple engagements, near-miss evac (1500 tokens summarized)'
    };
    
    const optimizedMemory = [...highPriorityEvents, ...recentCritical];
    const summaryTokens = Object.values(summaryLevels).reduce((sum, s) => sum + s.length, 0) / 4; // ~200 tokens total
    const finalTokens = optimizedMemory.reduce((sum, e) => sum + e.tokens, 0) + summaryTokens + 600; // ~1800 total
    
    mockPruneAgentMemory.mockResolvedValueOnce({
      ...mockHudson,
      memory: optimizedMemory,
      memoryTokenCount: finalTokens - 600, // Memory portion
      optimizationLevel: 'aggressive',
      multiLevelSummary: true,
      preservedCritical: highPriorityEvents.length,
      recentCombat: recentCritical.length,
      summaryTokens: summaryTokens
    });
    
    mockSummarizeOldMemory.mockResolvedValueOnce({
      multiLevelSummary: summaryLevels,
      totalSummaryTokens: summaryTokens,
      compressionRatio: 0.7, // 70% reduction
      optimizationStrategy: 'tiered_summarization'
    });

    // Build emergency optimized prompt - will fail
    const prompt = await buildAgentPrompt(mockHudson, mockWorld, [], 'CRITICAL: Multiple alien contacts!');

    expect(prompt).toEqual(expect.objectContaining({
      totalTokens: finalTokens,
      underLimit: true,
      emergencyOptimization: true,
      optimizationLevel: 'aggressive',
      multiLevelSummary: true,
      criticalEventsPreserved: highPriorityEvents.length,
      recentCombatFocus: true,
      tokenMargin: 200 // 2000 - 1800
    }));
    
    expect(prompt.components).toEqual(expect.objectContaining({
      criticalMemory: highPriorityEvents.length * 80, // ~1600 tokens
      recentCombat: recentCritical.length * 90,
      tieredSummaries: summaryTokens,
      emergencyMode: true,
      total: finalTokens
    }));
    
    // Detailed optimization logging
    const events = get(eventStore);
    expect(events).toHaveLength(3); // Pruning, summarization, token calculation
    expect(events[2]).toEqual(expect.objectContaining({
      type: 'tokenOptimization',
      agentId: 'hudson',
      strategy: 'aggressive',
      emergency: true,
      originalTokens: 6000,
      optimizedTokens: finalTokens,
      reduction: 4200,
      margin: 200,
      multiLevelSummary: true,
      criticalPreserved: highPriorityEvents.length
    }));
    
    // Emergency optimization alert
    const messages = get(messageStore);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'system_emergency',
      priority: 'critical',
      content: expect.stringContaining('MEMORY EMERGENCY') || expect.stringContaining('Aggressive optimization'),
      originalTokens: 6000,
      optimized: finalTokens,
      margin: 200
    }));
    expect(messages[1]).toEqual(expect.objectContaining({
      type: 'optimization_summary',
      content: expect.stringContaining('Multi-level summarization applied'),
      levels: 3,
      criticalEvents: highPriorityEvents.length,
      compression: '70%'
    }));
  });
});