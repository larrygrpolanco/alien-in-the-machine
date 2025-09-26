import { z } from 'zod';
import type { Item, Zone, Agent } from './entities';

// Event types enum
const EventType = z.enum([
  'move',
  'search',
  'interact',
  'attack',
  'cover',
  'report',
  'sneak',
  'ambush',
  'hazard',
  'message'
]);

// Details and result as flexible objects (z.record for any key-value)
const DetailsSchema = z.record(z.string(), z.any());
const ResultSchema = z.record(z.string(), z.any()).optional();

// Core event schema
export const EventSchema = z.object({
  id: z.string(),
  tick: z.number().int().nonnegative(),
  type: EventType,
  actor: z.string(),
  target: z.string().optional(),
  details: DetailsSchema,
  result: ResultSchema
});

export type Event = z.infer<typeof EventSchema>;
export type ValidatedEvent = z.output<typeof EventSchema>;

// Event log schema for immutability validation (append-only array)
export const EventLogSchema = z.array(EventSchema);

// Validator functions
export const validateEvent = (event: unknown): Event => {
  return EventSchema.parse(event);
};

export const validateEventLog = (log: unknown[]): Event[] => {
  return EventLogSchema.parse(log);
};

// Ensure append-only: new events must have higher tick than last in log
export const canAppendEvent = (event: Event, currentLog: Event[]): boolean => {
  if (currentLog.length === 0) return true;
  const lastTick = currentLog[currentLog.length - 1].tick;
  return event.tick > lastTick;
};

// Generate unique event ID (simple timestamp + random for now)
export const generateEventId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Initial empty log
export const initialEventLog: Event[] = [];