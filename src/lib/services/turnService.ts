import { get } from 'svelte/store';
import { eventStore, appendEvent, pruneToLast } from '../stores/eventStore';
import { messageStore, addSystemMessage } from '../stores/messageStore';
import { agentStore, ensureAgentDefaults } from '../stores/agentStore';
import { worldStore } from '../stores/worldStore';
import { callLLM } from './llmClient';
import { assemblePrompt, buildDirectorPrompt, buildAlienPrompt, buildMarinePrompt } from './promptService';
import { validateAction, getFallbackAction } from './actionValidator';
import { generateAgentAction } from './agentService';
import type { Event, ValidatedEvent } from '../models/eventSchema';
import type { Agent, Marine, Alien, Director, Zone } from '../models/entities';
import type { AgentAction } from './llmClient';
import type { ValidatedAction } from './actionValidator';
import { generateEventId } from '../models/eventSchema';

// Turn counter
let currentTick = 0;
let subTick = 0; // Sub-tick for ordering within a turn

// Compliance probability calculation
const calculateCompliance = (personality: string, stress: number): number => {
  const baseCompliance = personality === 'aggressive' ? 0.7 : 0.9;
  const stressFactor = 1 - (stress / 10);
  const compliance = baseCompliance * Math.max(0.1, stressFactor);
  return Math.max(0.1, compliance);
};

// Generate event from validated action
const createEventFromAction = (action: ValidatedAction, agent: Agent, tick: number): Omit<Event, 'id'> => {
  return {
    tick,
    type: action.action as any, // Map action to event type
    actor: 'id' in agent ? (agent as Marine).id : agentTypeToActorName(agent),
    target: action.target,
    details: {
      agentType: agentTypeFromAgent(agent),
      personality: 'personality' in agent ? (agent as Marine).personality : undefined,
      stress: 'stress' in agent ? (agent as Marine).stress : undefined,
      reasoning: action.reasoning
    },
    result: undefined
  };
};

const agentTypeFromAgent = (agent: Agent): 'marine' | 'alien' | 'director' => {
  if ('id' in agent && 'personality' in agent) return 'marine';
  if ('position' in agent && 'hidden' in agent) return 'alien';
  if ('adjustments' in agent) return 'director';
  return 'marine'; // default
};

const agentTypeToActorName = (agent: Agent): string => {
  if ('id' in agent) return (agent as Marine).id;
  if ('position' in agent && 'hidden' in agent) return 'alien';
  return 'director';
};

// Process single agent turn
 const processAgentTurn = async (
   agent: Agent,
   zoneState: Zone,
   commanderMsg: string,
   tick: number,
   agentType: 'marine' | 'alien' | 'director'
 ): Promise<void> => {
   // Validate agent state before processing
   if (!agent) {
     console.warn(`[TURNSERVICE] Agent is undefined for ${agentType} turn ${tick}`);
     return;
   }

   // Ensure agent has location/inventory defaults
   ensureAgentDefaults(agent);

   // Validate and default zoneState
   let safeZoneState = zoneState;
   if (!zoneState) {
     console.warn(`[TURNSERVICE] zoneState is undefined for ${agentType} turn ${tick}, defaulting`);
     safeZoneState = { name: 'Unknown', connections: [], items: {} } as Zone;
   } else if (!zoneState.items) {
     console.warn(`[TURNSERVICE] zoneState.items is undefined for ${agentType} turn ${tick}, defaulting items`);
     safeZoneState = { ...zoneState, items: {} };
   }

   try {
     // Get recent memory (last 50 events)
     const recentEvents = pruneToLast(50);
     
     // Use agent service for generation and validation
     const validatedAction = await generateAgentAction(agent, recentEvents, commanderMsg, safeZoneState);
    
    // Check compliance for marines (post-generation)
    if (agentType === 'marine' && validatedAction.isValid) {
      const marine = agent as Marine;
      const compliance = calculateCompliance(marine.personality, marine.stress);
      if (Math.random() >= compliance) {
        // Non-compliant - override with fallback
        const fallbackAction = getFallbackAction(agentType, marine.personality, marine.stress);
        addSystemMessage(`${marine.id} disobeys orders: ${fallbackAction.reasoning}`);
        validatedAction.action = fallbackAction.action;
        validatedAction.target = fallbackAction.target;
        validatedAction.reasoning = fallbackAction.reasoning;
        validatedAction.isValid = false;
        validatedAction.fallbackUsed = true;
      }
    }
    
    // Create and append event
    const eventData = createEventFromAction(validatedAction, agent, tick);
    const event: ValidatedEvent = {
      id: generateEventId(),
      ...eventData
    };
    
    appendEvent(event);
    
    // Add message to stream
    const agentName = agentTypeToActorName(agent);
    const actionMsg = validatedAction.isValid
      ? `${agentName} performs ${validatedAction.action}${validatedAction.target ? ` on ${validatedAction.target}` : ''}: ${validatedAction.reasoning}`
      : `${agentName} fallback action ${validatedAction.action}: ${validatedAction.reasoning}`;
    
    addSystemMessage(actionMsg);
    
    // Apply event effects via eventService (assuming it exists)
    // For now, log and let worldStore derive
    console.log(`Turn ${tick} - ${agentName} [${validatedAction.action}] ${validatedAction.target ? `target: ${validatedAction.target}` : ''} - ${validatedAction.reasoning}`);
    
  } catch (error: any) {
    console.error(`Error processing ${agentTypeToActorName(agent)} turn:`, error);
    
    // Fallback event for error cases
    const fallbackEvent: Omit<Event, 'id'> = {
      tick,
      type: agentType === 'marine' ? 'report' : agentType === 'alien' ? 'sneak' : 'hazard',
      actor: agentTypeToActorName(agent),
      target: undefined,
      details: { error: error.message, status: 'fallback' },
      result: undefined
    };
    
    const errorEvent: ValidatedEvent = {
      id: generateEventId(),
      ...fallbackEvent
    };
    
    appendEvent(errorEvent);
    addSystemMessage(`${agentTypeToActorName(agent)} error - fallback action taken: ${error.message}`);
  }
};

