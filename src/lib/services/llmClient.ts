import fs from 'fs';
import path from 'path';

export interface LLMResponse {
  action: string;
  target?: string | null;
  reasoning: string;
}

// Mock data import (will be loaded dynamically)
const MOCKS_PATH = path.resolve('src/lib/mocks/llm-mocks.json');

const isMockMode = process.env.MOCK_LLM === 'true';

const loadMockData = (): Record<string, LLMResponse[]> => {
  if (!isMockMode) return {};
  
  try {
    if (fs.existsSync(MOCKS_PATH)) {
      const data = fs.readFileSync(MOCKS_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Failed to load mock data:', error);
  }
  return {};
};

const mockData = loadMockData();

export const callLLM = async (
  prompt: string,
  model: string = 'deepseek/deepseek-chat-v3.1:free'
): Promise<LLMResponse> => {
  // Mock mode: Return static responses for UI testing
  if (isMockMode) {
    console.log('[MOCK LLM] Using mock response for UI development');
    
    // Simple agent type detection from prompt keywords
    const lowerPrompt = prompt.toLowerCase();
    let agentType: 'marine' | 'alien' | 'director' = 'marine';
    
    if (lowerPrompt.includes('alien') || lowerPrompt.includes('xenomorph')) {
      agentType = 'alien';
    } else if (lowerPrompt.includes('director') || lowerPrompt.includes('narrative')) {
      agentType = 'director';
    }
    
    const responses = mockData[agentType] || mockData.marine;
    if (responses && responses.length > 0) {
      // Cycle through available mock responses
      const mockIndex = Math.floor(Math.random() * responses.length);
      const mockResponse = responses[mockIndex];
      
      console.log(`[MOCK LLM] Selected ${agentType} response: ${mockResponse.action}`);
      return mockResponse;
    }
    
    // Fallback mock
    return {
      action: 'report',
      reasoning: 'Mock response: System operational for UI testing'
    };
  }

  // Real API mode (existing implementation)
  const controller = new AbortController();
  
  // 10 second timeout for server roundtrip
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, model }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.action || typeof data.reasoning !== 'string') {
      throw new Error('Invalid response structure from LLM server');
    }

    return {
      action: data.action,
      target: data.target || undefined,
      reasoning: data.reasoning
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('LLM request timed out after 10 seconds');
    }
    
    // Generic error handling
    console.error('LLM API Error:', error);
    throw new Error(`LLM request failed: ${error.message}`);
  }
};

// Health check function
export const checkLLMConnection = async (): Promise<boolean> => {
  try {
    await callLLM('Say "connection successful"', 'deepseek/deepseek-chat-v3.1:free');
    return true;
  } catch {
    return false;
  }
};

// Type for agent actions (can be moved to types file later)
export interface AgentAction {
  action: string;
  target?: string;
  reasoning: string;
}