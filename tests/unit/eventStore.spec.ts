import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventStore } from '../../src/lib/stores/eventStore';
import type { Event } from '../../src/lib/models/eventSchema';
import { get } from 'svelte/store';

// Mock dependencies if any
const mockEventService = {
  applyEvent: vi.fn()
};
vi.mock('../../src/lib/services/eventService', () => ({
  eventService: mockEventService
}));

describe('eventStore', () => {
  beforeEach(() => {
    eventStore.set([]);
    vi.clearAllMocks();
  });

  it('should append new events immutably', () => {
    const initialEvents: Event[] = [];
    eventStore.set(initialEvents);
    
    const initialState = get(eventStore);
    expect(initialState).toEqual(initialEvents);
    
    const newEvent: Event = {
      id: '1',
      tick: 1,
      type: 'move',
      actor: 'agent',
      details: { direction: 'north' }
    };
    
    eventStore.update(events => [...events, newEvent]);
    
    const updatedState = get(eventStore);
    expect(updatedState).toEqual([newEvent]);
    expect(updatedState).not.toBe(initialEvents); // Immutability check
  });

  it('should maintain immutability on multiple appends', () => {
    const event1: Event = {
      id: '1',
      tick: 1,
      type: 'move',
      actor: 'agent',
      details: { direction: 'north' }
    };
    const event2: Event = {
      id: '2',
      tick: 2,
      type: 'search',
      actor: 'agent',
      details: { area: 'shuttle' }
    };
    
    eventStore.update(events => [...events, event1]);
    const stateAfterFirst = get(eventStore);
    
    eventStore.update(events => [...events, event2]);
    const stateAfterSecond = get(eventStore);
    
    expect(stateAfterSecond).toHaveLength(2);
    expect(stateAfterFirst).not.toBe(stateAfterSecond); // New array created
    expect(stateAfterFirst[0]).toEqual(event1);
  });

  it('should not mutate original array when appending', () => {
    const events: Event[] = [{
      id: 'test',
      tick: 1,
      type: 'message',
      actor: 'commander',
      details: { text: 'test' }
    }];
    eventStore.set(events);
    
    const initialState = get(eventStore);
    eventStore.update(current => [...current, {
      id: 'new',
      tick: 2,
      type: 'move',
      actor: 'agent',
      details: {}
    }]);
    
    expect(initialState).toHaveLength(1); // Original unchanged
    expect(get(eventStore)).toHaveLength(2);
  });
});