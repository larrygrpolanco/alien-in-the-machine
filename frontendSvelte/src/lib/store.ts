/**
 * Svelte stores for reactive game state.
 * Manages log (full and filtered), filters for message types.
 * Derived store auto-updates filtered log when full log or filters change.
 * Defaults: Show gameplay (commander, dialogue, actions); hide debug thoughts.
 * Concepts: Svelte stores for global reactive data – subscribe in components.
 * No persistence here – state from API; extend with localStorage for offline.
 */

import { writable, derived } from 'svelte/store';
import type { LogEntry, GameLogState } from './types';
import { MessageType } from './types';

export const fullGameLog = writable<LogEntry[]>([]);

/**
 * Active filters: Set of MessageType to show.
 * Toggle via UI buttons; defaults to core gameplay.
 */
export const activeFilters = writable<Set<MessageType>>(new Set([
  MessageType.COMMANDER,
  MessageType.AI_DIALOGUE,
  MessageType.AI_ACTION,
  // Exclude AI_THOUGHTS (debug), SYSTEM (errors) by default
]));

/**
 * Derived filtered log: Recomputes on fullLog or filters change.
 * Use $filteredGameLog in components for auto-updating list.
 */
export const filteredGameLog = derived(
  [fullGameLog, activeFilters],
  ([$fullGameLog, $activeFilters]: [LogEntry[], Set<MessageType>]) => $fullGameLog.filter((entry: LogEntry) => $activeFilters.has(entry.type))
);

/**
 * Current turn from state (for header display).
 */
export const currentTurn = writable(0);

/**
 * Update stores from API response.
 * Call after getInitialState or postTurn.
 */
export function updateFromState(state: GameLogState) {
  fullGameLog.set(state.log);
  currentTurn.set(state.current_turn);
}

/**
 * Append new log entries (for incremental updates).
 * Use after postTurn to add turn events without resetting full history.
 */
export function appendLogEntries(newEntries: LogEntry[]) {
  fullGameLog.update(current => [...current, ...newEntries]);
}

/**
 * Toggle a filter on/off.
 */
export function toggleFilter(type: MessageType) {
  activeFilters.update(filters => {
    if (filters.has(type)) {
      filters.delete(type);
    } else {
      filters.add(type);
    }
    return new Set(filters);  // Return new Set to trigger reactivity
  });
}

/**
 * Reset filters to defaults.
 */
export function resetFilters() {
  activeFilters.set(new Set([
    MessageType.COMMANDER,
    MessageType.AI_DIALOGUE,
    MessageType.AI_ACTION
  ]));
}
