import { writable, get } from 'svelte/store';

export interface Message {
  sender: string;
  content: string;
  timestamp: number;
}

export const messageStore = writable<Message[]>([]);

export const addMessage = (sender: string, content: string): void => {
  const message: Message = {
    sender,
    content,
    timestamp: Date.now()
  };
  
  const currentMessages = get(messageStore);
  messageStore.set([...currentMessages, message]);
};

// Prune to last n messages, or summarize older ones if n is small
export const pruneToLast = (n: number): void => {
  if (n <= 0) {
    messageStore.set([]);
    return;
  }
  
  const currentMessages = get(messageStore);
  if (currentMessages.length <= n) {
    return; // No pruning needed
  }
  
  // Keep last n messages
  const recentMessages = currentMessages.slice(-n);
  
  // If we have many old messages, optionally summarize them
  const oldMessages = currentMessages.slice(0, -n);
  if (oldMessages.length > 10) { // Threshold for summarization
    const summaryContent = `Previous orders (${oldMessages.length} messages): ${oldMessages.slice(-3).map(m => `[${m.sender}]: ${m.content.substring(0, 30)}...`).join('; ')}`;
    const summaryMessage: Message = {
      sender: 'SYSTEM',
      content: summaryContent,
      timestamp: oldMessages[0].timestamp
    };
    recentMessages.unshift(summaryMessage);
  }
  
  messageStore.set(recentMessages);
};

// Helper to get current messages
export const getMessages = (): Message[] => {
  return get(messageStore);
};

// Helper to get last n messages
export const getLastMessages = (n: number): Message[] => {
  return getMessages().slice(-n);
};

// Clear all messages (for testing or reset)
export const clearMessages = (): void => {
  messageStore.set([]);
};

// Add system message helper
export const addSystemMessage = (content: string): void => {
  addMessage('SYSTEM', content);
};

// Add commander message helper
export const addCommanderMessage = (content: string): void => {
  addMessage('COMMANDER', content);
};