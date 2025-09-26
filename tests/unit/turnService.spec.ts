import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  advanceTurn, 
  validateTurnSequence, 
  checkCompliance, 
  getCurrentTurnState,
  resetTurn,
  type TurnState 
} from '../../src/lib/services/turnService';
import type { Marine, AgentAction } from '../../src/lib/models/entities';
import type { ValidatedAction } from '../../src/lib/services/actionValidator';
import { get } from 'svelte/store';
import { agentStore, eventStore } from '../../src/lib/stores';

// Mock dependencies
vi.mock('../../src/lib/services/actionValidator', () => ({
  validateAction: vi.fn(),
  validateActionContext: vi.fn(),
  getFallbackAction: vi.fn()
}));

vi.mock('../../src/lib/stores/agentStore');
vi.mock('../../src/lib/stores/eventStore');

const mockValidateAction = vi.mocked(validateAction);
const mockValidateActionContext = vi.mocked(validateActionContext);
const mockGetFallbackAction = vi.mocked(getFallbackAction);

const mockAgentState = {
  marines: [
    { id: 'hudson', personality: 'aggressive', compliance: 0.8, position: 'Shuttle', health: 10, stress: 2, inventory: [] },
    { id: 'vasquez', personality: 'cautious', compliance: 0.9, position: 'Shuttle', health: 10, stress: 1, inventory: [] }
  ],
  alien: { position: 'Storage', hidden: true },
  director: { adjustments: [] }
};

const mockEventStore = {
  get: vi.fn(() => []),
  update: vi.fn()
};

const mockActions: Record<string, AgentAction> = {
  hudson: { action: 'move', target: 'Shuttle Bay', reasoning: 'Following orders' },
  vasquez: { action: 'search', target: 'console', reasoning: 'Gathering intel' },
  alien: { action: 'sneak', target: 'Corridor', reasoning: 'Maintaining stealth' },
  director: { action: 'nudge', reasoning: 'Creating tension' }
};

