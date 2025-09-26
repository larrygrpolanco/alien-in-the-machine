import { derived, get } from 'svelte/store';
import { eventStore } from './eventStore';
import type { Event } from '../models/eventSchema';
import { initialEntities, validateAgent, type Agent, type Entities } from '../models/entities';

export const worldStore = derived(eventStore, ($events: Event[]) => {
  // Start with initial state
  let currentState: Entities = JSON.parse(JSON.stringify(initialEntities)); // Deep copy
  
  // Apply events in order to compute current state
  $events.forEach(event => {
    applyEventToState(event, currentState);
  });

  // Validate all agents for completeness (ensure inventory etc.)
  currentState.agents.marines.forEach((marine: Agent) => validateAgent(marine));
  validateAgent(currentState.agents.alien);
  validateAgent(currentState.agents.director);
  
  return currentState;
});

export const getWorldState = (): Entities => {
  return get(worldStore);
};

// Apply single event to mutate state (immutable in store, but for computation)
function applyEventToState(event: Event, state: Entities): void {
  switch (event.type) {
    case 'move':
      // Update agent position
      if (event.actor === 'alien') {
        state.agents.alien.position = event.target || event.details.to as string;
      } else {
        // Find marine by id
        const marine = state.agents.marines.find(m => m.id === event.actor);
        if (marine) {
          marine.position = event.target || event.details.to as string;
        }
      }
      break;

    case 'nudge':
      // Subtle Director action - increment marine stress in target area
      if (event.target) {
        const targetMarine = state.agents.marines.find(m => m.id === event.target || m.position === event.target);
        if (targetMarine) {
          targetMarine.stress = Math.min(10, targetMarine.stress + (0.5 + Math.random() * 0.5));
        }
      }
      break;

    case 'hunt':
      // Alien pursuit - move toward nearest marine, reduce hidden, increase stress
      if (event.target) {
        state.agents.alien.position = event.target;
        state.agents.alien.hidden = false;
        const targetMarine = state.agents.marines.find(m => m.id === event.target || m.position === event.target);
        if (targetMarine) {
          targetMarine.stress = Math.min(10, targetMarine.stress + 1);
        }
      }
      break;

    case 'lurk':
      // Alien stealth - set hidden, no position change
      state.agents.alien.hidden = true;
      // Log awareness (handled via console for now)
      console.log('Alien lurking, awareness increased');
      break;

    case 'stalk':
      // Similar to hunt but stealthier - partial move + monitor
      if (event.target) {
        state.agents.alien.position = event.target; // Partial move to target
        // Maintain some hidden status
        if (Math.random() > 0.5) {
          state.agents.alien.hidden = true;
        }
      }
      break;

    case 'hide':
      // Set hidden for agent (only alien has hidden prop)
      if (event.actor === 'alien') {
        state.agents.alien.hidden = true;
      } else {
        // For marines, increase stress as proxy for hiding
        const marine = state.agents.marines.find(m => m.id === event.actor);
        if (marine) {
          marine.stress = Math.min(10, marine.stress + 0.5);
        }
      }
      break;

    case 'escalate':
      // Increase global tension/stress, trigger alerts
      state.agents.marines.forEach(marine => {
        marine.stress = Math.min(10, marine.stress + 1);
      });
      // Global alert (could set state.tension += 1 if added to Entities)
      console.log('Escalation: Global tension increased');
      break;

    case 'reveal':
      // Set hidden false for agents (only alien has hidden prop)
      state.agents.alien.hidden = false;
      // For marines, reduce stress as proxy for reveal
      state.agents.marines.forEach(marine => {
        marine.stress = Math.max(0, marine.stress - 0.5);
      });
      break;

    case 'isolate':
      // Block marine movement in zone, increase isolation stress
      if (event.target) {
        const targetMarine = state.agents.marines.find(m => m.id === event.target);
        if (targetMarine) {
          targetMarine.stress = Math.min(10, targetMarine.stress + 1.5);
          targetMarine.position = event.target; // Lock to zone
        }
      }
      break;

    case 'panic':
      // Boost marine stress, random flee
      if (event.target) {
        const targetMarine = state.agents.marines.find(m => m.id === event.target);
        if (targetMarine) {
          targetMarine.stress = Math.min(10, targetMarine.stress + (2 + Math.random() * 1));
          // Random flee: move to adjacent zone (simplified)
          const zones = Object.keys(state.zones);
          const randomZone = zones[Math.floor(Math.random() * zones.length)];
          targetMarine.position = randomZone;
        }
      }
      break;
      
    case 'search':
      // Update item state to empty if searched
      if (event.target && event.details.zone) {
        const zone = state.zones[event.details.zone as keyof typeof state.zones];
        if (zone && zone.items && zone.items[event.target]) {
          zone.items[event.target].state = 'empty';
        }
      }
      break;
      
    case 'interact':
      // Handle item pickup (vial carriedBy), door unlock, etc.
      if (event.target === 'vial' && event.actor) {
        const medbay = state.zones['Medbay'];
        if (medbay && medbay.items && medbay.items['vial']) {
          medbay.items['vial'].carriedBy = event.actor;
          medbay.items['vial'].state = 'carried';
        }
      } else if (event.target === 'door' && event.details.unlocked) {
        const medbay = state.zones['Medbay'];
        if (medbay && medbay.items && medbay.items['door']) {
          medbay.items['door'].state = 'unlocked';
        }
      }
      // Handle vial drop in shuttle for win condition
      if (event.target === 'shuttleDrop' && event.actor) {
        const shuttle = state.zones['Shuttle'];
        if (shuttle && shuttle.items) {
          shuttle.items['vial'] = {
            state: 'present',
            carriedBy: null,
            yellowBlood: true
          };
        }
      }
      break;
      
    case 'attack':
      // Reduce health
      if (event.target && event.details.damage) {
        const damage = event.details.damage as number;
        if (event.target === 'alien') {
          // Alien health not tracked, but could set hidden false if hit
          state.agents.alien.hidden = false;
        } else {
          const marine = state.agents.marines.find(m => m.id === event.target);
          if (marine) {
            marine.health = Math.max(0, marine.health - damage);
          }
        }
      }
      break;
      
    case 'cover':
      // Increase stress for taking cover
      if (event.actor) {
        const marine = state.agents.marines.find(m => m.id === event.actor);
        if (marine) {
          marine.stress = Math.min(10, marine.stress + 1);
        }
      }
      break;
      
    case 'report':
    case 'message':
      // Messages handled in messageStore, no world state change
      break;
      
    case 'sneak':
    case 'ambush':
      // Alien movement/position updates
      if (event.target) {
        state.agents.alien.position = event.target;
        if (event.type === 'ambush') {
          state.agents.alien.hidden = false;
        }
      }
      break;
      
    case 'hazard':
      // Director adjustment - could add environmental effects
      if (event.details.hazardType) {
        // Example: lock doors, reduce visibility, etc.
        console.log(`Hazard applied: ${event.details.hazardType}`);
      }
      break;
      
    default:
      console.warn(`Unhandled event type: ${event.type}`);
  }
}

// Helper to get current agent positions for UI
export const getAgentPositions = (): Record<string, string> => {
  const state = getWorldState();
  const positions: Record<string, string> = {};
  
  state.agents.marines.forEach(marine => {
    positions[marine.id] = marine.position;
  });
  
  positions['alien'] = state.agents.alien.position;
  
  return positions;
};

// Helper to check if vial is in shuttle (win condition)
export const isVialInShuttle = (): boolean => {
  const state = getWorldState();
  const shuttle = state.zones['Shuttle'];
  return shuttle?.items?.['vial']?.state === 'present' || false;
};

// Helper to count surviving marines
export const countSurvivingMarines = (): number => {
  const state = getWorldState();
  return state.agents.marines.filter(m => m.health > 0).length;
};