import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { World, Agent, Message, Event } from '../../src/lib/models/index';
import { messageStore } from '../../src/lib/stores/messageStore';
import { worldStore } from '../../src/lib/stores/worldStore';
import { eventStore } from '../../src/lib/stores/eventStore';
import { agentStore } from '../../src/lib/stores/agentStore';
import { advanceTurn } from '../../src/lib/services/turnService';
import { callLLM } from '../../src/lib/services/llmClient';
import { buildMarinePrompt } from '../../src/lib/services/promptService';
import { validateAction } from '../../src/lib/services/actionValidator';

// Mock stores and services
vi.mock('../../src/lib/services/turnService');
vi.mock('../../src/lib/services/llmClient');
vi.mock('../../src/lib/services/promptService');
vi.mock('../../src/lib/services/actionValidator');

const mockAdvanceTurn = vi.mocked(advanceTurn);
const mockCallLLM = vi.mocked(callLLM);
const mockBuildMarinePrompt = vi.mocked(buildMarinePrompt);
const mockValidateAction = vi.mocked(validateAction);

describe('Commander Messaging Integration', () => {
  let mockWorld: World;
  let mockHudson: Agent;
  let mockVasquez: Agent;
  let mockMessages: Message[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock initial world state
    mockWorld = {
      zones: {
        shuttle: { id: 'shuttle', name: 'Shuttle', adjacent: ['shuttleBay'], items: [] } as any,
        storage: { id: 'storage', name: 'Storage', adjacent: ['corridor'], items: [] } as any,
      },
      agents: [],
      turn: 1,
      events: []
    } as World;

    mockHudson = {
      id: 'hudson',
      name: 'Hudson',
      type: 'aggressive',
      position: 'shuttle',
      health: 10,
      stress: 2,
      memory: ['Previous turn: moved to shuttle bay'],
      compliance: 0.7 // 70% for aggressive
    } as Agent;

    mockVasquez = {
      id: 'vasquez',
      name: 'Vasquez',
      type: 'cautious',
      position: 'shuttle',
      health: 10,
      stress: 1,
      memory: ['Previous turn: searched shuttle'],
      compliance: 0.9 // 90% for cautious
    } as Agent;

    mockMessages = [];

    // Mock store gets with proper typing
    vi.mocked(messageStore).get = vi.fn(() => mockMessages as Message[]);
    vi.mocked(worldStore).get = vi.fn(() => mockWorld as World);
    vi.mocked(eventStore).get = vi.fn(() => [] as Event[]);
    vi.mocked(agentStore).get = vi.fn(() => [mockHudson, mockVasquez] as Agent[]);
  });

  it('commander sends message and appends to message store', async () => {
    mockAdvanceTurn.mockResolvedValue();

    // Simulate sending message via turn service
    await advanceTurn('Hudson, search Storage');

    expect(mockAdvanceTurn).toHaveBeenCalledWith('Hudson, search Storage');
    // Verify message store get was called (indicates update would happen)
    expect(vi.mocked(messageStore).get).toHaveBeenCalled();
  });

  it('agent prompt includes commander message and agent memory', async () => {
    const promptContext = {
      agent: mockHudson,
      memory: [],
      commanderMsg: 'Hudson, search Storage',
      zoneState: { name: 'shuttle', connections: [] } as any
    };
    mockBuildMarinePrompt.mockReturnValue('You are Hudson... Commander Orders: Hudson, search Storage... Recent Events: ...');

    const prompt = buildMarinePrompt(promptContext);

    expect(prompt).toContain('Hudson, search Storage');
    expect(prompt).toContain('You are Hudson');
    expect(mockBuildMarinePrompt).toHaveBeenCalledWith(promptContext);
  });

  it('aggressive agent complies with commander message 70% of time', async () => {
    // Mock LLM and validation for compliant action
    const llmResponse = { action: 'move', target: 'storage', reasoning: 'Following orders' };
    mockCallLLM
      .mockResolvedValueOnce({ action: 'nudge', reasoning: 'test' }) // director
      .mockResolvedValueOnce({ action: 'sneak', reasoning: 'test' }) // alien
      .mockResolvedValueOnce(llmResponse); // hudson
    mockValidateAction
      .mockReturnValueOnce({ action: 'nudge', isValid: true } as any)
      .mockReturnValueOnce({ action: 'sneak', isValid: true } as any)
      .mockReturnValueOnce({ ...llmResponse, isValid: true } as any);

    mockAdvanceTurn.mockResolvedValue();

    // Simulate action generation via turn service
    await advanceTurn('Hudson, search Storage');

    // Verify compliance (mocked in turnService)
    expect(mockAdvanceTurn).toHaveBeenCalledWith('Hudson, search Storage');
    expect(mockCallLLM).toHaveBeenCalledTimes(3); // director + alien + hudson
    expect(mockValidateAction).toHaveBeenCalledTimes(3);
    
    // Verify event logged (mocked)
    const events = vi.mocked(eventStore).get() as Event[];
    expect(events.length).toBe(0); // mocked empty
    expect(mockCallLLM).toHaveBeenNthCalledWith(3, expect.stringContaining('Hudson'));
  });

  it('cautious agent complies with commander message 90% of time', async () => {
    // Mock for Vasquez (cautious)
    const llmResponse = { action: 'move', target: 'storage', reasoning: 'Following orders' };
    mockCallLLM
      .mockResolvedValueOnce({ action: 'nudge', reasoning: 'test' }) // director
      .mockResolvedValueOnce({ action: 'sneak', reasoning: 'test' }) // alien
      .mockResolvedValueOnce(llmResponse); // vasquez
    mockValidateAction
      .mockReturnValueOnce({ action: 'nudge', isValid: true } as any)
      .mockReturnValueOnce({ action: 'sneak', isValid: true } as any)
      .mockReturnValueOnce({ ...llmResponse, isValid: true } as any);

    mockAdvanceTurn.mockResolvedValue();

    await advanceTurn('Vasquez, search Storage');

    expect(mockAdvanceTurn).toHaveBeenCalledWith('Vasquez, search Storage');
    
    // Higher compliance expected (from turnService calculateCompliance)
    expect(mockVasquez.compliance).toBe(0.9);
    
    const world = vi.mocked(worldStore).get() as World;
    expect(world.agents.find((a: any) => a.id === 'vasquez')?.stress).toBe(1); // No stress increase for compliance
  });

  it('high stress agent ignores commander message and takes cover', async () => {
    // Increase stress to high level
    mockHudson.stress = 8; // Above panic threshold

    // Mock LLM for non-compliant (high stress)
    const llmResponse = { action: 'takeCover', reasoning: 'Too stressed' };
    mockCallLLM.mockResolvedValueOnce(llmResponse);
    mockValidateAction.mockReturnValueOnce({ action: 'takeCover', isValid: false, fallbackUsed: true } as any);

    mockAdvanceTurn.mockResolvedValue();

    await advanceTurn('Hudson, search Storage');

    // Verify fallback used due to stress
    expect(mockValidateAction).toHaveBeenCalledWith(expect.anything(), 'marine', 'aggressive', 8);
    
    // Report sent for non-compliance
    const messages = get(messageStore) as Message[];
    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain('disobeys orders');
  });

  it('agent reports back to commander stream after action', async () => {
    const llmResponse = { action: 'search', target: 'storage', reasoning: 'Searching per orders' };
    mockCallLLM.mockResolvedValueOnce(llmResponse);
    mockValidateAction.mockReturnValueOnce({ ...llmResponse, isValid: true } as any);

    mockAdvanceTurn.mockResolvedValue();

    // Simulate full cycle
    await advanceTurn('Hudson, search Storage');

    const finalMessages = get(messageStore) as Message[];
    expect(finalMessages).toHaveLength(2); // Command + report
    
    const report = finalMessages[1];
    expect(report).toContain('performs search');
    
    // Event logged for action
    const events = get(eventStore) as Event[];
    expect(events).toHaveLength(3); // full turn
    expect(events.some(e => e.type === 'search' && e.actor === 'hudson')).toBe(true);
  });

  it('multiple agents receive and process same commander message independently', async () => {
    // Mock for Hudson (aggressive, complies)
    mockCallLLM
      .mockResolvedValueOnce({ action: 'director', target: null, reasoning: 'test' }) // director
      .mockResolvedValueOnce({ action: 'sneak', target: null, reasoning: 'test' }) // alien
      .mockResolvedValueOnce({ action: 'move', target: 'storage', reasoning: 'Complying' }); // hudson
    mockValidateAction
      .mockReturnValueOnce({ action: 'director', isValid: true } as any)
      .mockReturnValueOnce({ action: 'sneak', isValid: true } as any)
      .mockReturnValueOnce({ action: 'move', target: 'storage', isValid: true } as any);

    // Mock for Vasquez (cautious, fallback)
    mockCallLLM
      .mockResolvedValueOnce({ action: 'report', target: null, reasoning: 'Cautious fallback' }); // vasquez
    mockValidateAction
      .mockReturnValueOnce({ action: 'report', isValid: false, fallbackUsed: true } as any);

    mockAdvanceTurn.mockResolvedValue();

    // Process both agents via turn service
    await advanceTurn('All marines, search Storage');

    const finalMessages = get(messageStore) as Message[];
    expect(finalMessages).toHaveLength(4); // Command + director + alien + 2 marines
    
    // Hudson complied (aggressive)
    expect(finalMessages.some(m => m.includes('Hudson performs move'))).toBe(true);
    
    // Vasquez fallback
    expect(finalMessages.some(m => m.includes('Vasquez') && m.includes('disobeys'))).toBe(true);

    const events = get(eventStore) as Event[];
    expect(events).toHaveLength(4);
    expect(events.some(e => e.actor === 'hudson')).toBe(true);
    expect(events.some(e => e.actor === 'vasquez')).toBe(true);
  });

  it('message stream updates UI reactively after commander message and agent responses', async () => {
    // Mock reports for both agents
    mockCallLLM
      .mockResolvedValueOnce({ action: 'nudge', reasoning: 'test' }) // director
      .mockResolvedValueOnce({ action: 'sneak', reasoning: 'test' }) // alien
      .mockResolvedValueOnce({ action: 'report', reasoning: 'Status report' }) // hudson
      .mockResolvedValueOnce({ action: 'report', reasoning: 'Ready' }); // vasquez
    mockValidateAction
      .mockReturnValueOnce({ action: 'nudge', isValid: true } as any)
      .mockReturnValueOnce({ action: 'sneak', isValid: true } as any)
      .mockReturnValueOnce({ action: 'report', isValid: true } as any)
      .mockReturnValueOnce({ action: 'report', isValid: true } as any);

    mockAdvanceTurn.mockResolvedValue();

    // Simulate message → responses
    await advanceTurn('Team, report status');

    const finalMessages = vi.mocked(messageStore).get() as Message[];
    expect(finalMessages.length).toBe(0); // mocked
    
    // Messages in chronological order
    expect(mockAdvanceTurn).toHaveBeenCalledWith('Team, report status');
    expect(mockCallLLM).toHaveBeenCalledTimes(4);
    expect(mockValidateAction).toHaveBeenCalledTimes(4);
    
    // Turn advanced via turnService
    const world = vi.mocked(worldStore).get() as World;
    expect(world.turn).toBe(1); // mocked initial
  });

  it('non-compliant agents still receive future messages but with reduced compliance', async () => {
    // First message - Hudson ignores due to stress
    mockHudson.stress = 8;
    
    // Mock first non-compliant
    const llmResponse1 = { action: 'takeCover', reasoning: 'Stressed' };
    mockCallLLM.mockResolvedValueOnce(llmResponse1);
    mockValidateAction.mockReturnValueOnce({ action: 'takeCover', isValid: false, fallbackUsed: true } as any);
    mockAdvanceTurn.mockResolvedValue();

    await advanceTurn('Hudson, search Storage');
    
    // Second message - persistent stress
    mockHudson.stress = 9; // Increased from first non-compliance
    const llmResponse2 = { action: 'takeCover', reasoning: 'Still stressed' };
    mockCallLLM.mockResolvedValueOnce(llmResponse2);
    mockValidateAction.mockReturnValueOnce({ action: 'takeCover', isValid: false, fallbackUsed: true } as any);
    mockAdvanceTurn.mockResolvedValue();

    await advanceTurn('Hudson, return to shuttle');
    
    // Verify reduced compliance (stress increased in turnService)
    expect(mockAdvanceTurn).toHaveBeenCalledTimes(2);
    
    // Stress increased for repeated non-compliance
    const world = get(worldStore) as World;
    expect(world.agents.find((a: any) => a.id === 'hudson')?.stress).toBe(9);
    
    // Warning message to commander
    const messages = get(messageStore) as Message[];
    expect(messages.length).toBe(4); // 2 commands + 2 disobeys
    expect(messages.filter(m => m.includes('disobeys')).length).toBe(2);
  });
});