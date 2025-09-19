/**
 * TypeScript types matching backend Pydantic schemas.
 * Ensures type safety in frontend for API responses.
 * Copy of backend schemas.py – keep in sync.
 * Key: MessageType enum for color-coding log entries.
 */

export enum MessageType {
  SYSTEM = "system",        // Red: Errors, system messages
  COMMANDER = "commander",  // Yellow: Player commands
  AI_THOUGHTS = "ai_thoughts",  // Gray: Internal AI reasoning (debug, optional hide)
  AI_DIALOGUE = "ai_dialogue",  // Cyan: Spoken dialogue
  AI_ACTION = "ai_action"   // Orange: Narration/events
}

export interface LogEntry {
  turn: number;
  type: MessageType;
  content: string;
  author: string;  // e.g., "Commander", "Vanessa Miller", "Director"
}

export interface GameLogState {
  log: LogEntry[];
  current_turn: number;
}

/**
 * Additional types for state (fetched separately if needed).
 * For now, frontend focuses on log; extend for character/zone display.
 */
export interface CharacterData {
  name: string;
  attributes: { wits: number };
  skills: { comtech: number };
  inventory: string[];
  agenda: string;
  status: { health: string; stress: number };
}

export interface ZoneData {
  name: string;
  description: string;
  exits: Record<string, {
    to: string;
    status: string;
    panel: string;
    extra_properties: Record<string, string>;
  }>;
}
