import type { AgentAction } from './llmClient';
import type { Marine } from '../models/entities';

// Supported event types (from EventType enum and handlers)
export const handledTypes: string[] = [
  'move', 'search', 'interact', 'attack', 'cover', 'report', 'message',
  'sneak', 'ambush', 'hazard', 'nudge', 'hunt', 'lurk', 'stalk', 'hide',
  'escalate', 'reveal', 'isolate', 'panic'
];

export const isSupportedEvent = (action: string): boolean => {
  return handledTypes.includes(action.toLowerCase().trim());
};

// Allowed actions per agent type (matching promptService)
export const MARINE_ACTIONS = new Set([
  'move', 'search', 'interact', 'attack', 'cover', 'report'
]);

export const ALIEN_ACTIONS = new Set([
  'sneak', 'stalk', 'ambush', 'hide', 'hunt', 'lurk'
]);

export const DIRECTOR_ACTIONS = new Set([
  'hazard', 'escalate', 'nudge', 'reveal', 'isolate', 'panic'
]);

// Fallback actions based on personality and stress
export const getFallbackAction = (agentType: 'marine' | 'alien' | 'director', personality?: string, stress?: number): AgentAction => {
  switch (agentType) {
    case 'marine':
      if (personality === 'cautious' || (stress && stress > 7)) {
        return {
          action: 'search',
          target: undefined,
          reasoning: 'Fallback: Cautious/search mode due to personality or high stress'
        };
      }
      return {
        action: 'move',
        target: undefined,
        reasoning: 'Fallback: Aggressive/move mode due to personality'
      };
      
    case 'alien':
      return {
        action: 'sneak',
        target: undefined,
        reasoning: 'Fallback: Maintain stealth as alien priority'
      };
      
    case 'director':
      return {
        action: 'nudge',
        target: undefined,
        reasoning: 'Fallback: Subtle narrative influence as director'
      };
      
    default:
      return {
        action: 'report',
        target: undefined,
        reasoning: 'Fallback: Default report action'
      };
  }
};

export interface ValidatedAction extends AgentAction {
  isValid: boolean;
  retryCount: number;
  fallbackUsed?: boolean;
}

