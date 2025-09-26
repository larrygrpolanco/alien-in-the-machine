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
      const result: ValidatedAction = validateAction(firstInvalid, 'marine', 'aggressive', 2, 1);

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
});