import type { Agent, Marine, Alien, Director, Zone } from '../models/entities';
import type { Event } from '../models/eventSchema';

export interface PromptContext {
  agent: Agent;
  memory: Event[];
  commanderMsg: string;
  zoneState: Zone;
}

// Marine actions
const MARINE_ACTIONS = [
  { action: 'move', description: 'Move to an adjacent zone via connections', effects: 'Changes position, costs 1 turn, reveals new zone' },
  { action: 'search', description: 'Search containers/cabinets in current zone', effects: 'May find items/clues, empties searched containers, costs 1 turn' },
  { action: 'interact', description: 'Interact with objects (doors, consoles, vials)', effects: 'Unlock doors, pickup items, access consoles, costs 1 turn' },
  { action: 'attack', description: 'Attack visible threats (alien if visible)', effects: 'Deals damage but reveals position, increases stress, costs 1 turn' },
  { action: 'cover', description: 'Take defensive position', effects: 'Reduces chance of being ambushed, increases stress slightly, costs 1 turn' },
  { action: 'report', description: 'Report status and findings to commander', effects: 'Shares information, costs communication time, costs 1 turn' }
];

// Alien actions (asymmetric, stealth-focused)
const ALIEN_ACTIONS = [
  { action: 'sneak', description: 'Move stealthily between zones', effects: 'Maintains hidden status, repositioning for ambush, costs 1 turn' },
  { action: 'stalk', description: 'Observe marines without revealing position', effects: 'Gathers intel on marine positions, maintains hidden, costs 1 turn' },
  { action: 'ambush', description: 'Attack from hidden position', effects: 'Surprise attack with bonus damage, reveals position, costs 1 turn' },
  { action: 'hide', description: 'Find new hiding spot in current zone', effects: 'Regains hidden status, costs 1 turn' },
  { action: 'hunt', description: 'Track specific marine target', effects: 'Moves toward target marine, may reveal if careless, costs 1 turn' },
  { action: 'lurk', description: 'Wait in ambush position', effects: 'Prepares for optimal attack timing, maintains hidden, costs 1 turn' }
];

// Director actions (environmental control)
const DIRECTOR_ACTIONS = [
  { action: 'hazard', description: 'Introduce environmental hazard', effects: 'Locks doors, reduces visibility, creates obstacles, costs 1 adjustment' },
  { action: 'escalate', description: 'Increase game difficulty', effects: 'Boosts alien aggression, reduces marine compliance, costs 1 adjustment' },
  { action: 'nudge', description: 'Subtle narrative influence', effects: 'Alters agent perception slightly, creates plot tension, costs 1 adjustment' },
  { action: 'reveal', description: 'Provide subtle clue to marines', effects: 'Hints at alien location or item purpose, costs 1 adjustment' },
  { action: 'isolate', description: 'Separate marine team members', effects: 'Locks pathways, forces strategic decisions, costs 1 adjustment' },
  { action: 'panic', description: 'Trigger stress event', effects: 'Increases marine stress levels, may cause panic, costs 1 adjustment' }
];