export const validateAction = (
  rawAction: any,
  agentType: 'marine' | 'alien' | 'director',
  personality?: string,
  stress?: number,
  agentName?: string,
  turnNumber?: number,
  maxRetries: number = 2
): ValidatedAction => {
  let retryCount = 0;
  let parsedAction: AgentAction | null = null;
  let isValid = false;
  let fallbackUsed = false;
  
  // Parse JSON response
  while (retryCount < maxRetries && !isValid) {
    try {
      // Handle both string JSON and direct objects
      const actionString = typeof rawAction === 'string' ? rawAction : JSON.stringify(rawAction);
      parsedAction = JSON.parse(actionString);
      
      // Validate structure
      if (!parsedAction || typeof parsedAction.action !== 'string' ||
          typeof parsedAction.reasoning !== 'string' ||
          (parsedAction.target !== undefined && typeof parsedAction.target !== 'string' && parsedAction.target !== null)) {
        throw new Error('Invalid action structure');
      }
      
      // Normalize target (null/undefined -> undefined)
      let normalizedAction: AgentAction = {
        action: parsedAction.action.trim().toLowerCase(),
        target: parsedAction.target || undefined,
        reasoning: parsedAction.reasoning
      };

      // Fallback mappings for common invalid actions
      const actionMappings: Record<string, string> = {
        'message': agentType === 'director' || agentType === 'alien' ? 'nudge' : 'report',
        'search': agentType === 'alien' ? 'sneak' : 'search',
        'communicate': 'report',
        'investigate': 'search',
        'default': agentType === 'marine' ? 'report' : agentType === 'alien' ? 'sneak' : 'nudge'
      };

      const lowerAction = normalizedAction.action.toLowerCase().trim();
      if (actionMappings[lowerAction]) {
        normalizedAction.action = actionMappings[lowerAction];
        console.log(`[VALIDATION MAP] ${agentName || 'Unknown'}: Mapped '${lowerAction}' to '${normalizedAction.action}' (turn ${turnNumber || 'N/A'})`);
      }
      
      // Validate action type against allowed actions
      const allowedActions = agentType === 'marine' ? MARINE_ACTIONS :
                            agentType === 'alien' ? ALIEN_ACTIONS :
                            DIRECTOR_ACTIONS;
      
      if (!allowedActions.has(normalizedAction.action)) {
        throw new Error(`Invalid action type: ${normalizedAction.action}`);
      }

      // Post-validation: Ensure event type is supported
      if (!isSupportedEvent(normalizedAction.action)) {
        throw new Error(`Unsupported event type: ${normalizedAction.action}. Must be in handledTypes.`);
      }
      
      // Additional validation for specific actions
      if (normalizedAction.action === 'move' && agentType === 'marine') {
        // Move should have a target (adjacent zone)
        if (!normalizedAction.target) {
          throw new Error('Move action requires target zone');
        }
      }
      
      if (normalizedAction.action === 'search' || normalizedAction.action === 'interact') {
        // Search/interact should have target item/zone
        if (!normalizedAction.target) {
          throw new Error(`${normalizedAction.action} action requires target`);
        }
      }
      
      // Action is valid
      isValid = true;
      return {
        ...normalizedAction,
        isValid: true,
        retryCount
      };
      
    } catch (error: any) {
      retryCount++;
      
      if (retryCount >= maxRetries) {
        // Use fallback after max retries
        console.warn(`[${agentName || 'Unknown'}] Action validation failed after ${maxRetries} attempts (turn ${turnNumber || 'N/A'}): ${error.message}`);
        const fallback = getFallbackAction(agentType, personality, stress);
        fallbackUsed = true;
        
        return {
          ...fallback,
          isValid: true, // Fallback is a valid action
          retryCount,
          fallbackUsed: true
        };
      }
      
      // Log retry attempt
      console.log(`[${agentName || 'Unknown'}] Action validation attempt ${retryCount} failed (turn ${turnNumber || 'N/A'}): ${error.message}. Retrying...`);
      
      // For retry, we could modify the rawAction (e.g., add more context),
      // but for now just retry with same input
    }
  }
  
  // Shouldn't reach here, but safety return
  return {
    action: 'report',
    target: undefined,
    reasoning: 'Validation failed - defaulting to report',
    isValid: false,
    retryCount,
    fallbackUsed: true
  };
};

// Batch validation for multiple agents
export const validateAgentActions = (
  actions: Record<string, any>,
  agentTypes: Record<string, 'marine' | 'alien' | 'director'>
): Record<string, ValidatedAction> => {
  const validated: Record<string, ValidatedAction> = {};
  
  Object.entries(actions).forEach(([agentId, rawAction]) => {
    const agentType = agentTypes[agentId] || 'marine';
    validated[agentId] = validateAction(rawAction, agentType);
  });
  
  return validated;
};

// Validate action context (e.g., can agent actually perform this action?)
export const validateActionContext = (
  action: ValidatedAction,
  agentType: 'marine' | 'alien' | 'director',
  currentZone: string,
  availableTargets: string[]
): boolean => {
  // Basic context validation
  if (action.target && !availableTargets.includes(action.target)) {
    console.warn(`Invalid target ${action.target} for action ${action.action} in zone ${currentZone}`);
    return false;
  }
  
  // Type-specific context validation
  switch (agentType) {
    case 'marine':
      if (action.action === 'move' && !availableTargets.includes(action.target!)) {
        return false; // Can't move to invalid zone
      }
      if ((action.action === 'search' || action.action === 'interact') && !availableTargets.includes(action.target!)) {
        return false; // Can't search/interact with invalid target
      }
      break;
      
    case 'alien':
      if (action.action === 'ambush' && action.target) {
        // Ambush should target a marine, not a zone
        const isValidMarineTarget = action.target.startsWith('hudson') || action.target.startsWith('vasquez');
        if (!isValidMarineTarget) {
          return false;
        }
      }
      break;
      
    case 'director':
      // Director actions typically don't need targets
      if (action.target) {
        console.warn('Director actions typically do not require targets');
        return false;
      }
      break;
  }
  
  return true;
};

// Get validation stats for debugging
export const getValidationStats = (): { totalValid: number; totalFallback: number; retryAttempts: number[] } => {
  // This would require tracking in a real implementation
  // For now return mock stats
  return {
    totalValid: 0,
    totalFallback: 0,
    retryAttempts: []
  };
};