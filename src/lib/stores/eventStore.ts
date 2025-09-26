import { writable, get } from 'svelte/store';
import type { Event, ValidatedEvent } from '../models/eventSchema';
import { validateEvent, canAppendEvent, generateEventId } from '../models/eventSchema';

export const eventStore = writable<Event[]>([]);

export const appendEvent = (rawEvent: Omit<Event, 'id'> & { id?: string }): void => {
  // Generate ID if not provided
  const eventData = {
    ...rawEvent,
    id: rawEvent.id || generateEventId(),
    tick: rawEvent.tick || get(eventStore).length + 1
  } as Event;

  // Validate the event
  const validatedEvent: ValidatedEvent = validateEvent(eventData);

  // Check immutability (append-only)
  const currentEvents = get(eventStore);
  if (!canAppendEvent(validatedEvent, currentEvents)) {
    console.warn('Cannot append event: tick must be greater than last event');
    return;
  }

  // Append immutably
  eventStore.set([...currentEvents, validatedEvent]);
};

// Helper to get current events (for derived stores)
export const getEvents = () => get(eventStore);

// Get recent events (prune to last N, for memory management)
export const pruneToLast = (n: number): Event[] => {
  const events = get(eventStore);
  return events.slice(-n);
};

// Reset store (for testing)
export const resetEventStore = () => {
  eventStore.set([]);
};