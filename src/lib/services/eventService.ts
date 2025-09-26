import { get, writable } from 'svelte/store';
import { eventStore } from '../stores/eventStore';
import { messageStore, addMessage } from '../stores/messageStore';
import { worldStore } from '../stores/worldStore';
import { agentStore } from '../stores/agentStore';
import type { Event } from '../models/eventSchema';
import type { Entities, Zone, Item, Marine } from '../models/entities';
import { EventSchema, validateEvent } from '../models/eventSchema';
import { connections } from '../models/entities';

// Temporary writable world state for direct mutation (since derived stores are read-only)
let _worldState: Entities;
worldStore.subscribe(state => {
  _worldState = state;
});

// Apply single event to world state
export const applyEvent = (event: Event): void => {
  // Validate event schema
  const validatedEvent = validateEvent(event);
  
  // Update event store (for audit trail)
  const currentEvents = get(eventStore);
  if (!currentEvents.some(e => e.id === validatedEvent.id)) {
    // Only append if not already present (idempotency)
    eventStore.update(events => [...events, validatedEvent]);
  }
  
  // Apply event effects based on type
  switch (validatedEvent.type) {
    case 'move':
      handleMoveEvent(validatedEvent);
      break;
      
    case 'search':
      handleSearchEvent(validatedEvent);
      break;
      
    case 'interact':
      handleInteractEvent(validatedEvent);
      break;
      
    case 'attack':
      handleAttackEvent(validatedEvent);
      break;
      
    case 'cover':
      handleCoverEvent(validatedEvent);
      break;
      
    case 'report':
    case 'message':
      handleMessageEvent(validatedEvent);
      break;
      
    case 'sneak':
      handleSneakEvent(validatedEvent);
      break;
      
    case 'ambush':
      handleAmbushEvent(validatedEvent);
      break;
      
    case 'hazard':
      handleHazardEvent(validatedEvent);
      break;
      
    default:
      console.warn(`Unhandled event type: ${validatedEvent.type}`);
      validatedEvent.result = { success: false, error: 'Unknown event type' };
  }
  
  // Update result in event (for audit)
  if (!validatedEvent.result) {
    validatedEvent.result = { success: true };
  }
  
  // Trigger reactivity by updating stores
  // Note: In full implementation, worldStore would recompute from events
  // For now, we manually trigger updates
  triggerStoreUpdates();
};

const handleMoveEvent = (event: Event): void => {
  const actor = event.actor;
  const targetZone = event.target;
  
  if (!targetZone || !_worldState) return;
  
  // Validate move is to connected zone
  const currentZoneName = getAgentPosition(actor);
  if (!currentZoneName) return;
  
  const currentZone = _worldState.zones[currentZoneName];
  if (!currentZone || !currentZone.connections.includes(targetZone)) {
    event.result = { success: false, error: 'Invalid move - zones not connected' };
    return;
  }
  
  // Update agent position
  if (actor === 'alien') {
    _worldState.agents.alien.position = targetZone;
    if (event.details?.maintainHidden !== false) {
      _worldState.agents.alien.hidden = true; // Sneaking maintains hidden status
    }
  } else {
    // Marine
    const marine = _worldState.agents.marines.find(m => m.id === actor);
    if (marine) {
      marine.position = targetZone;
      // Moving increases stress slightly
      marine.stress = Math.min(10, marine.stress + 0.5);
    }
  }
  
  event.result = { success: true, from: currentZoneName, to: targetZone };
  addMessage(actor, `${actor} moves to ${targetZone}`);
};

const handleSearchEvent = (event: Event): void => {
  const targetItem = event.target;
  const zoneName = event.details?.zone as string;
  
  if (!targetItem || !zoneName || !_worldState) return;
  
  const zone = _worldState.zones[zoneName];
  if (!zone?.items?.[targetItem]) {
    event.result = { success: false, error: 'Target item not found in zone' };
    return;
  }
  
  const item = zone.items[targetItem];
  if (item.state === 'empty') {
    event.result = { success: false, error: 'Item already searched' };
    return;
  }
  
  // Empty the item
  item.state = 'empty';
  
  // Add stress for searching
  const marine = getMarineByActor(event.actor);
  if (marine) {
    marine.stress = Math.min(10, marine.stress + 1);
  }
  
  // Possible findings (for now, just log)
  const findings = item.contents || ['nothing'];
  event.result = { 
    success: true, 
    item: targetItem, 
    findings: findings.length > 0 ? findings : ['empty'],
    zone: zoneName 
  };
  
  addMessage(event.actor, `${event.actor} searches ${targetItem} in ${zoneName}: ${findings.join(', ') || 'nothing found'}`);
};

