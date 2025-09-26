/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />

import { vi, afterEach } from 'vitest';

// Mock LLM server endpoint for browser tests
const mockLLMResponse = async (requestBody: string) => {
  const data = JSON.parse(requestBody);
  const prompt = data.prompt || '';
  
  // Mock responses based on prompt keywords (same as original llmClient logic)
  if (prompt.includes('search') || prompt.includes('Storage')) {
    return { action: 'search', target: 'storage', reasoning: 'Mock: Searching per orders' };
  } else if (prompt.includes('move')) {
    return { action: 'move', target: 'shuttleBay', reasoning: 'Mock: Moving to adjacent zone' };
  } else if (prompt.includes('report') || prompt.includes('status')) {
    return { action: 'report', reasoning: 'Mock: Status report - all clear' };
  } else {
    return { action: 'cover', reasoning: 'Mock: Taking defensive position' };
  }
};

global.fetch = vi.fn(async (url: string, options: RequestInit) => {
  if (url === '/api/llm' && options.method === 'POST') {
    let requestBody = '';
    if (typeof options.body === 'string') {
      requestBody = options.body;
    } else if (options.body instanceof Uint8Array || options.body instanceof ArrayBuffer) {
      requestBody = new TextDecoder().decode(options.body);
    }
    
    const responseData = await mockLLMResponse(requestBody || '');
    
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => responseData,
    } as Response);
  }
  
  // Fallback for other requests
  return Promise.resolve({
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not mocked' }),
  } as Response);
}) as any;

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