describe('turnService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock stores
    (get as any).mockImplementation((store) => {
      if (store === agentStore) return mockAgentState;
      return null;
    });
    
    // Mock event store methods
    vi.stubGlobal('eventStore', mockEventStore);
    
    // Mock validation to succeed
    mockValidateAction.mockImplementation((action, agentType) => ({
      ...action,
      isValid: true,
      retryCount: 0
    }));
    
    mockValidateActionContext.mockReturnValue(true);
    mockGetFallbackAction.mockImplementation((type) => ({
      action: 'report',
      reasoning: `Fallback for ${type}`,
      target: undefined
    }));
  });

  describe('advanceTurn', () => {
    it('should advance turn with valid marine actions', async () => {
      const turnActions = {
        hudson: mockActions.hudson,
        vasquez: mockActions.vasquez
      };

      const result = await advanceTurn(turnActions, 'marine');

      expect(result.success).toBe(true);
      expect(result.turnNumber).toBe(1);
      expect(result.validatedActions).toHaveLength(2);
      expect(result.validatedActions[0].action).toBe('move');
      expect(result.validatedActions[1].action).toBe('search');
      expect(mockEventStore.update).toHaveBeenCalledTimes(2); // Events added
      expect(result.complianceViolations).toEqual([]);
    });

    it('should advance turn with mixed agent types', async () => {
      const fullTurnActions = {
        ...mockActions,
        director: mockActions.director
      };

      const result = await advanceTurn(fullTurnActions, 'full');

      expect(result.success).toBe(true);
      expect(result.turnNumber).toBe(1);
      expect(result.validatedActions).toHaveLength(4);
      expect(result.validatedActions.map(a => a.action)).toEqual([
        'move', 'search', 'sneak', 'nudge'
      ]);
      expect(mockEventStore.update).toHaveBeenCalledTimes(4);
    });

    it('should handle compliance failure for low compliance marine', async () => {
      const lowComplianceMarine: Marine = { ...mockAgentState.marines[0], compliance: 0.2 };
      
      // Mock agent store to return low compliance marine
      (get as any).mockImplementation((store) => {
        if (store === agentStore) {
          return {
            ...mockAgentState,
            marines: [lowComplianceMarine, mockAgentState.marines[1]]
          };
        }
        return null;
      });

      const riskyAction = { action: 'attack', target: 'alien', reasoning: 'Aggressive action' };
      const turnActions = { hudson: riskyAction };

      const result = await advanceTurn(turnActions, 'marine');

      expect(result.success).toBe(false);
      expect(result.complianceViolations).toHaveLength(1);
      expect(result.complianceViolations[0].agentId).toBe('hudson');
      expect(result.complianceViolations[0].reason).toContain('low compliance');
      expect(result.validatedActions[0].fallbackUsed).toBe(true);
      expect(result.validatedActions[0].action).toBe('move'); // Fallback action
    });

    it('should timeout long-running turns', async () => {
      // Mock slow validation
      mockValidateAction.mockImplementationOnce(() => new Promise(resolve => 
        setTimeout(() => resolve({
          action: 'move',
          target: 'Shuttle Bay',
          reasoning: 'Slow validation',
          isValid: true,
          retryCount: 0
        }), 7000) // Longer than default timeout
      ));

      const turnActions = { hudson: mockActions.hudson };

      const result = await advanceTurn(turnActions, 'marine');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.validatedActions).toHaveLength(0); // No actions processed
    });

    it('should handle partial turn success', async () => {
      // Mock one action to fail validation
      mockValidateAction
        .mockResolvedValueOnce({ // Hudson succeeds
          ...mockActions.hudson,
          isValid: true,
          retryCount: 0
        })
        .mockResolvedValueOnce({ // Vasquez fails
          ...mockActions.vasquez,
          isValid: false,
          retryCount: 3,
          fallbackUsed: true,
          action: 'report', // Fallback
          reasoning: 'Fallback: Cautious/search mode due to personality or high stress'
        });

      const turnActions = {
        hudson: mockActions.hudson,
        vasquez: mockActions.vasquez
      };

      const result = await advanceTurn(turnActions, 'marine');

      expect(result.success).toBe(true); // Partial success
      expect(result.validatedActions).toHaveLength(2);
      expect(result.validatedActions[0].isValid).toBe(true);
      expect(result.validatedActions[0].action).toBe('move');
      expect(result.validatedActions[1].isValid).toBe(false);
      expect(result.validatedActions[1].action).toBe('report'); // Fallback
      expect(result.validatedActions[1].fallbackUsed).toBe(true);
      expect(mockEventStore.update).toHaveBeenCalledTimes(1); // Only successful action
    });

    it('should validate turn sequence order', () => {
      const outOfOrderActions = {
        director: mockActions.director, // Should be last
        hudson: mockActions.hudson,
        alien: mockActions.alien // Should be after marines
      };

      const result = await advanceTurn(outOfOrderActions, 'full');

      expect(result.sequenceValid).toBe(false);
      expect(result.sequenceErrors).toHaveLength(2);
      expect(result.sequenceErrors).toContain('Director acted out of sequence');
      expect(result.sequenceErrors).toContain('Alien acted out of sequence');
    });

    it('should process turns in correct sequence: marines -> alien -> director', async () => {
      const properlyOrderedActions = {
        hudson: mockActions.hudson,
        vasquez: mockActions.vasquez,
        alien: mockActions.alien,
        director: mockActions.director
      };

      const result = await advanceTurn(properlyOrderedActions, 'full');

      expect(result.sequenceValid).toBe(true);
      expect(result.sequenceErrors).toEqual([]);
      expect(result.processOrder).toEqual(['hudson', 'vasquez', 'alien', 'director']);
    });
  });

  describe('checkCompliance', () => {
    it('should approve compliant marine action', () => {
      const compliantAction: AgentAction = {
        action: 'move',
        target: 'Shuttle Bay',
        reasoning: 'Following commander orders directly'
      };

      const result = checkCompliance(compliantAction, mockMarine, 'Search shuttle bay');

      expect(result.approved).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.reason).toContain('matches commander intent');
    });

    it('should reject non-compliant aggressive action', () => {
      const nonCompliantAction: AgentAction = {
        action: 'attack',
        target: 'alien',
        reasoning: 'Taking aggressive action against perceived threat'
      };

      const result = checkCompliance(nonCompliantAction, mockMarine, 'Search shuttle bay');

      expect(result.approved).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.reason).toContain('deviates from orders');
    });

    it('should handle cautious marine preferring safe actions', () => {
      const cautiousMarine: Marine = { ...mockMarine, personality: 'cautious', compliance: 0.9 };
      const safeAction: AgentAction = {
        action: 'search',
        target: 'console',
        reasoning: 'Gathering information before proceeding'
      };

      const result = checkCompliance(safeAction, cautiousMarine, 'Investigate area');

      expect(result.approved).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toContain('matches cautious personality');
    });

    it('should penalize high stress decisions', () => {
      const stressedMarine: Marine = { ...mockMarine, stress: 9 };
      const riskyAction: AgentAction = {
        action: 'attack',
        target: 'shadow',
        reasoning: 'Panicking and shooting at shadows'
      };

      const result = checkCompliance(riskyAction, stressedMarine, 'Maintain defensive positions');

      expect(result.approved).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.reason).toContain('stress-induced poor judgment');
    });

    it('should validate action against mission objectives', () => {
      const missionCriticalAction: AgentAction = {
        action: 'interact',
        target: 'vial',
        reasoning: 'Retrieving the primary mission objective'
      };

      const result = checkCompliance(missionCriticalAction, mockMarine, 'Retrieve vial from medbay');

      expect(result.approved).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reason).toContain('mission critical');
    });

    it('should handle ambiguous orders with moderate confidence', () => {
      const ambiguousAction: AgentAction = {
        action: 'search',
        target: 'storage',
        reasoning: 'Searching based on general exploration orders'
      };

      const result = checkCompliance(ambiguousAction, mockMarine, 'Explore the area thoroughly');

      expect(result.approved).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.reason).toContain('reasonably interprets');
    });
  });

  describe('validateTurnSequence', () => {
    it('should validate correct turn sequence', () => {
      const correctSequence = [
        { agentId: 'hudson', action: 'move', phase: 'marine' },
        { agentId: 'vasquez', action: 'search', phase: 'marine' },
        { agentId: 'alien', action: 'sneak', phase: 'alien' },
        { agentId: 'director', action: 'nudge', phase: 'director' }
      ];

      const result = validateTurnSequence(correctSequence);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.phaseOrder).toEqual(['marine', 'marine', 'alien', 'director']);
    });

    it('should detect out-of-sequence actions', () => {
      const outOfSequence = [
        { agentId: 'alien', action: 'sneak', phase: 'alien' }, // Too early
        { agentId: 'hudson', action: 'move', phase: 'marine' },
        { agentId: 'director', action: 'nudge', phase: 'director' }, // Too early
        { agentId: 'vasquez', action: 'search', phase: 'marine' }
      ];

      const result = validateTurnSequence(outOfSequence);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('acted out of sequence');
      expect(result.errors[1]).toContain('acted out of sequence');
    });

    it('should validate marine actions occur before alien', () => {
      const marineAfterAlien = [
        { agentId: 'alien', action: 'sneak', phase: 'alien' },
        { agentId: 'hudson', action: 'move', phase: 'marine' } // Marine after alien
      ];

      const result = validateTurnSequence(marineAfterAlien);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Marine actions must precede alien actions');
    });

    it('should allow multiple marine actions in any order among marines', () => {
      const marineOrder = [
        { agentId: 'vasquez', action: 'search', phase: 'marine' },
        { agentId: 'hudson', action: 'move', phase: 'marine' } // Different order OK
      ];

      const result = validateTurnSequence(marineOrder);

      expect(result.isValid).toBe(true);
      expect(result.phaseOrder).toEqual(['marine', 'marine']);
    });

    it('should reject duplicate agent actions in same turn', () => {
      const duplicateActions = [
        { agentId: 'hudson', action: 'move', phase: 'marine' },
        { agentId: 'hudson', action: 'search', phase: 'marine' } // Duplicate
      ];

      const result = validateTurnSequence(duplicateActions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('duplicate action');
    });

    it('should handle empty turn sequence', () => {
      const emptySequence = [];

      const result = validateTurnSequence(emptySequence);

      expect(result.isValid).toBe(true); // Empty is technically valid
      expect(result.errors).toEqual([]);
      expect(result.phaseOrder).toEqual([]);
    });

    it('should validate complex multi-phase sequence', () => {
      const complexSequence = [
        // Turn 1
        { agentId: 'hudson', action: 'move', phase: 'marine' },
        { agentId: 'vasquez', action: 'search', phase: 'marine' },
        { agentId: 'alien', action: 'stalk', phase: 'alien' },
        { agentId: 'director', action: 'nudge', phase: 'director' },
        // Turn 2
        { agentId: 'hudson', action: 'interact', phase: 'marine' },
        { agentId: 'vasquez', action: 'report', phase: 'marine' },
        { agentId: 'alien', action: 'ambush', phase: 'alien' },
        { agentId: 'director', action: 'escalate', phase: 'director' }
      ];

      const result = validateTurnSequence(complexSequence);

      expect(result.isValid).toBe(true);
      expect(result.turnCount).toBe(2);
      expect(result.phaseOrder).toEqual([
        'marine', 'marine', 'alien', 'director',
        'marine', 'marine', 'alien', 'director'
      ]);
    });
  });

  describe('getCurrentTurnState', () => {
    it('should return initial turn state', () => {
      const state: TurnState = getCurrentTurnState();

      expect(state.turnNumber).toBe(0);
      expect(state.phase).toBe('marine');
      expect(state.actionsProcessed).toEqual({});
      expect(state.complianceChecks).toEqual({});
      expect(state.eventsThisTurn).toEqual([]);
      expect(state.isComplete).toBe(false);
    });

    it('should track processed actions', () => {
      const state: TurnState = getCurrentTurnState();
      
      // Simulate processing
      state.actionsProcessed = { hudson: true, vasquez: true };
      state.phase = 'alien';

      const updatedState = getCurrentTurnState(); // This would need store in real impl

      expect(updatedState.actionsProcessed).toEqual({ hudson: true, vasquez: true });
      expect(updatedState.phase).toBe('alien');
    });

    it('should track compliance results', () => {
      const state: TurnState = getCurrentTurnState();
      
      state.complianceChecks = {
        hudson: { approved: true, confidence: 0.8, reason: 'matches orders' },
        vasquez: { approved: false, confidence: 0.3, reason: 'deviates from orders' }
      };

      const updatedState = getCurrentTurnState();

      expect(updatedState.complianceChecks.hudson.approved).toBe(true);
      expect(updatedState.complianceChecks.vasquez.approved).toBe(false);
    });

    it('should indicate turn completion', () => {
      const incompleteState: TurnState = {
        turnNumber: 1,
        phase: 'marine',
        actionsProcessed: { hudson: true },
        complianceChecks: {},
        eventsThisTurn: [],
        isComplete: false
      };

      const completeState: TurnState = {
        ...incompleteState,
        actionsProcessed: { hudson: true, vasquez: true, alien: true, director: true },
        phase: 'complete',
        isComplete: true
      };

      expect(getCurrentTurnState()).not.toEqual(completeState); // Current state
      // In real implementation, this would reflect store state
    });
  });

  describe('resetTurn', () => {
    it('should reset turn state to initial values', () => {
      const currentState: TurnState = {
        turnNumber: 5,
        phase: 'alien',
        actionsProcessed: { hudson: true, alien: true },
        complianceChecks: { hudson: { approved: false, confidence: 0.4, reason: 'test' } },
        eventsThisTurn: ['move', 'sneak'],
        isComplete: true
      };

      resetTurn();

      const newState = getCurrentTurnState();

      expect(newState.turnNumber).toBe(0);
      expect(newState.phase).toBe('marine');
      expect(newState.actionsProcessed).toEqual({});
      expect(newState.complianceChecks).toEqual({});
      expect(newState.eventsThisTurn).toEqual([]);
      expect(newState.isComplete).toBe(false);
    });

    it('should clear turn-specific events', () => {
      const mockEvents = ['event1', 'event2'];
      
      // Simulate events this turn
      const state: TurnState = getCurrentTurnState();
      state.eventsThisTurn = mockEvents;

      resetTurn();

      const newState = getCurrentTurnState();
      expect(newState.eventsThisTurn).toEqual([]);
    });

    it('should reset compliance tracking', () => {
      const complianceData = {
        hudson: { approved: true, confidence: 0.9, reason: 'good' },
        vasquez: { approved: false, confidence: 0.2, reason: 'bad' }
      };

      // Simulate compliance checks
      const state: TurnState = getCurrentTurnState();
      state.complianceChecks = complianceData;

      resetTurn();

      const newState = getCurrentTurnState();
      expect(newState.complianceChecks).toEqual({});
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete turn cycle successfully', async () => {
      // Setup mocks for successful validation
      mockValidateAction.mockResolvedValue({
        action: 'move',
        target: 'Shuttle Bay',
        reasoning: 'Successful validation',
        isValid: true,
        retryCount: 0
      });

      const completeActions = {
        hudson: { action: 'move', target: 'Shuttle Bay', reasoning: 'Marine 1' },
        vasquez: { action: 'search', target: 'console', reasoning: 'Marine 2' },
        alien: { action: 'sneak', target: 'Corridor', reasoning: 'Alien' },
        director: { action: 'nudge', reasoning: 'Director' }
      };

      const result = await advanceTurn(completeActions, 'full');

      expect(result.success).toBe(true);
      expect(result.turnNumber).toBe(1);
      expect(result.sequenceValid).toBe(true);
      expect(result.complianceViolations).toEqual([]);
      expect(result.validatedActions.length).toBe(4);
      expect(result.eventsAdded).toBe(4);
    });

    it('should recover from validation failures with fallbacks', async () => {
      // Mock some actions to fail initially
      mockValidateAction
        .mockResolvedValueOnce({ // Hudson succeeds
          action: 'move',
          target: 'Shuttle Bay',
          reasoning: 'Success',
          isValid: true,
          retryCount: 0
        })
        .mockResolvedValueOnce({ // Vasquez fails
          action: 'invalid',
          reasoning: 'Fail',
          isValid: false,
          retryCount: 3,
          fallbackUsed: true,
          action: 'search', // Fallback
          reasoning: 'Fallback action'
        })
        .mockResolvedValueOnce({ // Alien succeeds
          action: 'sneak',
          target: 'Corridor',
          reasoning: 'Success',
          isValid: true,
          retryCount: 0
        });

      const mixedActions = {
        hudson: { action: 'move', target: 'Shuttle Bay', reasoning: 'Good' },
        vasquez: { action: 'invalid', reasoning: 'Bad' },
        alien: { action: 'sneak', target: 'Corridor', reasoning: 'Good' }
      };

      const result = await advanceTurn(mixedActions, 'marine');

      expect(result.success).toBe(true); // Continues despite partial failure
      expect(result.validatedActions[0].isValid).toBe(true);
      expect(result.validatedActions[0].action).toBe('move');
      expect(result.validatedActions[1].isValid).toBe(false);
      expect(result.validatedActions[1].action).toBe('search'); // Fallback
      expect(result.validatedActions[1].fallbackUsed).toBe(true);
      expect(result.validatedActions[2].isValid).toBe(true);
      expect(result.fallbacksUsed).toBe(1);
    });

    it('should enforce turn timeout for entire sequence', async () => {
      // Mock slow processing for multiple actions
      const slowValidation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({
            action: 'move',
            target: 'Shuttle Bay',
            reasoning: 'Slow',
            isValid: true,
            retryCount: 0
          }), 3000)
        )
      );
      
      mockValidateAction.mockImplementation(slowValidation);

      const actions = {
        hudson: { action: 'move', target: 'Shuttle Bay', reasoning: 'Slow 1' },
        vasquez: { action: 'search', target: 'console', reasoning: 'Slow 2' }
      };

      const startTime = Date.now();
      const result = await advanceTurn(actions, 'marine');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(duration).toBeLessThan(10000); // Should timeout before 10s total
      expect(result.validatedActions.length).toBeLessThan(2); // Partial processing
    });

    it('should track turn performance metrics', async () => {
      const actions = { hudson: mockActions.hudson };
      
      const result = await advanceTurn(actions, 'marine');

      expect(result.performance).toBeDefined();
      expect(result.performance.processingTime).toBeGreaterThan(0);
      expect(result.performance.validationTime).toBeGreaterThan(0);
      expect(result.performance.eventGenerationTime).toBeGreaterThan(0);
      expect(result.performance.totalTokens).toBeGreaterThan(0);
    });

    it('should handle turn rollback on critical failure', async () => {
      // Mock critical failure (e.g., validation context failure)
      mockValidateActionContext.mockReturnValueOnce(false); // First action fails context

      const actions = {
        hudson: mockActions.hudson,
        vasquez: mockActions.vasquez
      };

      const result = await advanceTurn(actions, 'marine');

      expect(result.success).toBe(false);
      expect(result.rollbackPerformed).toBe(true);
      expect(result.eventsAdded).toBe(0); // No events added
      expect(mockEventStore.update).toHaveBeenCalledTimes(0); // No events persisted
      expect(result.error).toContain('critical validation failure');
    });
  });

  describe('error recovery', () => {
    it('should recover from individual action failures', async () => {
      mockValidateAction
        .mockResolvedValueOnce({ // Success
          ...mockActions.hudson,
          isValid: true,
          retryCount: 0
        })
        .mockResolvedValueOnce({ // Failure with fallback
          ...mockActions.vasquez,
          isValid: false,
          retryCount: 3,
          fallbackUsed: true,
          action: 'report',
          reasoning: 'Fallback due to validation failure'
        });

      const actions = {
        hudson: mockActions.hudson,
        vasquez: mockActions.vasquez
      };

      const result = await advanceTurn(actions, 'marine');

      expect(result.success).toBe(true); // Recovers with fallback
      expect(result.recoveryActions).toHaveLength(1);
      expect(result.recoveryActions[0].originalAction).toBe('search');
      expect(result.recoveryActions[0].fallbackAction).toBe('report');
    });

    it('should log validation failures for debugging', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockValidateAction.mockResolvedValueOnce({
        action: 'invalid',
        reasoning: 'Test failure',
        isValid: false,
        retryCount: 3,
        fallbackUsed: true
      });

      const actions = { hudson: { action: 'invalid', reasoning: 'test' } };

      await advanceTurn(actions, 'marine');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Action validation failed'));
      expect(consoleErrorSpy).toHaveBeenCalledTimes(0); // No critical errors

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should generate error report for failed turns', async () => {
      mockValidateAction.mockResolvedValueOnce({
        action: 'move',
        target: 'InvalidZone',
        reasoning: 'Zone validation failed',
        isValid: false,
        retryCount: 3,
        fallbackUsed: true
      });

      const actions = { hudson: mockActions.hudson };

      const result = await advanceTurn(actions, 'marine');

      expect(result.errorReport).toBeDefined();
      expect(result.errorReport.turnNumber).toBe(1);
      expect(result.errorReport.failedActions).toHaveLength(1);
      expect(result.errorReport.failedActions[0].action).toBe('move');
      expect(result.errorReport.failedActions[0].errorType).toBe('validation');
      expect(result.errorReport.recoveryStatus).toBe('partial');
    });
  });
});