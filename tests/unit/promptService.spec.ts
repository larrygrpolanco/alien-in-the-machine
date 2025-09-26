import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assemblePrompt,
  buildMarinePrompt,
  buildAlienPrompt,
  buildDirectorPrompt,
  validatePromptLength,
  truncatePrompt,
  type PromptContext
} from '../../src/lib/services/promptService';
import type { Marine, Alien, Director, Zone } from '../../src/lib/models/entities';
import type { Event } from '../../src/lib/models/eventSchema';

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
  adjustments: ['hazard', 'escalate']
};

const mockZone: Zone = {
  name: 'Shuttle',
  connections: ['Shuttle Bay'],
  items: {
    healthKits: { state: 'full' },
    console: { state: 'locked' }
  }
};

const mockEvents: Event[] = [
  { id: 'e1', tick: 1, type: 'move', actor: 'hudson', details: { to: 'Shuttle Bay' } },
  { id: 'e2', tick: 2, type: 'search', actor: 'hudson', target: 'console', details: { zone: 'Shuttle Bay' } },
  { id: 'e3', tick: 3, type: 'report', actor: 'hudson', details: { status: 'all clear' } }
];

const mockContext: PromptContext = {
  agent: mockMarine,
  memory: mockEvents,
  commanderMsg: 'Search the shuttle bay for clues',
  zoneState: mockZone
};