export const assemblePrompt = (context: PromptContext): string => {
  const { agent, memory, commanderMsg, zoneState } = context;
  
  // Determine agent type for action list
  let actionsList: string;
  let personalityDescription = '';
  
  if ('id' in agent && 'personality' in agent) {
    // Marine
    const marine = agent as Marine;
    personalityDescription = marine.personality === 'aggressive' 
      ? 'You are aggressive and take bold actions, prioritizing mission completion over caution. Compliance: 70%.'
      : 'You are cautious and methodical, prioritizing team safety and information gathering. Compliance: 90%.';
    actionsList = MARINE_ACTIONS.map(a => `${a.action}: ${a.description} (${a.effects})`).join('\n');
  } else if ('position' in agent && 'hidden' in agent) {
    // Alien
    personalityDescription = 'You are the alien predator. You are stealthy, patient, and deadly. Your goal is to eliminate the marines while avoiding detection. You thrive in shadows and strike when least expected.';
    actionsList = ALIEN_ACTIONS.map(a => `${a.action}: ${a.description} (${a.effects})`).join('\n');
  } else if ('adjustments' in agent) {
    // Director
    personalityDescription = 'You are the Director overseeing the mission. Your goal is to create tension and challenge the marines without directly killing them. You control the environment and subtle narrative elements to create emergent storytelling.';
    actionsList = DIRECTOR_ACTIONS.map(a => `${a.action}: ${a.description} (${a.effects})`).join('\n');
  } else {
    personalityDescription = 'You are an agent in a tactical mission.';
    actionsList = MARINE_ACTIONS.map(a => `${a.action}: ${a.description} (${a.effects})`).join('\n');
  }
  
  // Recent memory summary (last 50 events)
  const recentEvents = memory.slice(-50).map(event => 
    `${event.actor} ${event.type}${event.target ? ` ${event.target}` : ''}`
  ).join(', ');
  
  // Visible items in current zone
  const visibleItems = zoneState.items 
    ? Object.entries(zoneState.items)
        .filter(([_, item]) => item.state !== 'hidden' && item.state !== 'empty')
        .map(([name, item]) => `${name} (${item.state}${item.carriedBy ? `, carried by ${item.carriedBy}` : ''})`)
        .join(', ')
    : 'none';
  
  // Agent name (fallback for alien/director)
  const agentName = 'id' in agent ? (agent as Marine).id : 
                   'position' in agent ? 'Alien' : 'Director';
  
  // Base stress/health info
  let statusInfo = '';
  if ('health' in agent && 'stress' in agent) {
    const marine = agent as Marine;
    statusInfo = `Health: ${marine.health}/10, Stress: ${marine.stress}/10`;
  }
  
  const prompt = `You are ${agentName}, ${personalityDescription}

${statusInfo ? `Current Status: ${statusInfo}` : ''}
Current Zone: ${zoneState.name}
Zone Connections: ${zoneState.connections.join(', ')}
Visible Items: ${visibleItems || 'none'}
${zoneState.branches ? `Zone Branches: ${zoneState.branches.join(', ')}` : ''}

Recent Events (last 50): ${recentEvents || 'none'}

Commander Orders: ${commanderMsg || 'No current orders'}

MARINE ACTIONS (choose ONE):
${actionsList}

Respond with ONLY valid JSON in this exact format - no other text:
{
  "action": "move|search|interact|attack|cover|report|sneak|ambush|hide|lurk|hazard|escalate|nudge|reveal|isolate|panic",
  "target": "zone name, item name, or agent ID (null if not applicable)",
  "reasoning": "Brief explanation of why you chose this action (1-2 sentences)"
}

Consider your personality, current stress/health, commander orders, and recent events when choosing your action.`;

  return prompt;
};

// Specialized prompt builders
export const buildMarinePrompt = (context: PromptContext): string => {
  return assemblePrompt(context);
};

export const buildAlienPrompt = (context: PromptContext): string => {
  // Add alien-specific context
  const alienContext = context;
  if ('hidden' in context.agent) {
    const alien = context.agent as Alien;
    return `${assemblePrompt(alienContext)}

ADDITIONAL ALIEN CONTEXT: You are currently ${alien.hidden ? 'hidden' : 'visible'}. Stealth is your greatest advantage.`;
  }
  return assemblePrompt(context);
};

export const buildDirectorPrompt = (context: PromptContext): string => {
  // Add director-specific context
  const directorContext = context;
  if ('adjustments' in context.agent) {
    const director = context.agent as Director;
    return `${assemblePrompt(directorContext)}

DIRECTOR CONTEXT: You have made ${director.adjustments.length} adjustments so far. Use them wisely to create tension without directly killing marines. Your adjustments: ${director.adjustments.join(', ') || 'none'}.`;
  }
  return assemblePrompt(context);
};

// Validate prompt length (for token limits)
export const validatePromptLength = (prompt: string, maxTokens: number = 2000): boolean => {
  // Rough estimation: 4 characters per token
  return prompt.length <= maxTokens * 4;
};

// Truncate prompt if too long
export const truncatePrompt = (prompt: string, maxTokens: number = 2000): string => {
  if (validatePromptLength(prompt, maxTokens)) {
    return prompt;
  }
  
  // Rough truncation: keep last maxTokens worth of characters
  const maxLength = maxTokens * 4;
  return prompt.slice(-maxLength);
};