// Main turn advancement function
export const advanceTurn = async (commanderMsg: string = ''): Promise<void> => {
  currentTick++;
  subTick = 0; // Reset sub-tick for new turn
  
  const agents = get(agentStore);
  const worldState = get(worldStore);
  
  addSystemMessage(`=== TURN ${currentTick} ===`);
  if (commanderMsg) {
    addSystemMessage(`Commander: ${commanderMsg}`);
  }
  
  try {
    // Phase 1: Director acts first (environmental control)
    console.log('Director turn...');
    const directorZone = worldState.zones['Command'] || { name: 'Command', connections: [], items: {} } as Zone; // Director "observes" from Command
    await processAgentTurn(agents.director, directorZone, commanderMsg, currentTick * 100 + subTick++, 'director');
    
    // Phase 2: Alien acts (stealth predator)
    console.log('Alien turn...');
    const alienZone = worldState.zones[agents.alien.position] || { name: agents.alien.position || 'Unknown', connections: [], items: {} } as Zone;
    await processAgentTurn(agents.alien, alienZone, commanderMsg, currentTick * 100 + subTick++, 'alien');
    
    // Phase 3: Marines act (by speed/initiative order)
    console.log('Marine turns...');
    // Sort marines by speed (aggressive first, then cautious)
    const sortedMarines = [...agents.marines].sort((a, b) => {
      if (a.personality === 'aggressive' && b.personality === 'cautious') return -1;
      if (a.personality === 'cautious' && b.personality === 'aggressive') return 1;
      return 0; // Same personality, arbitrary order
    });
    
    for (const marine of sortedMarines) {
      // Check if marine is alive
      if (marine.health <= 0) {
        addSystemMessage(`${marine.id} is dead - skipping turn`);
        continue;
      }
      
      const marineZone = worldState.zones[marine.position] || { name: marine.position || 'Unknown', connections: [], items: {} } as Zone;
      await processAgentTurn(marine, marineZone, commanderMsg, currentTick * 100 + subTick++, 'marine');
      
      // Small delay between marine actions for readability
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // End of turn processing
    addSystemMessage(`Turn ${currentTick} complete`);
    
    // Check win/lose conditions
    const survivingMarines = worldState.agents.marines.filter(m => m.health > 0).length;
    const vialInShuttle = worldState.zones['Shuttle']?.items?.['vial']?.state === 'present';
    
    if (vialInShuttle && survivingMarines > 0) {
      addSystemMessage('WIN CONDITION: Yellow vial secured in shuttle! Mission success - the alien threat is contained.');
      // Could set game over flag or stop turns
      console.log('GAME OVER: Victory!');
    } else if (survivingMarines === 0) {
      addSystemMessage('LOSE CONDITION: All marines eliminated. The alien has overrun the station.');
      // Could set game over flag
      console.log('GAME OVER: Defeat!');
    }
    
    // Trigger any end-of-turn effects (would use eventService)
    // For example: stress accumulation, alien hiding, etc.
    
  } catch (error) {
    console.error('Critical error in turn processing:', error);
    addSystemMessage(`CRITICAL: Turn ${currentTick} failed - ${error}`);
  }
};

// Get current turn number
export const getCurrentTurn = (): number => currentTick;

// Reset turn counter (for testing)
export const resetTurnCounter = (): void => {
  currentTick = 0;
};

// Simulate multiple turns
export const simulateTurns = async (numTurns: number, commanderMsg?: string): Promise<void> => {
  for (let i = 0; i < numTurns; i++) {
    await advanceTurn(commanderMsg || '');
    // Wait between turns for async processing
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};

// Get turn summary
export const getTurnSummary = (): string => {
  const eventsThisTurn = get(eventStore).filter(event => event.tick === currentTick);
  return `Turn ${currentTick}: ${eventsThisTurn.length} events processed`;
};

// Marine speed/initiative calculation
export const calculateMarineInitiative = (marine: Marine): number => {
  // Aggressive marines act first (higher initiative)
  const personalityBonus = marine.personality === 'aggressive' ? 2 : 1;
  // Stress reduces initiative
  const stressPenalty = Math.max(0, (marine.stress - 5) / 2);
  // Health affects performance
  const healthBonus = Math.floor(marine.health / 2);
  
  return personalityBonus - stressPenalty + healthBonus;
};

// Director adjustment tracking
let directorAdjustmentsUsed = 0;
const MAX_DIRECTOR_ADJUSTMENTS = 5;

export const canDirectorAdjust = (): boolean => {
  return directorAdjustmentsUsed < MAX_DIRECTOR_ADJUSTMENTS;
};

export const useDirectorAdjustment = (): boolean => {
  if (canDirectorAdjust()) {
    directorAdjustmentsUsed++;
    return true;
  }
  return false;
};