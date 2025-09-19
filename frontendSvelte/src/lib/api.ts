/**
 * API functions for communicating with backend FastAPI server.
 * Simple fetch wrappers with error handling and type safety.
 * Base URL: localhost:8000 (dev server); extend for prod (e.g., env var).
 * Concepts: Fetch API for HTTP requests; async/await for clean code.
 * Error handling: Throws on non-OK responses for try/catch in UI.
 * CORS: Backend configured for localhost:5173 (SvelteKit dev).
 */

import type { GameLogState } from './types';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '/api';  // Vite proxy for prod

/**
 * Fetch initial game state on load.
 * Updates stores via updateFromState.
 */
export async function getInitialState(): Promise<GameLogState> {
  const response = await fetch(`${API_BASE}/api/state`);
  if (!response.ok) {
    throw new Error(`Failed to fetch state: ${response.status} ${response.statusText}`);
  }
  return await response.json() as GameLogState;
}

/**
 * Post command to advance turn.
 * Returns new state; use appendLogEntries or updateFromState in caller.
 */
export async function postPlayerTurn(command: string): Promise<GameLogState> {
  const response = await fetch(`${API_BASE}/api/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: command.trim() || '' }),  // Allow empty for "pass"
  });
  if (!response.ok) {
    throw new Error(`Failed to advance turn: ${response.status} ${response.statusText}`);
  }
  return await response.json() as GameLogState;
}

/**
 * Health check – optional for UI loading indicator.
 */
export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) throw new Error('Server not ready');
  return await response.json();
}
