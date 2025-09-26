import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateAction,
  getFallbackAction,
  validateActionContext,
  validateAgentActions,
  getValidationStats,
  type ValidatedAction
} from '../../src/lib/services/actionValidator';
import type { Marine, Alien, Director } from '../../src/lib/models/entities';
import type { AgentAction } from '../../src/lib/services/llmClient';

const mockMarine: Marine = {
  id: 'hudson',
  personality: 'aggressive',
  compliance: 0.7,
  position: 'Shuttle',
  health: 10,
  stress: 2,
  inventory: []
};

const mockAlien: Alien = {
  position: 'Storage',
  hidden: true
};

const mockDirector: Director = {
  adjustments: []
};

describe('actionValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateAction', () => {
    it('should validate valid marine action JSON', () => {
      const rawAction = {
        action: 'move',
        target: 'Shuttle Bay',
        reasoning: 'Moving to explore adjacent zone per commander orders'
      };

      const result: ValidatedAction = validateAction(rawAction, 'marine', 'aggressive', 2);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('move');
      expect(result.target).toBe('Shuttle Bay');
      expect(result.reasoning).toContain('commander orders');
      expect(result.retryCount).toBe(0);
      expect(result.fallbackUsed).toBeUndefined();
    });

    it('should validate valid alien action JSON', () => {
      const rawAction = {
        action: 'sneak',
        target: 'Corridor',
        reasoning: 'Moving stealthily to stalk marines without detection'
      };

      const result: ValidatedAction = validateAction(rawAction, 'alien');

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('sneak');
      expect(result.target).toBe('Corridor');
      expect(result.reasoning).toContain('stealthily');
    });

    it('should validate valid director action JSON', () => {
      const rawAction = {
        action: 'hazard',
        reasoning: 'Creating environmental tension by locking a door to isolate marines'
      };

      const result: ValidatedAction = validateAction(rawAction, 'director');

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('hazard');
      expect(result.target).toBeUndefined();
      expect(result.reasoning).toContain('environmental tension');
    });

    it('should reject invalid action structure', () => {
      const invalidAction = {
        invalidField: 'move',
        reasoning: 'test'
      };

      const result: ValidatedAction = validateAction(invalidAction, 'marine');

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('report'); // Fallback action
      expect(result.reasoning).toContain('Validation failed - defaulting to report');
      expect(result.fallbackUsed).toBe(true);
      expect(result.retryCount).toBe(3); // Max retries
    });

    it('should reject invalid action type for marine', () => {
      const invalidAction = {
        action: 'sneak', // Alien action
        reasoning: 'Trying invalid action'
      };

      const result: ValidatedAction = validateAction(invalidAction, 'marine');

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('move'); // Fallback for aggressive marine
      expect(result.reasoning).toContain('Fallback: Aggressive/move mode');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should reject invalid action type for alien', () => {
      const invalidAction = {
        action: 'attack', // Marine action
        reasoning: 'Alien trying marine action'
      };

      const result: ValidatedAction = validateAction(invalidAction, 'alien');

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('sneak'); // Fallback for alien
      expect(result.reasoning).toContain('Fallback: Maintain stealth');
    });

    it('should reject invalid action type for director', () => {
      const invalidAction = {
        action: 'move', // Marine action
        reasoning: 'Director trying to move'
      };

      const result: ValidatedAction = validateAction(invalidAction, 'director');

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('nudge'); // Fallback for director
      expect(result.reasoning).toContain('Fallback: Subtle narrative influence');
    });

    it('should map invalid "message" action to valid fallback for director', () => {
      const messageAction = {
        action: 'message',
        reasoning: 'Director trying to communicate'
      };

      const result: ValidatedAction = validateAction(messageAction, 'director', undefined, undefined, 'Director', 1);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('nudge'); // Mapped from message
      expect(result.reasoning).toContain('Director');
    });

    it('should map invalid "message" action to "report" for marine', () => {
      const messageAction = {
        action: 'message',
        reasoning: 'Marine trying to communicate'
      };

      const result: ValidatedAction = validateAction(messageAction, 'marine', 'aggressive', 2, 'Hudson', 1);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('report'); // Mapped from message for marine
      expect(result.reasoning).toContain('Hudson');
    });

    it('should reduce retry limit to 2 for non-critical failures', () => {
      const invalidAction = { action: 'invalid', reasoning: 'test' };
      
      const result: ValidatedAction = validateAction(invalidAction, 'marine', 'aggressive', 2, 'Hudson', 1, 2);

      expect(result.retryCount).toBe(2); // Max retries reached
      expect(result.fallbackUsed).toBe(true);
      expect(result.reasoning).toContain('Hudson');
    });

    it('should handle string JSON input', () => {
      const jsonString = JSON.stringify({
        action: 'search',
        target: 'console',
        reasoning: 'Searching for mission-critical information'
      });

      const result: ValidatedAction = validateAction(jsonString, 'marine');

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('search');
      expect(result.target).toBe('console');
    });

    it('should handle missing target for actions that require it', () => {
      const missingTarget = {
        action: 'move',
        reasoning: 'Moving but no target specified'
      };

      const result: ValidatedAction = validateAction(missingTarget, 'marine');

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('move'); // Fallback keeps action type
      expect(result.reasoning).toContain('Fallback: Aggressive/move mode');
    });

    it('should handle null target correctly', () => {
      const nullTarget = {
        action: 'search',
        target: null,
        reasoning: 'Searching current zone'
      };

      const result: ValidatedAction = validateAction(nullTarget, 'marine');

      expect(result.isValid).toBe(true);
      expect(result.target).toBeUndefined(); // Normalized to undefined
      expect(result.action).toBe('search');
    });

    it('should normalize action names to lowercase', () => {
      const mixedCaseAction = {
        action: 'SEARCH',
        reasoning: 'Uppercase action test'
      };

      const result: ValidatedAction = validateAction(mixedCaseAction, 'marine');

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('search'); // Normalized to lowercase
    });

    it('should trim whitespace from action names', () => {
      const whitespaceAction = {
        action: ' report ',
        reasoning: 'Action with extra spaces'
      };

      const result: ValidatedAction = validateAction(whitespaceAction, 'marine');

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('report'); // Trimmed
    });

    it('should use fallback after maximum retries', () => {
      // Mock multiple invalid attempts
      const firstInvalid = { action: 'invalid1', reasoning: 'first' };
      const secondInvalid = { action: 'invalid2', reasoning: 'second' };
      
      // Since validateAction handles retries internally, test with maxRetries=1
      const result: ValidatedAction = validateAction(firstInvalid, 'marine', 'aggressive', 2, 'hudson', undefined, 1);

      expect(result.isValid).toBe(false);
      expect(result.retryCount).toBe(1);
      expect(result.fallbackUsed).toBe(true);
      expect(result.action).toBe('move'); // Fallback for aggressive marine
    });

    it('should apply personality-based fallbacks for marines', () => {
      // Cautious marine fallback
      const cautiousResult: ValidatedAction = validateAction(
        { action: 'invalid', reasoning: 'test' },
        'marine',
        'cautious',
        3
      );
      expect(cautiousResult.action).toBe('search');
      expect(cautiousResult.reasoning).toContain('Cautious/search mode');

      // Aggressive marine fallback
      const aggressiveResult: ValidatedAction = validateAction(
        { action: 'invalid', reasoning: 'test' },
        'marine',
        'aggressive',
        1
      );
      expect(aggressiveResult.action).toBe('move');
      expect(aggressiveResult.reasoning).toContain('Aggressive/move mode');

      // High stress fallback (cautious behavior)
      const highStressResult: ValidatedAction = validateAction(
        { action: 'invalid', reasoning: 'test' },
        'marine',
        undefined,
        8
      );
      expect(highStressResult.action).toBe('search');
      expect(highStressResult.reasoning).toContain('high stress');
    });

    it('should validate action context for marine move', () => {
      const validMoveAction: ValidatedAction = {
        action: 'move',
        target: 'Shuttle Bay',
        reasoning: 'Valid move',
        isValid: true,
        retryCount: 0
      };

      const availableTargets = ['Shuttle Bay', 'Storage'];
      
      expect(validateActionContext(validMoveAction, 'marine', 'Shuttle', availableTargets)).toBe(true);

      // Invalid target
      const invalidMoveAction: ValidatedAction = {
        ...validMoveAction,
        target: 'Medbay'
      };

      expect(validateActionContext(invalidMoveAction, 'marine', 'Shuttle', availableTargets)).toBe(false);
    });

    it('should validate action context for marine interact', () => {
      const validInteractAction: ValidatedAction = {
        action: 'interact',
        target: 'vial',
        reasoning: 'Interact with vial',
        isValid: true,
        retryCount: 0
      };

      const availableTargets = ['vial', 'door'];
      
      expect(validateActionContext(validInteractAction, 'marine', 'Medbay', availableTargets)).toBe(true);

      // Invalid target for interact
      const invalidInteractAction: ValidatedAction = {
        ...validInteractAction,
        target: 'nonexistent'
      };

      expect(validateActionContext(invalidInteractAction, 'marine', 'Medbay', availableTargets)).toBe(false);
    });

    it('should validate action context for alien ambush', () => {
      const validAmbushAction: ValidatedAction = {
        action: 'ambush',
        target: 'hudson',
        reasoning: 'Ambush marine in same zone',
        isValid: true,
        retryCount: 0
      };

      const availableTargets = ['hudson', 'vasquez'];
      
      expect(validateActionContext(validAmbushAction, 'alien', 'Storage', availableTargets)).toBe(true);

      // Invalid target for ambush (not a marine)
      const invalidAmbushAction: ValidatedAction = {
        ...validAmbushAction,
        target: 'door'
      };

      expect(validateActionContext(invalidAmbushAction, 'alien', 'Storage', availableTargets)).toBe(false);
    });

    it('should validate action context for director (no targets)', () => {
      const directorAction: ValidatedAction = {
        action: 'hazard',
        reasoning: 'Create environmental hazard',
        isValid: true,
        retryCount: 0
      };

      expect(validateActionContext(directorAction, 'director', 'Command', [])).toBe(true);

      // Director with target (should warn but allow)
      const directorWithTarget: ValidatedAction = {
        ...directorAction,
        target: 'Corridor'
      };

      expect(validateActionContext(directorWithTarget, 'director', 'Command', [])).toBe(false);
    });

    it('should validate multiple agent actions with validateAgentActions', () => {
      const actions = {
        hudson: { action: 'move', target: 'Shuttle Bay', reasoning: 'Marine move' },
        alien: { action: 'sneak', target: 'Corridor', reasoning: 'Alien sneak' },
        director: { action: 'nudge', reasoning: 'Director nudge' }
      };

      const agentTypes = {
        hudson: 'marine' as const,
        alien: 'alien' as const,
        director: 'director' as const
      };

      const validated = validateAgentActions(actions, agentTypes);

      expect(validated.hudson.isValid).toBe(true);
      expect(validated.hudson.action).toBe('move');
      
      expect(validated.alien.isValid).toBe(true);
      expect(validated.alien.action).toBe('sneak');
      
      expect(validated.director.isValid).toBe(true);
      expect(validated.director.action).toBe('nudge');
    });

    it('should handle mixed valid/invalid actions in batch validation', () => {
      const actions = {
        hudson: { action: 'move', target: 'Shuttle Bay', reasoning: 'Valid move' },
        vasquez: { action: 'invalid', reasoning: 'Invalid action' },
        alien: { action: 'sneak', target: 'Corridor', reasoning: 'Valid sneak' }
      };

      const agentTypes = {
        hudson: 'marine' as const,
        vasquez: 'marine' as const,
        alien: 'alien' as const
      };

      const validated = validateAgentActions(actions, agentTypes);

      expect(validated.hudson.isValid).toBe(true);
      expect(validated.vasquez.isValid).toBe(false);
      expect(validated.vasquez.fallbackUsed).toBe(true);
      expect(validated.vasquez.action).toBe('move'); // Fallback
      expect(validated.alien.isValid).toBe(true);
    });

    it('should return validation stats', () => {
      const stats = getValidationStats();
      
      expect(stats).toEqual({
        totalValid: 0,
        totalFallback: 0,
        retryAttempts: expect.any(Array)
      });
    });

    it('should handle malformed JSON input', () => {
      const malformedJSON = '{ action: "move", reasoning: "test" }'; // Missing quotes

      const result: ValidatedAction = validateAction(malformedJSON, 'marine');

      expect(result.isValid).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(result.action).toBe('move'); // Fallback action
    });

    it('should handle empty action object', () => {
      const emptyAction = {};

      const result: ValidatedAction = validateAction(emptyAction, 'marine', 'aggressive');

      expect(result.isValid).toBe(false);
      expect(result.reasoning).toContain('Validation failed');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle non-string reasoning', () => {
      const invalidReasoning = {
        action: 'search',
        reasoning: 123 // Number instead of string
      };

      const result: ValidatedAction = validateAction(invalidReasoning, 'marine');

      expect(result.isValid).toBe(false);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle invalid target type', () => {
      const invalidTarget = {
        action: 'move',
        target: 123, // Number instead of string
        reasoning: 'Invalid target type'
      };

      const result: ValidatedAction = validateAction(invalidTarget, 'marine');

      expect(result.isValid).toBe(false);
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('getFallbackAction', () => {
    it('should return cautious fallback for cautious marine', () => {
      const fallback = getFallbackAction('marine', 'cautious', 3);
      
      expect(fallback.action).toBe('search');
      expect(fallback.reasoning).toContain('Cautious/search mode');
      expect(fallback.target).toBeUndefined();
    });

    it('should return search fallback for high stress marine', () => {
      const fallback = getFallbackAction('marine', 'aggressive', 8);
      
      expect(fallback.action).toBe('search'); // High stress overrides personality
      expect(fallback.reasoning).toContain('high stress');
    });

    it('should return move fallback for aggressive marine', () => {
      const fallback = getFallbackAction('marine', 'aggressive', 2);
      
      expect(fallback.action).toBe('move');
      expect(fallback.reasoning).toContain('Aggressive/move mode');
    });

    it('should return sneak fallback for alien', () => {
      const fallback = getFallbackAction('alien');
      
      expect(fallback.action).toBe('sneak');
      expect(fallback.reasoning).toContain('Maintain stealth');
    });

    it('should return nudge fallback for director', () => {
      const fallback = getFallbackAction('director');
      
      expect(fallback.action).toBe('nudge');
      expect(fallback.reasoning).toContain('Subtle narrative influence');
    });

    it('should return report fallback for unknown agent type', () => {
      const fallback = getFallbackAction('unknown' as any);
      
      expect(fallback.action).toBe('report');
      expect(fallback.reasoning).toContain('Default report action');
    });
  });

  describe('new event type validation', () => {
    const supportedTypes = [
      'move', 'search', 'interact', 'attack', 'cover', 'report', 
      'sneak', 'ambush', 'hazard', 'nudge', 'hunt', 'lurk', 
      'stalk', 'hide', 'escalate', 'reveal', 'isolate', 'panic'
    ];

    const isSupportedEvent = (action: string, types: string[]): boolean => {
      const normalized = action.toLowerCase().trim();
      return types.includes(normalized);
    };

    it('should validate new supported event types for alien', () => {
      // Test new alien actions
      const huntAction = { action: 'hunt', target: 'Corridor', reasoning: 'Alien hunting' };
      const lurkAction = { action: 'lurk', reasoning: 'Alien lurking in shadows' };
      const stalkAction = { action: 'stalk', target: 'hudson', reasoning: 'Stalking marine' };

      const huntResult = validateAction(huntAction, 'alien');
      const lurkResult = validateAction(lurkAction, 'alien');
      const stalkResult = validateAction(stalkAction, 'alien');

      expect(huntResult.isValid).toBe(true);
      expect(lurkResult.isValid).toBe(true);
      expect(stalkResult.isValid).toBe(true);

      // Post-validation check
      expect(isSupportedEvent(huntResult.action, supportedTypes)).toBe(true);
      expect(isSupportedEvent(lurkResult.action, supportedTypes)).toBe(true);
      expect(isSupportedEvent(stalkResult.action, supportedTypes)).toBe(true);
    });

    it('should validate new supported event types for director', () => {
      // Test new director actions
      const nudgeAction = { action: 'nudge', target: 'hudson', reasoning: 'Subtle stress increase' };
      const escalateAction = { action: 'escalate', reasoning: 'Increase overall tension' };
      const isolateAction = { action: 'isolate', target: 'Corridor', reasoning: 'Trap marines' };

      const nudgeResult = validateAction(nudgeAction, 'director');
      const escalateResult = validateAction(escalateAction, 'director');
      const isolateResult = validateAction(isolateAction, 'director');

      expect(nudgeResult.isValid).toBe(true);
      expect(escalateResult.isValid).toBe(true);
      expect(isolateResult.isValid).toBe(true);

      // Post-validation check
      expect(isSupportedEvent(nudgeResult.action, supportedTypes)).toBe(true);
      expect(isSupportedEvent(escalateResult.action, supportedTypes)).toBe(true);
      expect(isSupportedEvent(isolateResult.action, supportedTypes)).toBe(true);
    });

    it('should reject unsupported event types with appropriate fallbacks', () => {
      const unsupportedActions = [
        { action: 'pounce', reasoning: 'Invalid alien pounce', agentType: 'alien' },
        { action: 'teleport', reasoning: 'Invalid teleport', agentType: 'marine' },
        { action: 'charge', reasoning: 'Invalid charge', agentType: 'director' }
      ];

      unsupportedActions.forEach(testCase => {
        const result = validateAction(testCase, testCase.agentType as 'marine' | 'alien' | 'director');
        
        expect(result.isValid).toBe(false);
        expect(result.fallbackUsed).toBe(true);
        
        // Should fallback to appropriate type-safe action
        if (testCase.agentType === 'alien') {
          expect(result.action).toBe('sneak');
        } else if (testCase.agentType === 'director') {
          expect(result.action).toBe('nudge');
        } else {
          expect(['move', 'search']).toContain(result.action);
        }
        
        // Post-validation should catch unsupported types
        expect(isSupportedEvent(testCase.action, supportedTypes)).toBe(false);
      });
    });

    it('should handle case insensitivity for new event types', () => {
      const mixedCaseActions = [
        { action: 'HUNT', reasoning: 'Uppercase hunt', agentType: 'alien' },
        { action: '  NUDGE  ', reasoning: 'Whitespace nudge', agentType: 'director' },
        { action: 'LURK', reasoning: 'Uppercase lurk', agentType: 'alien' }
      ];

      mixedCaseActions.forEach(testCase => {
        const result = validateAction(testCase, testCase.agentType as 'marine' | 'alien' | 'director');
        
        expect(result.isValid).toBe(true);
        expect(result.action).toBe(testCase.action.toLowerCase().trim()); // Normalized
        
        // Post-validation check
        expect(isSupportedEvent(testCase.action, supportedTypes)).toBe(true);
      });
    });

    it('should throw post-validation errors for unsupported actions in batch processing', () => {
      const actions = {
        hudson: { action: 'move', target: 'Corridor', reasoning: 'Valid move' },
        alien: { action: 'hunt', target: 'hudson', reasoning: 'Valid hunt' },
        director: { action: 'nudge', reasoning: 'Valid nudge' },
        invalidAlien: { action: 'pounce', reasoning: 'Invalid pounce', agentType: 'alien' },
        invalidDirector: { action: 'teleport', reasoning: 'Invalid teleport', agentType: 'director' }
      };

      const agentTypes = {
        hudson: 'marine' as const,
        alien: 'alien' as const,
        director: 'director' as const,
        invalidAlien: 'alien' as const,
        invalidDirector: 'director' as const
      };

      const validated = validateAgentActions(actions, agentTypes);
      
      // Valid actions pass initial validation
      expect(validated.hudson.isValid).toBe(true);
      expect(validated.alien.isValid).toBe(true);
      expect(validated.director.isValid).toBe(true);
      
      // Invalid actions get fallbacks
      expect(validated.invalidAlien.isValid).toBe(false);
      expect(validated.invalidAlien.fallbackUsed).toBe(true);
      expect(validated.invalidDirector.isValid).toBe(false);
      expect(validated.invalidDirector.fallbackUsed).toBe(true);
      
      // Post-validation should throw for originally unsupported actions
      const postValidationErrors: string[] = [];
      Object.entries(validated).forEach(([agent, action]) => {
        if (action.isValid || action.fallbackUsed) {
          // Check if original action was unsupported
          const originalAction = actions[agent as keyof typeof actions]?.action || action.action;
          if (!isSupportedEvent(originalAction, supportedTypes)) {
            postValidationErrors.push(`${agent}: ${originalAction} is unsupported`);
          }
        }
      });
      
      expect(postValidationErrors).toHaveLength(2);
      expect(postValidationErrors).toContain(expect.stringContaining('pounce'));
      expect(postValidationErrors).toContain(expect.stringContaining('teleport'));
    });

    it('should handle edge cases in event type validation', () => {
      // Empty/undefined action
      const emptyAction = { action: '', reasoning: 'Empty action', agentType: 'marine' as const };
      const nullAction = { action: null as any, reasoning: 'Null action', agentType: 'alien' as const };
      
      const emptyResult = validateAction(emptyAction, emptyAction.agentType);
      const nullResult = validateAction(nullAction, nullAction.agentType);
      
      expect(emptyResult.isValid).toBe(false);
      expect(nullResult.isValid).toBe(false);
      
      // Post-validation would catch these
      expect(isSupportedEvent('', supportedTypes)).toBe(false);
      expect(isSupportedEvent(null as any, supportedTypes)).toBe(false);
      
      // Whitespace-only action
      const whitespaceAction = { action: '   ', reasoning: 'Whitespace action', agentType: 'director' as const };
      const whitespaceResult = validateAction(whitespaceAction, whitespaceAction.agentType);
      
      expect(whitespaceResult.isValid).toBe(false);
      expect(isSupportedEvent('   ', supportedTypes)).toBe(false);
    });

    it('should maintain TypeScript type safety with new event types', () => {
      // Test that new event types work with the type system
      type NewEventTypes = 'hunt' | 'lurk' | 'nudge' | 'escalate' | 'stalk';
      
      const newTypeActions: Record<NewEventTypes, any> = {
        hunt: { action: 'hunt' as const, target: 'Corridor', reasoning: 'Hunt test' },
        lurk: { action: 'lurk' as const, reasoning: 'Lurk test' },
        nudge: { action: 'nudge' as const, target: 'hudson', reasoning: 'Nudge test' },
        escalate: { action: 'escalate' as const, reasoning: 'Escalate test' },
        stalk: { action: 'stalk' as const, target: 'vasquez', reasoning: 'Stalk test' }
      };

      Object.entries(newTypeActions).forEach(([type, action]) => {
        const agentType = type === 'nudge' || type === 'escalate' ? 'director' : 'alien';
        const result = validateAction(action, agentType);
        
        expect(result).toBeDefined();
        expect(result.action).toBe(type);
        expect(result.isValid).toBe(true);
        expect(isSupportedEvent(type, supportedTypes)).toBe(true);
      });
    });
  });
});