describe('promptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assemblePrompt', () => {
    it('should assemble prompt for marine agent', () => {
      const prompt = assemblePrompt(mockContext);

      expect(prompt).toContain('You are hudson, You are aggressive and take bold actions, prioritizing mission completion over caution. Compliance: 70%.');
      expect(prompt).toContain('Current Status: Health: 10/10, Stress: 2/10');
      expect(prompt).toContain('Current Zone: Shuttle');
      expect(prompt).toContain('Zone Connections: Shuttle Bay');
      expect(prompt).toContain('Visible Items: healthKits (full), console (locked)');
      expect(prompt).toContain('Recent Events (last 50): hudson move, hudson search console, hudson report');
      expect(prompt).toContain('Commander Orders: Search the shuttle bay for clues');
      expect(prompt).toContain('MARINE ACTIONS (choose ONE):');
      expect(prompt).toContain('move: Move to an adjacent zone via connections');
      expect(prompt).toContain('search: Search containers/cabinets in current zone');
      expect(prompt).toContain('Respond with ONLY valid JSON in this exact format');
      expect(prompt).toContain('"action": "move|search|interact|attack|cover|report|sneak|ambush|hide|lurk|hazard|escalate|nudge|reveal|isolate|panic"');
    });

    it('should assemble prompt for alien agent', () => {
      const alienContext: PromptContext = {
        ...mockContext,
        agent: mockAlien
      };

      const prompt = assemblePrompt(alienContext);

      expect(prompt).toContain('You are Alien, You are the alien predator. You are stealthy, patient, and deadly.');
      expect(prompt).not.toContain('Current Status: Health'); // No health for alien
      expect(prompt).toContain('ALIEN ACTIONS (choose ONE):');
      expect(prompt).toContain('sneak: Move stealthily between zones');
      expect(prompt).toContain('ambush: Attack from hidden position');
      expect(prompt).toContain('Commander Orders: Search the shuttle bay for clues'); // Still includes commander msg
    });

    it('should assemble prompt for director agent', () => {
      const directorContext: PromptContext = {
        ...mockContext,
        agent: mockDirector
      };

      const prompt = assemblePrompt(directorContext);

      expect(prompt).toContain('You are Director, You are the Director overseeing the mission.');
      expect(prompt).not.toContain('Current Status: Health'); // No health for director
      expect(prompt).toContain('DIRECTOR ACTIONS (choose ONE):');
      expect(prompt).toContain('hazard: Introduce environmental hazard');
      expect(prompt).toContain('panic: Trigger stress event');
      expect(prompt).toContain('Commander Orders: Search the shuttle bay for clues'); // Still includes
    });

    it('should handle empty recent events', () => {
      const emptyContext: PromptContext = {
        ...mockContext,
        memory: []
      };

      const prompt = assemblePrompt(emptyContext);

      expect(prompt).toContain('Recent Events (last 50): none');
    });

    it('should handle zone with no items', () => {
      const emptyZone: Zone = {
        name: 'Empty Zone',
        connections: []
      };

      const emptyContext: PromptContext = {
        ...mockContext,
        zoneState: emptyZone
      };

      const prompt = assemblePrompt(emptyContext);

      expect(prompt).toContain('Visible Items: none');
    });

    it('should handle undefined agent inventory with defensive defaults', () => {
      const agentWithoutInventory = { ...mockMarine, inventory: undefined };
      const contextWithoutInventory: PromptContext = {
        ...mockContext,
        agent: agentWithoutInventory as any
      };

      // Mock console.warn to verify warning logged
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const prompt = assemblePrompt(contextWithoutInventory);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PROMPT] Missing inventory for agent hudson')
      );
      
      // Should not throw TypeError, continue with default empty inventory
      expect(prompt).toContain('Inventory: empty');
      expect(prompt).toContain('You are hudson');
      
      // Agent should now have default inventory structure
      const anyAgent = agentWithoutInventory as any;
      expect(anyAgent.inventory).toEqual({ items: [] });
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle invalid inventory structure and normalize', () => {
      const agentWithInvalidInventory = { ...mockMarine, inventory: 'invalid' };
      const contextWithInvalid: PromptContext = {
        ...mockContext,
        agent: agentWithInvalidInventory as any
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const prompt = assemblePrompt(contextWithInvalid);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PROMPT] Invalid inventory for agent hudson:')
      );
      
      expect(prompt).toContain('Inventory: empty');
      
      // Should normalize to proper structure
      const anyAgent = agentWithInvalidInventory as any;
      expect(anyAgent.inventory).toEqual({ items: [] });
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle array inventory without items wrapper', () => {
      const agentWithArrayInventory = { ...mockMarine, inventory: ['vial'] };
      const contextWithArray: PromptContext = {
        ...mockContext,
        agent: agentWithArrayInventory as any
      };

      const prompt = assemblePrompt(contextWithArray);

      expect(prompt).toContain('Inventory: vial');
      
      // Should wrap array in { items: [...] } structure
      const anyAgent = agentWithArrayInventory as any;
      expect(anyAgent.inventory).toEqual({ items: ['vial'] });
    });

    it('should handle hidden/empty items correctly', () => {
      const zoneWithHidden: Zone = {
        ...mockZone,
        items: {
          healthKits: { state: 'full' },
          hiddenItem: { state: 'hidden' },
          emptyCabinet: { state: 'empty' },
          carriedVial: { state: 'carried', carriedBy: 'hudson' }
        }
      };

      const contextWithHidden: PromptContext = {
        ...mockContext,
        zoneState: zoneWithHidden
      };

      const prompt = assemblePrompt(contextWithHidden);

      expect(prompt).toContain('Visible Items: healthKits (full), carriedVial (carried, carried by hudson)');
      expect(prompt).not.toContain('hiddenItem');
      expect(prompt).not.toContain('emptyCabinet');
    });

    it('should truncate long recent events summary', () => {
      const longEvents: Event[] = Array.from({ length: 100 }, (_, i) => ({
        id: `e${i}`,
        tick: i + 1,
        type: 'move',
        actor: 'hudson',
        details: { to: `zone${i % 10}` }
      }));

      const longContext: PromptContext = {
        ...mockContext,
        memory: longEvents
      };

      const prompt = assemblePrompt(longContext);

      // Should only show last 50 events
      expect(longEvents.slice(0, 50).some(event =>
        !prompt.includes(`${event.actor} ${event.type}`)
      )).toBe(true); // Some early events not included
      
      expect(longEvents.slice(-50).every(event =>
        prompt.includes(`${event.actor} ${event.type}`)
      )).toBe(true); // Last 50 events included
    });
  });

  describe('specialized prompt builders', () => {
    it('should build marine prompt (same as assemble)', () => {
      const marinePrompt = buildMarinePrompt(mockContext);
      const assemblePromptResult = assemblePrompt(mockContext);

      expect(marinePrompt).toBe(assemblePromptResult); // Just calls assemblePrompt
      expect(marinePrompt).toContain('You are hudson');
      expect(marinePrompt).toContain('MARINE ACTIONS');
    });

    it('should build alien prompt with additional context', () => {
      const alienContext: PromptContext = {
        ...mockContext,
        agent: mockAlien
      };

      const alienPrompt = buildAlienPrompt(alienContext);

      expect(alienPrompt).toContain('You are the alien predator');
      expect(alienPrompt).toContain('ALIEN ACTIONS');
      expect(alienPrompt).toContain('ADDITIONAL ALIEN CONTEXT: You are currently hidden');
      expect(alienPrompt).toContain('Stealth is your greatest advantage');
    });

    it('should build director prompt with adjustment context', () => {
      const directorContext: PromptContext = {
        ...mockContext,
        agent: mockDirector
      };

      const directorPrompt = buildDirectorPrompt(directorContext);

      expect(directorPrompt).toContain('You are the Director overseeing the mission');
      expect(directorPrompt).toContain('DIRECTOR ACTIONS');
      expect(directorPrompt).toContain('DIRECTOR CONTEXT: You have made 2 adjustments so far');
      expect(directorPrompt).toContain('Your adjustments: hazard, escalate');
      expect(directorPrompt).toContain('create tension without directly killing marines');
    });

    it('should handle non-alien agent in buildAlienPrompt', () => {
      const marinePrompt = buildAlienPrompt(mockContext); // Should fallback to assemblePrompt

      expect(marinePrompt).toContain('You are hudson');
      expect(marinePrompt).not.toContain('ADDITIONAL ALIEN CONTEXT');
    });

    it('should handle non-director agent in buildDirectorPrompt', () => {
      const marinePrompt = buildDirectorPrompt(mockContext); // Should fallback

      expect(marinePrompt).toContain('You are hudson');
      expect(marinePrompt).not.toContain('DIRECTOR CONTEXT');
    });
  });

  describe('prompt length validation and truncation', () => {
    it('should validate prompt length correctly', () => {
      const shortPrompt = 'Short prompt';
      const longPrompt = 'Very long prompt that exceeds the token limit estimation '.repeat(1000);

      expect(validatePromptLength(shortPrompt, 100)).toBe(true);
      expect(validatePromptLength(longPrompt, 100)).toBe(false);
      
      // Rough 4 chars per token estimation
      expect(validatePromptLength(longPrompt, Math.ceil(longPrompt.length / 4) + 1)).toBe(true);
    });

    it('should truncate long prompts', () => {
      const longPrompt = 'This is a very long prompt that needs truncation '.repeat(500);
      
      const truncated = truncatePrompt(longPrompt, 100); // ~100 tokens = 400 chars
      
      expect(truncated.length).toBeLessThanOrEqual(400);
      expect(truncated).toContain(longPrompt.slice(-100)); // Should keep end of prompt
      expect(truncated).not.toEqual(longPrompt); // Actually truncated
    });

    it('should not truncate short prompts', () => {
      const shortPrompt = 'Short prompt that fits within limits';
      
      const result = truncatePrompt(shortPrompt, 1000);
      
      expect(result).toBe(shortPrompt); // Unchanged
    });

    it('should handle edge case: empty prompt', () => {
      expect(validatePromptLength('', 100)).toBe(true);
      expect(truncatePrompt('')).toBe('');
    });

    it('should handle maximum length exactly', () => {
      const maxLengthPrompt = 'a'.repeat(4000); // Exactly 1000 tokens at 4 chars/token
      
      expect(validatePromptLength(maxLengthPrompt, 1000)).toBe(true);
      expect(truncatePrompt(maxLengthPrompt, 1000)).toBe(maxLengthPrompt);
      
      const overLimit = maxLengthPrompt + 'extra';
      expect(validatePromptLength(overLimit, 1000)).toBe(false);
      expect(truncatePrompt(overLimit, 1000).length).toBe(4000);
    });
  });

  describe('action lists', () => {
    it('should include all marine actions in marine prompt', () => {
      const prompt = assemblePrompt(mockContext);
      
      const marineActions = [
        'move', 'search', 'interact', 'attack', 'cover', 'report'
      ];
      
      marineActions.forEach(action => {
        expect(prompt).toContain(action + ':');
      });
      
      expect(prompt).toContain('Changes position, costs 1 turn');
      expect(prompt).toContain('May find items/clues');
    });

    it('should include all alien actions in alien prompt', () => {
      const alienContext: PromptContext = {
        ...mockContext,
        agent: mockAlien
      };

      const prompt = assemblePrompt(alienContext);
      
      const alienActions = [
        'sneak', 'stalk', 'ambush', 'hide', 'hunt', 'lurk'
      ];
      
      alienActions.forEach(action => {
        expect(prompt).toContain(action + ':');
      });
      
      expect(prompt).toContain('Maintains hidden status');
      expect(prompt).toContain('Surprise attack with bonus damage');
    });

    it('should include all director actions in director prompt', () => {
      const directorContext: PromptContext = {
        ...mockContext,
        agent: mockDirector
      };

      const prompt = assemblePrompt(directorContext);
      
      const directorActions = [
        'hazard', 'escalate', 'nudge', 'reveal', 'isolate', 'panic'
      ];
      
      directorActions.forEach(action => {
        expect(prompt).toContain(action + ':');
      });
      
      expect(prompt).toContain('Introduce environmental hazard');
      expect(prompt).toContain('Trigger stress event');
    });
  });

  describe('agent type detection', () => {
    it('should detect marine by id and personality properties', () => {
      const marineContext: PromptContext = {
        ...mockContext,
        agent: mockMarine
      };

      const prompt = assemblePrompt(marineContext);
      
      expect(prompt).toContain('Compliance: 70%');
      expect(prompt).toContain('aggressive and take bold actions');
      expect(prompt).toContain('MARINE ACTIONS');
    });

    it('should detect alien by position and hidden properties', () => {
      const alienContext: PromptContext = {
        ...mockContext,
        agent: mockAlien
      };

      const prompt = assemblePrompt(alienContext);
      
      expect(prompt).toContain('You are the alien predator');
      expect(prompt).not.toContain('Compliance');
      expect(prompt).toContain('ALIEN ACTIONS');
    });

    it('should detect director by adjustments property', () => {
      const directorContext: PromptContext = {
        ...mockContext,
        agent: mockDirector
      };

      const prompt = assemblePrompt(directorContext);
      
      expect(prompt).toContain('Director overseeing the mission');
      expect(prompt).not.toContain('Compliance');
      expect(prompt).not.toContain('hidden');
      expect(prompt).toContain('DIRECTOR ACTIONS');
    });

    it('should fallback to marine actions for unknown agent type', () => {
      const unknownAgent = { unknown: 'type', position: 'Shuttle' } as any;
      const unknownContext: PromptContext = {
        ...mockContext,
        agent: unknownAgent
      };

      const prompt = assemblePrompt(unknownContext);
      
      expect(prompt).toContain('You are an agent in a tactical mission');
      expect(prompt).toContain('MARINE ACTIONS'); // Fallback
      expect(prompt).not.toContain('alien predator');
    });
  });
});