const handleInteractEvent = (event: Event): void => {
  const targetItem = event.target;
  const zoneName = event.details?.zone as string;
  const interactionType = event.details?.type as 'pickup' | 'unlock' | 'use';
  
  if (!targetItem || !zoneName || !_worldState) return;
  
  const zone = _worldState.zones[zoneName];
  if (!zone?.items?.[targetItem]) {
    event.result = { success: false, error: 'Target item not found' };
    return;
  }
  
  const item = zone.items[targetItem];
  
  switch (interactionType) {
    case 'pickup':
      if (item.state === 'present' && !item.carriedBy) {
        // Pickup vial or other carryable items
        if (targetItem === 'vial') {
          item.carriedBy = event.actor;
          item.state = 'carried';
          // Add to marine inventory
          const marine = getMarineByActor(event.actor);
          if (marine) {
            marine.inventory.push('vial');
          }
          event.result = { success: true, item: 'vial', action: 'picked up' };
          addMessage(event.actor, `${event.actor} picks up vial from ${zoneName}`);
        } else {
          event.result = { success: false, error: 'Item not carryable' };
        }
      } else {
        event.result = { success: false, error: 'Cannot pickup item' };
      }
      break;
      
    case 'unlock':
      if (item.state === 'locked') {
        item.state = 'unlocked';
        event.result = { success: true, item: targetItem, action: 'unlocked' };
        addMessage(event.actor, `${event.actor} unlocks ${targetItem} in ${zoneName}`);
      } else {
        event.result = { success: false, error: 'Item not locked' };
      }
      break;
      
    case 'use':
      // Console access, health kit use, etc.
      if (targetItem === 'console' && item.state === 'unlocked') {
        // Simulate console access
        item.state = 'accessed';
        event.result = { success: true, item: 'console', action: 'accessed', data: 'mission logs retrieved' };
        addMessage(event.actor, `${event.actor} accesses ${targetItem} in ${zoneName}: mission logs retrieved`);
      } else if (targetItem === 'healthKits' && item.state === 'full') {
        const marine = getMarineByActor(event.actor);
        if (marine && marine.health < 10) {
          const healing = Math.min(3, 10 - marine.health);
          marine.health += healing;
          item.state = 'used';
          event.result = { success: true, item: 'healthKits', action: 'used', healing };
          addMessage(event.actor, `${event.actor} uses health kit: +${healing} health`);
        }
      } else {
        event.result = { success: false, error: 'Cannot use item' };
      }
      break;
      
    default:
      event.result = { success: false, error: 'Unknown interaction type' };
  }
};

const handleAttackEvent = (event: Event): void => {
  const target = event.target;
  const damage = event.details?.damage as number || 2;
  const attacker = event.actor;
  
  if (!target || !_worldState) return;
  
  let success = false;
  
  if (target === 'alien') {
    // Marine attacks alien
    if (!get(agentStore).alien.hidden) {
      // Only if alien is visible
      _worldState.agents.alien.hidden = false; // Reveal alien
      success = true;
      addMessage(attacker, `${attacker} attacks alien: ${damage} damage`);
    } else {
      addMessage(attacker, `${attacker} attacks shadows: alien not visible`);
    }
  } else {
    // Alien attacks marine or marine attacks marine (friendly fire)
    const targetMarine = _worldState.agents.marines.find(m => m.id === target);
    if (targetMarine) {
      targetMarine.health = Math.max(0, targetMarine.health - damage);
      success = true;
      
      if (targetMarine.health <= 0) {
        addMessage('SYSTEM', `${target} has been killed!`);
        // Remove from active agents if needed
      } else {
        addMessage(attacker, `${attacker} attacks ${target}: ${damage} damage`);
        addMessage(target, `${target} takes ${damage} damage!`);
      }
      
      // Attacker stress increases
      const attackerMarine = getMarineByActor(attacker);
      if (attackerMarine) {
        attackerMarine.stress = Math.min(10, attackerMarine.stress + 2);
      }
    }
  }
  
  event.result = { success, target, damage, attacker };
};

const handleCoverEvent = (event: Event): void => {
  const actor = event.actor;
  const marine = getMarineByActor(actor);
  
  if (marine) {
    // Taking cover increases stress but provides defense bonus
    marine.stress = Math.min(10, marine.stress + 1);
    // In full implementation, would set defensive status
    event.result = { success: true, actor, effect: 'defensive position taken' };
    addMessage(actor, `${actor} takes cover - stress +1`);
  } else {
    event.result = { success: false, error: 'Invalid actor for cover action' };
  }
};

const handleMessageEvent = (event: Event): void => {
  const actor = event.actor;
  const content = (event.details?.message as string) || 'Status report';
  
  // Add to message stream
  addMessage(actor, content);
  
  // Messages don't change world state, just communication
  event.result = { success: true, actor, content, type: 'communication' };
};

const handleSneakEvent = (event: Event): void => {
  const targetZone = event.target;
  
  if (targetZone) {
    // Alien sneaking to new zone
    _worldState.agents.alien.position = targetZone;
    _worldState.agents.alien.hidden = true; // Sneaking maintains hidden status
    
    // Validate connections
    const currentZone = _worldState.zones[_worldState.agents.alien.position];
    if (currentZone && !currentZone.connections.includes(targetZone)) {
      event.result = { success: false, error: 'Invalid sneak path' };
      return;
    }
    
    event.result = { success: true, from: event.details?.from, to: targetZone, hidden: true };
    addMessage('ALIEN', `Alien sneaks to ${targetZone} (hidden)`);
  } else {
    event.result = { success: false, error: 'Sneak requires target zone' };
  }
};

