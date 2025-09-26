import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  messageStore,
  addMessage,
  pruneToLast,
  clearMessages,
  addSystemMessage,
  addCommanderMessage,
  type Message
} from '../../src/lib/stores/messageStore';
import { get } from 'svelte/store';

describe('messageStore', () => {
  beforeEach(() => {
    clearMessages();
    vi.clearAllMocks();
  });

  it('should add new messages using addMessage', () => {
    const initialState = get(messageStore);
    expect(initialState).toEqual([]);
    
    addMessage('COMMANDER', 'Search the shuttle bay');
    
    const updatedState = get(messageStore);
    expect(updatedState).toHaveLength(1);
    expect(updatedState[0].sender).toBe('COMMANDER');
    expect(updatedState[0].content).toBe('Search the shuttle bay');
    expect(updatedState[0].timestamp).toBeGreaterThan(0);
    expect(updatedState).not.toBe(initialState); // New array created
  });

  it('should add multiple messages maintaining chronological order', () => {
    addCommanderMessage('Move to corridor');
    addMessage('AGENT', 'Moving to corridor');
    addMessage('AGENT', 'Position updated');
    
    const state = get(messageStore);
    expect(state).toHaveLength(3);
    expect(state[0].sender).toBe('COMMANDER');
    expect(state[1].sender).toBe('AGENT');
    expect(state[2].sender).toBe('AGENT');
    expect(state[0].timestamp).toBeLessThan(state[1].timestamp);
    expect(state[1].timestamp).toBeLessThan(state[2].timestamp);
  });

  it('should prune messages to last n using pruneToLast', () => {
    // Add 7 messages
    for (let i = 1; i <= 7; i++) {
      addMessage(`SENDER${i}`, `Message ${i}`);
    }
    
    expect(get(messageStore)).toHaveLength(7);
    
    pruneToLast(5);
    
    const state = get(messageStore);
    expect(state).toHaveLength(5);
    expect(state[0].content).toBe('Message 3'); // Oldest kept
    expect(state[4].content).toBe('Message 7'); // Newest
  });

  it('should create summary message when pruning more than 10 old messages', () => {
    // Add 12 messages to trigger summarization
    for (let i = 1; i <= 12; i++) {
      addMessage(`SENDER${i}`, `Message content ${i} that is quite long but will be truncated`);
    }
    
    pruneToLast(3);
    
    const state = get(messageStore);
    expect(state).toHaveLength(4); // 3 recent + 1 summary
    
    // Summary should be first
    expect(state[0].sender).toBe('SYSTEM');
    expect(state[0].content).toContain('Previous orders (9 messages)');
    expect(state[0].content).toContain('Message content 10');
    expect(state[0].content).toContain('Message content 11');
    expect(state[0].content).toContain('Message content 12');
    
    // Recent messages follow
    expect(state[1].content).toBe('Message content 10');
    expect(state[2].content).toBe('Message content 11');
    expect(state[3].content).toBe('Message content 12');
  });

  it('should not create summary when pruning fewer than 10 old messages', () => {
    // Add 6 messages (3 old + 3 recent)
    for (let i = 1; i <= 6; i++) {
      addMessage(`SENDER${i}`, `Message ${i}`);
    }
    
    pruneToLast(3);
    
    const state = get(messageStore);
    expect(state).toHaveLength(3); // No summary, just recent 3
    expect(state[0].sender).not.toBe('SYSTEM');
    expect(state[0].content).toBe('Message 4');
  });

  it('should handle pruneToLast with n <= 0 by clearing all messages', () => {
    addMessage('COMMANDER', 'Test command');
    addMessage('AGENT', 'Test response');
    
    expect(get(messageStore)).toHaveLength(2);
    
    pruneToLast(0);
    
    const state = get(messageStore);
    expect(state).toEqual([]);
  });

  it('should not prune when current messages are fewer than or equal to n', () => {
    addMessage('COMMANDER', 'Single message');
    
    pruneToLast(5);
    
    const state = get(messageStore);
    expect(state).toHaveLength(1); // Unchanged
    expect(state[0].content).toBe('Single message');
  });

  it('should use helper methods correctly', () => {
    addSystemMessage('System alert: Alien detected');
    addCommanderMessage('Evacuate immediately');
    
    const state = get(messageStore);
    expect(state).toHaveLength(2);
    expect(state[0].sender).toBe('SYSTEM');
    expect(state[0].content).toBe('System alert: Alien detected');
    expect(state[1].sender).toBe('COMMANDER');
    expect(state[1].content).toBe('Evacuate immediately');
  });

  it('should clear all messages with clearMessages', () => {
    addMessage('COMMANDER', 'Before clear');
    expect(get(messageStore)).toHaveLength(1);
    
    clearMessages();
    
    const state = get(messageStore);
    expect(state).toEqual([]);
  });

  it('should maintain immutability across operations', () => {
    const initialState = get(messageStore);
    
    addMessage('AGENT', 'First message');
    const afterFirst = get(messageStore);
    expect(afterFirst).not.toBe(initialState);
    
    addMessage('COMMANDER', 'Second message');
    const afterSecond = get(messageStore);
    expect(afterSecond).not.toBe(afterFirst);
    
    pruneToLast(1);
    const afterPrune = get(messageStore);
    expect(afterPrune).not.toBe(afterSecond);
    
    // Original references unchanged
    expect(initialState).toEqual([]);
    expect(afterFirst).toHaveLength(1);
    expect(afterSecond).toHaveLength(2);
  });

  it('should handle timestamp ordering correctly', () => {
    const clock = vi.useFakeTimers();
    
    addMessage('COMMANDER', 'Message at t=0');
    clock.setSystemTime(new Date('2023-01-01T00:00:01'));
    addMessage('AGENT', 'Message at t=1');
    clock.setSystemTime(new Date('2023-01-01T00:00:02'));
    addMessage('SYSTEM', 'Message at t=2');
    
    const state = get(messageStore);
    expect(state[0].timestamp).toBe(0); // Assuming Date.now() starts at 0 with fake timers
    expect(state[1].timestamp).toBe(1000); // 1 second later
    expect(state[2].timestamp).toBe(2000); // 2 seconds later
  });
});