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
  const llmResponse: LLMResponse = await callLLM(prompt, 'gpt-4o-mini');
  
  // Determine agent type for validation
  let agentType: 'marine' | 'alien' | 'director';
  let personality: string | undefined;
  let stress: number | undefined;
  let agentId = '';
  let agentName = '';

  if ('id' in agent && 'personality' in agent) {
    // Marine
    const marine = agent as any; // Use any to access union properties
    agentType = 'marine';
    personality = marine.personality;
    stress = marine.stress;
    agentId = marine.id;
    agentName = marine.id;
  } else if ('position' in agent && 'hidden' in agent) {
    // Alien
    agentType = 'alien';
    agentId = 'alien';
    agentName = 'Alien';
  } else if ('adjustments' in agent) {
    // Director
    agentType = 'director';
    agentId = 'director';
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
};

// Optional: Function to execute agent turn (could be used by turnService)
export const executeAgentTurn = async (
  agent: Agent,
  memory: Event[],
  commanderMsg: string,
  zoneState: Zone,
  applyEvent: (event: any) => void // From eventService
): Promise<void> => {
  try {
    const action = await generateAgentAction(agent, memory, commanderMsg, zoneState);
    
    // Create event from action
    const event = {
      id: crypto.randomUUID(),
      tick: Date.now(),
      type: action.action,
      actor: agent.id,
      target: action.target || undefined,
      details: { reasoning: action.reasoning },
      result: undefined
    };
    
    // Apply the event to world state
    applyEvent(event);
    
  } catch (error) {
    console.error(`Error in agent turn for ${agent.name}:`, error);
    // Fallback: defensive action
    const fallbackEvent = {
      id: crypto.randomUUID(),
      tick: Date.now(),
      type: 'cover',
      actor: agent.id,
      target: null,
      details: { reasoning: 'Fallback: Taking cover due to error' },
      result: undefined
    };
    applyEvent(fallbackEvent);
  }
};