const handleAmbushEvent = (event: Event): void => {
  const targetMarine = event.target;
  const damage = event.details?.damage as number || 3; // Ambush bonus damage
  
  if (targetMarine && _worldState) {
    const target = _worldState.agents.marines.find(m => m.id === targetMarine);
    if (target) {
      // Ambush from hidden position
      if (_worldState.agents.alien.hidden) {
        target.health = Math.max(0, target.health - damage);
        _worldState.agents.alien.hidden = false; // Reveal after attack
        
        event.result = { success: true, target: targetMarine, damage, revealed: true };
        
        if (target.health <= 0) {
          addMessage('SYSTEM', `Ambush! ${targetMarine} killed by alien!`);
        } else {
          addMessage('ALIEN', `Ambush on ${targetMarine}: ${damage} damage!`);
          addMessage(targetMarine, `${targetMarine} ambushed! Health: ${target.health}`);
        }
      } else {
        event.result = { success: false, error: 'Alien must be hidden for ambush' };
      }
    }
  } else {
    event.result = { success: false, error: 'Invalid ambush target' };
  }
};

const handleHazardEvent = (event: Event): void => {
  const hazardType = event.details?.type as string;
  const targetZone = event.target;
  
  if (hazardType && _worldState) {
    switch (hazardType) {
      case 'lock_doors':
        // Lock doors in target zone or globally
        if (targetZone) {
          const zone = _worldState.zones[targetZone];
          if (zone?.items?.door) {
            zone.items.door.state = 'locked';
            event.result = { success: true, zone: targetZone, hazard: 'doors locked' };
            addMessage('DIRECTOR', `Hazard: Doors locked in ${targetZone}`);
          }
        }
        break;
        
      case 'reduce_visibility':
        // Global effect - marines stress increases
        _worldState.agents.marines.forEach(marine => {
          marine.stress = Math.min(10, marine.stress + 1);
        });
        event.result = { success: true, hazard: 'visibility reduced', affected: 'all marines' };
        addMessage('DIRECTOR', 'Hazard: Lights dimmed - visibility reduced');
        break;
        
      case 'environmental':
        // Random environmental effect
        event.result = { success: true, hazard: 'environmental', type: 'random' };
        addMessage('DIRECTOR', 'Hazard: Environmental instability detected');
        break;
        
      default:
        event.result = { success: false, error: 'Unknown hazard type' };
    }
  } else {
    event.result = { success: false, error: 'Invalid hazard event' };
  }
};

// Helper functions
const getAgentPosition = (actor: string): string | null => {
  const agents = get(agentStore);
  const marine = agents.marines.find(m => m.id === actor);
  if (marine) return marine.position;
  if (actor === 'alien') return agents.alien.position;
  return null;
};

const getMarineByActor = (actor: string): Marine | null => {
  const agents = get(agentStore);
  return agents.marines.find(m => m.id === actor) || null;
};

const getZoneByName = (zoneName: string): Zone | null => {
  const world = get(worldStore);
  return world.zones[zoneName as keyof typeof world.zones] || null;
};

const triggerStoreUpdates = (): void => {
  // Force reactivity by updating stores
  // In full Svelte implementation, derived stores would automatically update
  // For now, we can trigger a dummy update
  const dummy = writable(0);
  dummy.set(Date.now());
  
  // The worldStore should recompute from events in ideal implementation
  console.log('Event applied - stores updated');
};

// Validate event before applying (beyond schema validation)
export const validateEventContext = (event: Event): boolean => {
  switch (event.type) {
    case 'move':
      if (!event.target) return false;
      const currentPos = getAgentPosition(event.actor);
      if (!currentPos) return false;
      const currentZone = getZoneByName(currentPos);
      if (!currentZone?.connections.includes(event.target)) return false;
      return true;
      
    case 'search':
    case 'interact':
      if (!event.target) return false;
      const searchPos = getAgentPosition(event.actor);
      if (!searchPos) return false;
      const searchZone = getZoneByName(searchPos);
      if (!searchZone?.items?.[event.target]) return false;
      return true;
      
    case 'attack':
      if (!event.target) return false;
      // Validate target exists and is attackable
      return event.target === 'alien' || _worldState?.agents.marines.some(m => m.id === event.target);
      
    default:
      return true; // Most events don't need complex validation
  }
};

// Batch apply multiple events (for turn processing)
export const applyEventsBatch = (events: Event[]): void => {
  events.forEach(event => {
    if (validateEventContext(event)) {
      applyEvent(event);
    } else {
      console.warn(`Event validation failed:`, event);
    }
  });
};

// Recompute world state from all events (for consistency)
export const recomputeWorldState = (): void => {
  // This would reset and replay all events
  // For now, just log
  console.log('World state recomputation triggered');
};

// Event application audit
let applicationStats = { total: 0, successful: 0, failed: 0, types: {} as Record<string, number> };

export const getApplicationStats = (): typeof applicationStats => applicationStats;