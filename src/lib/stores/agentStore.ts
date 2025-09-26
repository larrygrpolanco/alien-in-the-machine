import { derived, get } from 'svelte/store';
import { worldStore } from './worldStore';
import type { Entities, Marine, Alien, Director } from '../models/entities';

// Ensure agent has initialized location and inventory
export const ensureAgentDefaults = (agent: any): void => {
  let locationChanged = false;
  if (!agent.location) {
    agent.location = { id: 'default', items: [] };
    locationChanged = true;
  } else if (!agent.location.items) {
    agent.location.items = [];
    locationChanged = true;
  }

  let inventoryChanged = false;
  if (!agent.inventory) {
    agent.inventory = [];
    inventoryChanged = true;
  }

  if (locationChanged) {
    console.debug(`[AGENTSTORE] Initialized missing location for agent:`, agent);
  }
  if (inventoryChanged) {
    console.debug(`[AGENTSTORE] Initialized missing inventory for agent:`, agent);
  }

  // For marines specifically
  if ('id' in agent && !('position' in agent)) {
    agent.position = agent.location.id;
  }
};

export interface AgentsState {
  marines: Marine[];
  alien: Alien;
  director: Director;
}

export const agentStore = derived(worldStore, ($world: Entities) => {
  // Apply defaults to ensure no undefined states
  $world.agents.marines.forEach(ensureAgentDefaults);
  ensureAgentDefaults($world.agents.alien);
  ensureAgentDefaults($world.agents.director);

  return {
    marines: $world.agents.marines,
    alien: $world.agents.alien,
    director: $world.agents.director
  } as AgentsState;
});

export const getAgents = (): AgentsState => {
  return get(agentStore);
};

// Helper to get specific marine by ID
export const getMarineById = (id: string): Marine | undefined => {
  const agents = getAgents();
  return agents.marines.find(marine => marine.id === id);
};

// Helper to get all marine positions
export const getMarinePositions = (): Record<string, string> => {
  const agents = getAgents();
  return agents.marines.reduce((acc, marine) => {
    acc[marine.id] = marine.position;
    return acc;
  }, {} as Record<string, string>);
};

// Helper to check if marine is alive
export const isMarineAlive = (id: string): boolean => {
  const marine = getMarineById(id);
  return marine ? marine.health > 0 : false;
};

// Helper to get total surviving marines
export const getSurvivingMarinesCount = (): number => {
  const agents = getAgents();
  return agents.marines.filter(marine => marine.health > 0).length;
};

// Helper to get average marine stress
export const getAverageMarineStress = (): number => {
  const agents = getAgents();
  if (agents.marines.length === 0) return 0;
  const totalStress = agents.marines.reduce((sum, marine) => sum + marine.stress, 0);
  return totalStress / agents.marines.length;
};

// Helper to get alien visibility status
export const isAlienVisible = (): boolean => {
  const agents = getAgents();
  return !agents.alien.hidden;
};

// Helper to get director adjustments
export const getDirectorAdjustments = (): string[] => {
  const agents = getAgents();
  return agents.director.adjustments;
};

// Update agent stress (triggers worldStore update via event, but helper for convenience)
export const updateAgentStress = (agentId: string, stressChange: number): void => {
  // This would typically trigger an event, but for direct store access:
  const agents = getAgents();
  const marine = agents.marines.find(m => m.id === agentId);
  if (marine) {
    marine.stress = Math.max(0, Math.min(10, marine.stress + stressChange));
    // Note: In full implementation, this would append an event to eventStore
    // which would then update worldStore and propagate to agentStore
  }
};

// Check if any marine is in panic (stress > 7)
export const anyMarineInPanic = (): boolean => {
  const agents = getAgents();
  return agents.marines.some(marine => marine.stress > 7);
};

// Get marines in specific zone
export const getMarinesInZone = (zoneName: string): Marine[] => {
  const agents = getAgents();
  return agents.marines.filter(marine => marine.position === zoneName);
};