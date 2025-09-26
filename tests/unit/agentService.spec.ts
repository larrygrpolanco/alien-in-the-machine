import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAgentAction, executeAgentTurn } from '../../src/lib/services/agentService';
import type { ValidatedAction } from '../../src/lib/services/actionValidator';
import type { Agent, Zone } from '../../src/lib/models/entities';
import type { Event } from '../../src/lib/models/eventSchema';
import type { LLMResponse } from '../../src/lib/services/llmClient';

const mockAlienAgent: Agent = {
  position: 'Storage',
  hidden: true
};

const mockMarineAgent: Agent = {
  id: 'hudson',
  personality: 'aggressive',
  compliance: 0.7,
  position: 'Shuttle',
  health: 10,
  stress: 2,
  inventory: []
};

const mockDirectorAgent: Agent = {
  adjustments: []
};

const mockMemory: Event[] = [];
const mockCommanderMsg = 'Investigate the shuttle';
const mockZoneState: Zone = { name: 'Storage', items: {} } as Zone;

let mockApplyEvent = vi.fn();

describe('agentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyEvent = vi.fn();
    
    // Mock Math.random for weighted selection
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // Mock dependencies using vi.mock
    vi.mock('../../src/lib/services/promptService', () => ({
      assemblePrompt: vi.fn().mockReturnValue('mock prompt')
    }));
    
    vi.mock('../../src/lib/services/llmClient', () => ({
      callLLM: vi.fn().mockResolvedValue({ action: 'search', reasoning: 'mock llm response' })
    }));
    
    vi.mock('../../src/lib/services/actionValidator', () => ({
      validateAction: vi.fn().mockReturnValue({
        action: 'search',
        reasoning: 'validated',
        isValid: true,
        retryCount: 0,
        fallbackUsed: false
      } as ValidatedAction)
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateAgentAction', () => {
    it('should apply weighted mock override for alien when LLM returns invalid action', async () => {
      // Mock LLM to return marine-only action (triggers override)
      const { callLLM } = await import('../../src/lib/services/llmClient');
      vi.mocked(callLLM).mockResolvedValueOnce({ action: 'move', reasoning: 'invalid for alien' });
      
      // Mock random to select 'sneak' (index 0, 1, or 2 out of 9 weighted actions)
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const action = await generateAgentAction(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState);
      
      expect(action.action).toBe('sneak');
      expect(action.reasoning).toContain('Mock LLM adjusted');
      expect(action.reasoning).toContain('original: move');
      expect(callLLM).toHaveBeenCalledTimes(1);
    });

    it('should disable mocks in production environment (useMOCKS=false)', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Mock LLM to return invalid action - should NOT be overridden in production
      const { callLLM } = await import('../../src/lib/services/llmClient');
      vi.mocked(callLLM).mockResolvedValueOnce({ action: 'move', reasoning: 'invalid for alien - no override expected' });
      
      const action = await generateAgentAction(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState);
      
      // Should pass through invalid action to validation (no mock override)
      expect(action.action).toBe('move');
      expect(action.reasoning).not.toContain('Mock LLM adjusted');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should generate only valid actions from weighted selection for alien', async () => {
      // Test multiple runs to verify only valid ALIEN_ACTIONS are generated
      const validAlienActions = ['sneak', 'stalk', 'ambush', 'hide', 'hunt', 'lurk'];
      const results: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        vi.spyOn(Math, 'random').mockReturnValueOnce(i / 10.0);
        const { callLLM } = await import('../../src/lib/services/llmClient');
        vi.mocked(callLLM).mockResolvedValueOnce({ action: 'invalid' + i, reasoning: 'force override' });
        
        const action = await generateAgentAction(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState);
        results.push(action.action);
      }
      
      // All results should be valid alien actions
      results.forEach(action => {
        expect(validAlienActions).toContain(action);
      });
      
      // Should see weighted distribution (more sneak/hide than lurk/hunt)
      const stealthCount = results.filter(a => a === 'sneak' || a === 'hide').length;
      expect(stealthCount).toBeGreaterThanOrEqual(5); // At least 50% stealth actions
    });

    it('should handle message fallback for director when message is invalid', async () => {
      // Mock DIRECTOR_ACTIONS to exclude 'message' (force fallback)
      const originalDirectorActions = require('../../src/lib/services/actionValidator').DIRECTOR_ACTIONS;
      vi.doMock('../../src/lib/services/actionValidator', () => ({
        ...require('../../src/lib/services/actionValidator'),
        DIRECTOR_ACTIONS: new Set(['nudge', 'escalate', 'reveal']) // No 'message'
      }));
      
      // Mock LLM to return 'message'
      const { callLLM } = await import('../../src/lib/services/llmClient');
      vi.mocked(callLLM).mockResolvedValueOnce({ action: 'message', reasoning: 'director message' });
      
      // Mock random to select fallback
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      
      const action = await generateAgentAction(mockDirectorAgent, mockMemory, mockCommanderMsg, mockZoneState);
      
      expect(action.action).toBe('nudge'); // Fallback from message
      expect(action.reasoning).toContain('Mock LLM adjusted');
      expect(action.reasoning).toContain('message fallback');
      
      // Restore original
      vi.doMock('../../src/lib/services/actionValidator', () => ({
        ...require('../../src/lib/services/actionValidator'),
        DIRECTOR_ACTIONS: originalDirectorActions
      }));
    });

    it('should not apply weighted override for marine actions', async () => {
      // Mock LLM to return something
      const { callLLM } = await import('../../src/lib/services/llmClient');
      vi.mocked(callLLM).mockResolvedValueOnce({ action: 'search', reasoning: 'marine search' });

      const action = await generateAgentAction(mockMarineAgent, mockMemory, mockCommanderMsg, mockZoneState);
      
      expect(action.action).toBe('search');
      expect(action.reasoning).toContain('validated');
      // No override applied for marines
    });

    it('should apply weighted actions for director preferring narrative actions', async () => {
      // Mock LLM to return invalid action for director
      const { callLLM } = await import('../../src/lib/services/llmClient');
      vi.mocked(callLLM).mockResolvedValueOnce({ action: 'move', reasoning: 'invalid for director' });
      
      // Mock random to select 'message' (indices 0-3 out of 8)
      vi.spyOn(Math, 'random').mockReturnValue(0.2);

      const action = await generateAgentAction(mockDirectorAgent, mockMemory, mockCommanderMsg, mockZoneState);
      
      expect(action.action).toBe('message');
      expect(action.reasoning).toContain('Mock LLM adjusted');
      expect(action.reasoning).toContain('original: move');
    });

    it('should apply enhanced fallback after validation failure', async () => {
      // Mock validation to fail completely
      const { validateAction } = await import('../../src/lib/services/actionValidator');
      vi.mocked(validateAction).mockReturnValueOnce({
        action: 'completely_invalid',
        reasoning: 'validation failed',
        isValid: false,
        retryCount: 3,
        fallbackUsed: false
      } as ValidatedAction);

      // Mock random for fallback selection
      vi.spyOn(Math, 'random').mockReturnValue(0.7);

      const action = await generateAgentAction(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState);
      
      // Should be a random valid alien action
      const validAlienActions = ['sneak', 'ambush', 'hazard', 'nudge', 'hunt', 'lurk', 'stalk', 'hide'];
      expect(validAlienActions.includes(action.action)).toBe(true);
      expect(action.isValid).toBe(true);
      expect(action.fallbackUsed).toBe(true);
      expect(action.reasoning).toContain('Enhanced fallback after retries');
    });

    it('should handle different random values for weighted selection', async () => {
      // Test multiple random values to verify weighted distribution
      const testRandoms = [0.1, 0.4, 0.7]; // Should map to different indices
      const expectedActions = ['sneak', 'hide', 'lurk']; // Based on weighted array: 3x sneak, 3x hide, 3x lurk/hunt
      
      for (let i = 0; i < testRandoms.length; i++) {
        vi.spyOn(Math, 'random').mockReturnValueOnce(testRandoms[i]);
        const { callLLM } = await import('../../src/lib/services/llmClient');
        vi.mocked(callLLM).mockResolvedValueOnce({ action: 'invalid', reasoning: 'test' });
        
        const action = await generateAgentAction(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState);
        
        // Verify weighted selection works
        if (i === 0) expect(action.action).toBe('sneak'); // 0.1 -> index 0
        if (i === 1) expect(action.action).toBe('hide');  // 0.4 -> index 3-5
        if (i === 2) expect(action.action).toBe('lurk'); // 0.7 -> index 6
      }
    });
  });

  describe('executeAgentTurn', () => {
    it('should filter unsupported actions through internal mapping', async () => {
      // Mock LLM to return unsupported action
      const { callLLM } = await import('../../src/lib/services/llmClient');
      vi.mocked(callLLM).mockResolvedValueOnce({ action: 'pounce', reasoning: 'unsupported action' });
      
      // Mock validation to pass the remapped action
      const { validateAction } = await import('../../src/lib/services/actionValidator');
      vi.mocked(validateAction).mockReturnValueOnce({
        action: 'hunt', // Should be remapped from pounce
        reasoning: 'remapped',
        isValid: true
      } as ValidatedAction);

      await executeAgentTurn(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState, mockApplyEvent);
      
      // Should apply remapped event
      expect(mockApplyEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'hunt',
        actor: 'alien'
      }));
    });

    it('should handle supported actions without remapping', async () => {
      const { callLLM } = await import('../../src/lib/services/llmClient');
      vi.mocked(callLLM).mockResolvedValueOnce({ action: 'sneak', reasoning: 'valid stealth' });

      await executeAgentTurn(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState, mockApplyEvent);
      
      expect(mockApplyEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'sneak',
        actor: 'alien'
      }));
    });

    it('should apply fallback event on error', async () => {
      // Mock generateAgentAction to throw error
      const originalGenerate = generateAgentAction;
      vi.spyOn({ generateAgentAction }, 'generateAgentAction').mockRejectedValueOnce(new Error('test error'));
      
      await executeAgentTurn(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState, mockApplyEvent);
      
      // Should apply fallback cover event
      expect(mockApplyEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'cover',
        actor: 'alien',
        details: { reasoning: 'Fallback: Taking cover due to error' }
      }));
      
      // Restore original
      vi.spyOn({ generateAgentAction }, 'generateAgentAction').mockImplementation(originalGenerate);
    });
  });

  describe('event filtering and weighted selection', () => {
    it('should demonstrate weighted selection probabilities through multiple runs', async () => {
      const results: string[] = [];
      
      // Run multiple times with different random seeds
      for (let i = 0; i < 10; i++) {
        vi.spyOn(Math, 'random').mockReturnValueOnce(i / 10.0);
        const { callLLM } = await import('../../src/lib/services/llmClient');
        vi.mocked(callLLM).mockResolvedValueOnce({ action: 'invalid', reasoning: 'test' });
        
        const action = await generateAgentAction(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState);
        results.push(action.action);
      }
      
      // Should see distribution: mostly sneak/hide, some lurk/hunt
      const sneakCount = results.filter(a => a === 'sneak').length;
      const hideCount = results.filter(a => a === 'hide').length;
      expect(sneakCount + hideCount).toBeGreaterThan(4); // At least 40% stealth actions
    });

    it('should handle edge cases: empty inputs', async () => {
      const action = await generateAgentAction(mockAlienAgent, [], '', mockZoneState);
      
      expect(action).toBeDefined();
      expect(action.isValid).toBe(true);
      expect(action.action).toBeDefined();
    });

    it('should handle high stress marine with appropriate fallback', async () => {
      const highStressMarine = { ...mockMarineAgent, stress: 9 };
      
      // Mock validation to use stress-based fallback
      const { validateAction } = await import('../../src/lib/services/actionValidator');
      vi.mocked(validateAction).mockReturnValueOnce({
        action: 'cover',
        reasoning: 'High stress fallback to defensive action',
        isValid: true,
        fallbackUsed: true
      } as ValidatedAction);

      const action = await generateAgentAction(highStressMarine, mockMemory, mockCommanderMsg, mockZoneState);
      
      expect(action.action).toBe('cover');
      expect(action.reasoning).toContain('High stress');
    });

    it('should generate TypeScript type-safe actions', async () => {
      const action = await generateAgentAction(mockAlienAgent, mockMemory, mockCommanderMsg, mockZoneState);
      
      // Type assertion check
      const typedAction: ValidatedAction = action;
      expect(typedAction).toBeDefined();
      expect(typeof typedAction.action).toBe('string');
      expect(typeof typedAction.reasoning).toBe('string');
      expect(typedAction.isValid).toBe(true);
    });
  });
});