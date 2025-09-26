import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { Agent, World, Event } from '../../src/lib/models/index';
import { worldStore } from '../../src/lib/stores/worldStore';
import { eventStore } from '../../src/lib/stores/eventStore';
import { messageStore } from '../../src/lib/stores/messageStore';
import { generateAgentAction } from '../../src/lib/services/llmService'; // Will fail
import { fallbackAgentAction } from '../../src/lib/services/agentService'; // Will fail
import { retryLLMCall } from '../../src/lib/services/llmService'; // Will fail

// Mock stores and services
vi.mock('../../src/lib/stores/worldStore');
vi.mock('../../src/lib/stores/eventStore');
vi.mock('../../src/lib/stores/messageStore');
vi.mock('../../src/lib/services/llmService');
vi.mock('../../src/lib/services/agentService');

const mockGenerateAgentAction = vi.mocked(generateAgentAction);
const mockFallbackAgentAction = vi.mocked(fallbackAgentAction);
const mockRetryLLMCall = vi.mocked(retryLLMCall);

describe('LLM Fallback Integration', () => {
  let mockAgent: Agent;
  let mockWorld: World;
  let mockPrompt: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAgent = {
      id: 'hudson',
      name: 'Hudson',
      type: 'aggressive',
      position: 'shuttle',
      health: 10,
      stress: 2,
      memory: ['Previous turn: moved to shuttle bay'],
      compliance: 0.7
    } as Agent;

    mockWorld = {
      zones: {
        shuttle: { id: 'shuttle', name: 'Shuttle', adjacent: ['shuttleBay'] } as any,
        storage: { id: 'storage', name: 'Storage', adjacent: ['corridor'] } as any,
      },
      agents: [mockAgent],
      turn: 5,
      gameState: 'active'
    } as World;

    mockPrompt = {
      agent: mockAgent,
      world: mockWorld,
      messages: [],
      turn: 5,
      availableActions: ['move', 'search', 'report', 'takeCover']
    };

    // Mock store gets
    (worldStore as any).get = vi.fn(() => mockWorld);
    (eventStore as any).get = vi.fn(() => []);
    (messageStore as any).get = vi.fn(() => []);
  });

  it('LLM returns valid JSON action on first try', async () => {
    const validResponse = {
      action: 'move',
      target: 'storage',
      confidence: 0.8,
      reasoning: 'Commander ordered search, moving to storage'
    };

    mockGenerateAgentAction.mockResolvedValueOnce(validResponse);

    // Simulate LLM call - will fail as implementation missing
    const result = await generateAgentAction(mockAgent, mockPrompt);

    expect(result).toEqual(expect.objectContaining({
      action: 'move',
      target: 'storage',
      valid: true,
      retries: 0
    }));
    
    expect(mockGenerateAgentAction).toHaveBeenCalledTimes(1);
    expect(mockFallbackAgentAction).not.toHaveBeenCalled();
    
    // Event logged
    const events = get(eventStore);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'agentAction',
      agentId: 'hudson',
      action: 'move',
      source: 'llm',
      valid: true
    }));
  });

  it('LLM returns invalid JSON on first try, retries once successfully', async () => {
    // Mock invalid responses
    const invalidJSON1 = '{ malformed: json }'; // Invalid JSON
    const validResponse = {
      action: 'search',
      target: 'storage',
      confidence: 0.7,
      reasoning: 'Searching for vial'
    };

    mockGenerateAgentAction
      .mockResolvedValueOnce({ rawResponse: invalidJSON1, valid: false })
      .mockResolvedValueOnce(validResponse);

    const result = await generateAgentAction(mockAgent, mockPrompt);

    expect(result).toEqual(expect.objectContaining({
      action: 'search',
      target: 'storage',
      valid: true,
      retries: 1,
      errorType: 'invalid_json'
    }));
    
    expect(mockGenerateAgentAction).toHaveBeenCalledTimes(2);
    expect(mockFallbackAgentAction).not.toHaveBeenCalled();
    
    // Error logged but action succeeds
    const events = get(eventStore);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'llmError',
      agentId: 'hudson',
      error: 'invalid_json',
      retry: 1
    }));
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'agentAction',
      agentId: 'hudson',
      action: 'search',
      source: 'llm',
      retries: 1
    }));
  });

  it('LLM returns non-action response 3 times, triggers fallback', async () => {
    // Mock 3 invalid responses
    const invalidResponses = [
      { rawResponse: 'The weather is nice today', valid: false, error: 'non_action' },
      { rawResponse: 'I think the agent should rest', valid: false, error: 'non_action' },
      { rawResponse: 'Error: API limit reached', valid: false, error: 'api_error' }
    ];

    const fallbackAction = {
      action: 'search', // Cautious default
      target: 'current_zone',
      confidence: 0.5,
      reasoning: 'Fallback: default cautious action due to 3 LLM failures',
      source: 'fallback'
    };

    mockGenerateAgentAction.mockResolvedValueOnce(invalidResponses[0]);
    mockGenerateAgentAction.mockResolvedValueOnce(invalidResponses[1]);
    mockGenerateAgentAction.mockResolvedValueOnce(invalidResponses[2]);
    mockFallbackAgentAction.mockResolvedValueOnce(fallbackAction);

    const result = await generateAgentAction(mockAgent, mockPrompt);

    expect(result).toEqual(expect.objectContaining({
      action: 'search',
      target: 'current_zone',
      valid: true,
      retries: 3,
      fallback: true,
      fallbackReason: 'max_llm_retries_exceeded'
    }));
    
    expect(mockGenerateAgentAction).toHaveBeenCalledTimes(3);
    expect(mockFallbackAgentAction).toHaveBeenCalledTimes(1);
    expect(mockFallbackAgentAction).toHaveBeenCalledWith(mockAgent, {
      errorCount: 3,
      lastError: 'api_error',
      agentType: 'aggressive'
    });
    
    // Multiple error events + fallback action
    const events = get(eventStore);
    expect(events).toHaveLength(4); // 3 errors + 1 fallback
    expect(events.slice(0, 3).every((e: any) => e.type === 'llmError')).toBe(true);
    expect(events[3]).toEqual(expect.objectContaining({
      type: 'agentAction',
      agentId: 'hudson',
      action: 'search',
      source: 'fallback',
      fallbackReason: 'max_llm_retries_exceeded'
    }));
    
    // Warning message to commander
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('AI failure') || expect(messages[0].content).toContain('fallback activated');
    expect(messages[0].type).toBe('system_warning');
  });

  it('fallback selects safe action for cautious agent after LLM failures', async () => {
    // Change agent to cautious
    mockAgent.type = 'cautious';
    mockAgent.compliance = 0.9;
    
    const fallbackAction = {
      action: 'takeCover',
      target: null,
      confidence: 0.9,
      reasoning: 'Cautious fallback: taking cover after LLM failures',
      source: 'fallback'
    };

    // 3 LLM failures
    mockGenerateAgentAction
      .mockResolvedValueOnce({ valid: false, error: 'invalid_json' })
      .mockResolvedValueOnce({ valid: false, error: 'non_action' })
      .mockResolvedValueOnce({ valid: false, error: 'timeout' });
    mockFallbackAgentAction.mockResolvedValueOnce(fallbackAction);

    const result = await generateAgentAction(mockAgent, mockPrompt);

    expect(result).toEqual(expect.objectContaining({
      action: 'takeCover',
      valid: true,
      fallback: true,
      agentType: 'cautious',
      safetyPriority: true
    }));
    
    expect(mockFallbackAgentAction).toHaveBeenCalledWith(mockAgent, expect.objectContaining({
      agentType: 'cautious',
      errorCount: 3
    }));
    
    // No risky actions in fallback for cautious
    expect(result.action).not.toBe('attack');
    expect(result.action).not.toBe('move'); // Unless to safe zone
    
    // Event shows safety priority
    const events = get(eventStore);
    expect(events[3]).toEqual(expect.objectContaining({
      type: 'agentAction',
      source: 'fallback',
      safetyPriority: true,
      riskLevel: 'low'
    }));
  });

  it('fallback selects aggressive action for aggressive agent after LLM failures', async () => {
    // Ensure aggressive agent
    mockAgent.type = 'aggressive';
    mockAgent.compliance = 0.7;
    
    const fallbackAction = {
      action: 'search',
      target: 'adjacent_zone',
      confidence: 0.6,
      reasoning: 'Aggressive fallback: proactive search after LLM failures',
      source: 'fallback'
    };

    // 3 LLM failures
    mockGenerateAgentAction
      .mockResolvedValueOnce({ valid: false, error: 'invalid_json' })
      .mockResolvedValueOnce({ valid: false, error: 'non_action' })
      .mockResolvedValueOnce({ valid: false, error: 'api_error' });
    mockFallbackAgentAction.mockResolvedValueOnce(fallbackAction);

    const result = await generateAgentAction(mockAgent, mockPrompt);

    expect(result).toEqual(expect.objectContaining({
      action: 'search',
      valid: true,
      fallback: true,
      agentType: 'aggressive',
      riskTolerance: 'high'
    }));
    
    // Aggressive fallback prefers proactive actions
    expect(result.action).toBe('search'); // Or attack if target available
    expect(result.action).not.toBe('takeCover'); // Avoid passive for aggressive
    
    const events = get(eventStore);
    expect(events[3]).toEqual(expect.objectContaining({
      type: 'agentAction',
      source: 'fallback',
      riskTolerance: 'high',
      agentType: 'aggressive'
    }));
  });

  it('LLM timeout triggers immediate fallback without full retries', async () => {
    // Mock timeout error on first try
    const timeoutError = { valid: false, error: 'timeout', duration: 10000 };
    const fallbackAction = {
      action: 'report',
      target: null,
      confidence: 0.4,
      reasoning: 'Immediate fallback: LLM timeout detected',
      source: 'fallback'
    };

    mockGenerateAgentAction.mockResolvedValueOnce(timeoutError);
    mockFallbackAgentAction.mockResolvedValueOnce(fallbackAction);

    const result = await generateAgentAction(mockAgent, mockPrompt);

    expect(result).toEqual(expect.objectContaining({
      action: 'report',
      valid: true,
      fallback: true,
      retries: 0, // No retries for timeout
      immediateFallback: true,
      errorType: 'timeout'
    }));
    
    expect(mockGenerateAgentAction).toHaveBeenCalledTimes(1); // Only once
    expect(mockFallbackAgentAction).toHaveBeenCalledTimes(1);
    expect(mockFallbackAgentAction).toHaveBeenCalledWith(mockAgent, expect.objectContaining({
      errorType: 'timeout',
      immediate: true
    }));
    
    // Timeout event logged
    const events = get(eventStore);
    expect(events).toHaveLength(2); // Timeout + fallback
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'llmError',
      error: 'timeout',
      duration: 10000,
      immediateFallback: true
    }));
  });

  it('fallback prevents game crash and logs comprehensive error details', async () => {
    // Setup critical failure scenario
    mockAgent.health = 3; // Low health - risky situation
    
    // Multiple failure types
    const failures = [
      { valid: false, error: 'invalid_json', details: 'Missing action field' },
      { valid: false, error: 'schema_validation', details: 'Action not in enum' },
      { valid: false, error: 'api_error', details: 'Rate limit exceeded' }
    ];

    const safeFallback = {
      action: 'takeCover',
      target: null,
      confidence: 0.3,
      reasoning: 'Emergency fallback: multiple LLM failures in critical situation',
      source: 'fallback',
      emergency: true
    };

    mockGenerateAgentAction.mockResolvedValueOnce(failures[0]);
    mockGenerateAgentAction.mockResolvedValueOnce(failures[1]);
    mockGenerateAgentAction.mockResolvedValueOnce(failures[2]);
    mockFallbackAgentAction.mockResolvedValueOnce(safeFallback);

    // Simulate in low health scenario
    const result = await generateAgentAction(mockAgent, { ...mockPrompt, critical: true });

    expect(result).toEqual(expect.objectContaining({
      action: 'takeCover', // Safe action for low health
      valid: true,
      fallback: true,
      emergency: true,
      failureCount: 3,
      agentHealth: 3
    }));
    
    // Comprehensive logging
    const events = get(eventStore);
    expect(events).toHaveLength(4); // 3 failures + 1 fallback
    
    // Each failure logged with details
    expect(events[0]).toEqual(expect.objectContaining({
      type: 'llmError',
      error: 'invalid_json',
      details: 'Missing action field',
      agentHealth: 3,
      critical: true
    }));
    
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'llmError',
      error: 'schema_validation',
      details: 'Action not in enum'
    }));
    
    expect(events[2]).toEqual(expect.objectContaining({
      type: 'llmError',
      error: 'api_error',
      details: 'Rate limit exceeded'
    }));
    
    // Emergency fallback logged prominently
    expect(events[3]).toEqual(expect.objectContaining({
      type: 'agentAction',
      source: 'fallback',
      emergency: true,
      priority: 'critical',
      healthWarning: true
    }));
    
    // System messages for monitoring
    const messages = get(messageStore);
    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe('system_warning');
    expect(messages[0].content).toContain('EMERGENCY FALLBACK');
    expect(messages[1].content).toContain('Hudson health critical');
  });

  it('fallback action updates world state safely without breaking immutability', async () => {
    // Setup world state for immutability test
    const initialWorld = { ...mockWorld };
    const initialAgent = { ...mockAgent };
    
    // 3 LLM failures trigger fallback
    mockGenerateAgentAction
      .mockResolvedValueOnce({ valid: false, error: 'invalid_json' })
      .mockResolvedValueOnce({ valid: false, error: 'non_action' })
      .mockResolvedValueOnce({ valid: false, error: 'parse_error' });
    
    const fallbackAction = {
      action: 'report',
      target: null,
      confidence: 0.5,
      reasoning: 'Safe fallback report',
      source: 'fallback'
    };
    mockFallbackAgentAction.mockResolvedValueOnce(fallbackAction);

    const result = await generateAgentAction(mockAgent, mockPrompt);

    // World updated through events (immutable)
    const finalWorld = get(worldStore);
    const events = get(eventStore);
    
    expect(finalWorld).not.toBe(initialWorld); // New world object
    expect(finalWorld.agents[0]).not.toBe(initialAgent); // New agent object
    
    // Originals unchanged
    expect(initialWorld.turn).toBe(5);
    expect(initialAgent.health).toBe(10);
    
    // Events maintain history
    expect(events).toHaveLength(4); // 3 errors + 1 action
    expect(events[3]).toEqual(expect.objectContaining({
      type: 'agentAction',
      agentId: 'hudson',
      action: 'report',
      source: 'fallback',
      immutable: true
    }));
    
    // World state reflects action safely
    expect(finalWorld.turn).toBe(6); // Turn advanced
    expect(finalWorld.agents[0].lastAction).toBe('report');
    expect(finalWorld.agents[0].health).toBe(10); // No health change for report
    
    // Message added to stream
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: 'report',
      sender: 'Hudson',
      content: expect.stringContaining('status report') || expect.stringContaining('fallback action'),
      fallback: true
    }));
  });

  it('fallback respects agent personality and situation context', async () => {
    // Test different agent types and contexts
    
    const testCases = [
      {
        agentType: 'cautious',
        situation: 'low_health',
        expectedAction: 'takeCover',
        expectedReasoning: 'Cautious agent, low health: prioritize safety'
      },
      {
        agentType: 'aggressive', 
        situation: 'alien_nearby',
        expectedAction: 'attack',
        expectedReasoning: 'Aggressive agent, alien threat: engage combat'
      },
      {
        agentType: 'balanced',
        situation: 'vial_nearby',
        expectedAction: 'interact',
        expectedReasoning: 'Balanced agent, objective nearby: secure vial'
      }
    ];

    for (const testCase of testCases) {
      // Setup agent for this test case
      const testAgent = { ...mockAgent, type: testCase.agentType };
      if (testCase.situation === 'low_health') testAgent.health = 2;
      if (testCase.situation === 'alien_nearby') mockWorld.alien.position = mockAgent.position;
      if (testCase.situation === 'vial_nearby') mockWorld.zones[mockAgent.position].items.push({ id: 'vial' } as any);
      
      // 3 LLM failures
      mockGenerateAgentAction
        .mockResolvedValueOnce({ valid: false, error: 'invalid_json' })
        .mockResolvedValueOnce({ valid: false, error: 'non_action' })
        .mockResolvedValueOnce({ valid: false, error: 'api_error' });
      
      const expectedFallback = {
        action: testCase.expectedAction,
        confidence: expect.any(Number),
        reasoning: testCase.expectedReasoning,
        source: 'fallback',
        contextAware: true
      };
      mockFallbackAgentAction.mockResolvedValueOnce(expectedFallback);

      const result = await generateAgentAction(testAgent, mockPrompt);

      expect(result).toEqual(expect.objectContaining({
        action: testCase.expectedAction,
        reasoning: testCase.expectedReasoning,
        contextAware: true,
        agentType: testCase.agentType
      }));
      
      // Verify fallback called with correct context
      expect(mockFallbackAgentAction).toHaveBeenCalledWith(testAgent, expect.objectContaining({
        agentType: testCase.agentType,
        situation: testCase.situation,
        health: testAgent.health,
        nearbyThreats: testCase.situation === 'alien_nearby',
        objectivesNearby: testCase.situation === 'vial_nearby'
      }));
    }
  });

  it('system monitors fallback frequency and adjusts retry limits dynamically', async () => {
    // Setup high fallback frequency scenario
    const highFallbackAgent = { ...mockAgent, id: 'frequent_fallback' };
    
    // Mock system state with high fallback rate
    const systemState = {
      fallbackRate: 0.4, // 40% fallback rate recently
      consecutiveFailures: 8,
      lastSuccessTurn: 2,
      adjustmentActive: true
    };
    
    // Normally 3 retries, but reduce to 1 due to high failure rate
    const reducedRetryFallback = {
      action: 'report',
      target: null,
      confidence: 0.2,
      reasoning: 'Reduced retry fallback: high system failure rate detected',
      source: 'fallback',
      retryLimit: 1 // Reduced from 3
    };

    // First call fails, triggers immediate fallback due to system state
    mockGenerateAgentAction.mockResolvedValueOnce({ valid: false, error: 'invalid_json' });
    mockFallbackAgentAction.mockResolvedValueOnce(reducedRetryFallback);

    const result = await generateAgentAction(highFallbackAgent, { ...mockPrompt, systemState });

    expect(result).toEqual(expect.objectContaining({
      action: 'report',
      fallback: true,
      retries: 0, // Immediate fallback
      systemAdjustment: true,
      reducedRetryLimit: true,
      fallbackRate: 0.4
    }));
    
    expect(mockGenerateAgentAction).toHaveBeenCalledTimes(1); // Only 1 attempt
    expect(mockFallbackAgentAction).toHaveBeenCalledWith(highFallbackAgent, expect.objectContaining({
      systemState,
      adjustmentActive: true,
      reducedRetries: true
    }));
    
    // System event logged
    const events = get(eventStore);
    expect(events).toHaveLength(2); // LLM error + system adjusted fallback
    expect(events[1]).toEqual(expect.objectContaining({
      type: 'agentAction',
      source: 'fallback',
      systemAdjustment: true,
      fallbackRate: 0.4,
      retryLimit: 1
    }));
    
    // Monitoring message
    const messages = get(messageStore);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('SYSTEM ADJUSTMENT') || expect(messages[0].content).toContain('reduced retries');
    expect(messages[0].type).toBe('system_monitoring');
    expect(messages[0].priority).toBe('high');
  });
});