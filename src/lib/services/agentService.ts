import type { Agent, Zone } from '../models/entities';
import type { Event } from '../models/eventSchema';
import type { LLMResponse } from './llmClient';
import type { ValidatedAction } from './actionValidator';
import { assemblePrompt } from './promptService';
import { validateAction } from './actionValidator';
import { callLLM } from './llmClient';

export const generateAgentAction = async (
  agent: Agent,
  memory: Event[],
  commanderMsg: string,
  zoneState: Zone
): Promise<ValidatedAction> => {
  // Assemble context-specific prompt
  const promptContext = { agent, memory, commanderMsg, zoneState };
  const prompt = assemblePrompt(promptContext);
  
  // Call LLM via OpenRouter (uses env key or mock automatically)
  const llmResponse: LLMResponse = await callLLM(prompt);
  
  // Determine agent type for validation
  let agentType: 'marine' | 'alien' | 'director';
  let personality: string | undefined;
  let stress: number | undefined;
  let agentName = '';

  if ('id' in agent && 'personality' in agent) {
    // Marine
    const marine = agent as any; // Use any to access union properties
    agentType = 'marine';
    personality = marine.personality;
    stress = marine.stress;
    agentName = marine.id;
  } else if ('position' in agent && 'hidden' in agent) {
    // Alien
    agentType = 'alien';
    agentName = 'Alien';
  } else if ('adjustments' in agent) {
    // Director
    agentType = 'director';
    agentName = 'Director';
  } else {
    throw new Error('Unknown agent type');
  }

  // Validate and parse the response
  const validatedAction = validateAction(llmResponse, agentType, personality, stress);
  
  if (!validatedAction.isValid && !validatedAction.fallbackUsed) {
    throw new Error(`Failed to validate action for ${agentName}: ${JSON.stringify(llmResponse)}`);
  }
  
  console.log(`[${agentName}] Generated action: ${validatedAction.action}${validatedAction.target ? ` (target: ${validatedAction.target})` : ''} - Reasoning: ${llmResponse.reasoning || validatedAction.reasoning}`);
  
  return validatedAction;
};

// Stub for test expectations
export const fallbackAgentAction = (agentType: 'marine' | 'alien' | 'director', personality?: string, stress?: number): ValidatedAction => {
  // Use the validator's fallback logic
  return validateAction({ action: 'report', reasoning: 'Fallback action' }, agentType, personality, stress) as ValidatedAction;
};

// Stub for memory pruning test
export const pruneAgentMemory = (memory: Event[], maxEvents: number = 50): Event[] => {
  return memory.slice(-maxEvents);
};

// Stub for stress test
export const updateAgentStress = (agent: any, delta: number): void => {
  if ('stress' in agent) {
    agent.stress = Math.max(0, Math.min(10, (agent.stress || 0) + delta));
  }
};

// Stub for mission start
export const initializeAgents = (): any => {
  // Return initial agents from entities
  return {
    marines: [
      { id: 'hudson', personality: 'aggressive', compliance: 0.7, position: 'Shuttle', health: 10, stress: 0, inventory: [] },
      { id: 'vasquez', personality: 'cautious', compliance: 0.9, position: 'Shuttle', health: 10, stress: 0, inventory: [] }
    ],
    alien: { position: 'Storage', hidden: true },
    director: { adjustments: [] }
  };
};

// Stub for action success calculation
export const calculateActionSuccess = (action: string, agentStress: number, compliance: number): number => {
  return Math.random() * (1 - agentStress / 10) * compliance;
};

// Optional: Function to execute agent turn (could be used by turnService)
export const executeAgentTurn = async (
  agent: Agent,
  memory: Event[],
  commanderMsg: string,
  zoneState: Zone,
  applyEvent: (event: Event) => void // From eventService
): Promise<void> => {
  // Determine agent ID and name (shared logic)
  let agentId = '';
  let agentName = '';
  if ('id' in agent && 'personality' in agent) {
    const marine = agent as any;
    agentId = marine.id;
    agentName = marine.id;
  } else if ('position' in agent && 'hidden' in agent) {
    agentId = 'alien';
    agentName = 'Alien';
  } else if ('adjustments' in agent) {
    agentId = 'director';
    agentName = 'Director';
  }

  try {
    const action = await generateAgentAction(agent, memory, commanderMsg, zoneState);
    
    // Create event from action
    const event: Event = {
      id: crypto.randomUUID(),
      tick: Date.now(),
      type: action.action as any, // Cast to match EventType
      actor: agentId,
      target: action.target || undefined,
      details: { reasoning: action.reasoning },
      result: undefined
    };
    
    // Apply the event to world state
    applyEvent(event);
    
  } catch (error) {
    console.error(`Error in agent turn for ${agentName}:`, error);
    // Fallback: defensive action
    const fallbackActor = agentId || 'unknown';
    const fallbackEvent: Event = {
      id: crypto.randomUUID(),
      tick: Date.now(),
      type: 'cover' as any,
      actor: fallbackActor,
      target: undefined,
      details: { reasoning: 'Fallback: Taking cover due to error' },
      result: undefined
    };
    applyEvent(fallbackEvent);
  }
};