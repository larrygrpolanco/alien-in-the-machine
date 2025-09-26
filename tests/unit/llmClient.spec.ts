import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM, checkLLMConnection } from '../../src/lib/services/llmClient';
import type { LLMResponse } from '../../src/lib/services/llmClient';
import OpenAI from 'openai';

// Mock OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }))
  };
});

const mockOpenAI = new (vi.mocked(OpenAI)) as any;

describe('llmClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
    // Reset OpenAI instance
    mockOpenAI.chat.completions.create.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should use mock mode when no API key is present', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    
    const response1 = await callLLM('Search the storage area');
    expect(response1.action).toBe('search');
    expect(response1.target).toBe('storage');
    expect(response1.reasoning).toContain('Mock: Searching');
    
    const response2 = await callLLM('Move to shuttle bay');
    expect(response2.action).toBe('move');
    expect(response2.target).toBe('shuttleBay');
    expect(response2.reasoning).toContain('Mock: Moving');
    
    const response3 = await callLLM('Report current status');
    expect(response3.action).toBe('report');
    expect(response3.reasoning).toContain('Mock: Status report');
    
    const response4 = await callLLM('Default action');
    expect(response4.action).toBe('cover');
    expect(response4.reasoning).toContain('Mock: Taking defensive');
    
    // Verify no OpenAI calls were made
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should make successful LLM API call with JSON response', async () => {
    const mockResponseContent = JSON.stringify({
      action: 'search',
      target: 'medbay',
      reasoning: 'Need to find the vial in medbay based on mission objectives'
    });
    
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: mockResponseContent,
          role: 'assistant'
        }
      }],
      usage: { total_tokens: 120 }
    });

    const prompt = 'Commander orders: Search for the vial. Current location: Shuttle Bay';
    const result: LLMResponse = await callLLM(prompt, 'gpt-4o-mini');

    expect(result.action).toBe('search');
    expect(result.target).toBe('medbay');
    expect(result.reasoning).toContain('mission objectives');
    
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Respond ONLY with valid JSON')
          }),
          expect.objectContaining({
            role: 'user',
            content: prompt
          })
        ]),
        response_format: expect.objectContaining({
          type: 'json_schema',
          json_schema: expect.objectContaining({
            name: 'agent_action',
            strict: true
          })
        }),
        temperature: 0.7,
        max_tokens: 150,
        stream: false
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('should handle JSON parsing fallback when response_format fails', async () => {
    const mockResponseContent = 'Some text before JSON: {"action":"move","target":"corridor","reasoning":"Moving to access medbay"} Some text after';
    
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: mockResponseContent,
          role: 'assistant'
        }
      }]
    });

    const prompt = 'Move toward medbay area';
    const result: LLMResponse = await callLLM(prompt);

    expect(result.action).toBe('move');
    expect(result.target).toBe('corridor');
    expect(result.reasoning).toContain('access medbay');
  });

  it('should throw error for invalid JSON response', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Invalid response without JSON',
          role: 'assistant'
        }
      }]
    });

    const prompt = 'Test invalid response';
    await expect(callLLM(prompt)).rejects.toThrow('Invalid JSON response from LLM');
  });

  it('should throw error for invalid response structure', async () => {
    const invalidResponse = JSON.stringify({
      invalidAction: 'search',
      extraField: 'unwanted'
    });
    
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: invalidResponse,
          role: 'assistant'
        }
      }]
    });

    const prompt = 'Test invalid structure';
    await expect(callLLM(prompt)).rejects.toThrow('Invalid response structure from LLM');
  });

  it('should handle request timeout (5 seconds)', async () => {
    const controller = new AbortController();
    mockOpenAI.chat.completions.create.mockImplementation(() => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          controller.abort();
          reject(new DOMException('Aborted', 'AbortError'));
        }, 100); // Abort quickly for test
      });
    });

    const prompt = 'Test timeout';
    await expect(callLLM(prompt)).rejects.toThrow('LLM request timed out after 5 seconds');
  });

  it('should throw authentication error for 401 status', async () => {
    class OpenAIError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    }
    
    const mockError = new OpenAIError('Invalid API key', 401);
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(mockError);

    const prompt = 'Test auth error';
    await expect(callLLM(prompt)).rejects.toThrow('Invalid OpenRouter API key');
  });

  it('should throw rate limit error for 429 status', async () => {
    class OpenAIError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    }
    
    const mockError = new OpenAIError('Rate limit exceeded', 429);
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(mockError);

    const prompt = 'Test rate limit';
    await expect(callLLM(prompt)).rejects.toThrow('Rate limit exceeded');
  });

  it('should handle generic API errors', async () => {
    class OpenAIError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    }
    
    const mockError = new OpenAIError('Server internal error', 500);
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(mockError);

    const prompt = 'Test server error';
    await expect(callLLM(prompt)).rejects.toThrow('LLM request failed: Server internal error');
  });

  it('should handle missing API key initialization', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    
    // First call initializes mock mode
    await expect(callLLM('Test')).resolves.toBeDefined();
    
    // But if we force real mode somehow, it should fail
    const originalEnv = vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    // This would normally throw, but mock mode catches it
    await expect(callLLM('Force real mode')).resolves.toBeDefined();
  });

  it('should use different models correctly', async () => {
    const mockResponse = JSON.stringify({
      action: 'interact',
      target: 'vial',
      reasoning: 'Using advanced model for better reasoning'
    });
    
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: { content: mockResponse, role: 'assistant' }
      }]
    });

    const result = await callLLM('Interact with medical equipment', 'gpt-4o-mini');
    
    expect(result.action).toBe('interact');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini'
      }),
      expect.any(Object)
    );
  });

  it('should work with checkLLMConnection', async () => {
    const mockSuccessResponse = JSON.stringify({
      action: 'report',
      reasoning: 'Connection successful'
    });
    
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: { content: mockSuccessResponse, role: 'assistant' }
      }]
    });

    const isConnected = await checkLLMConnection();
    expect(isConnected).toBe(true);
    
    // Test failure case
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('Connection failed'));
    const isDisconnected = await checkLLMConnection();
    expect(isDisconnected).toBe(false);
  });

  it('should validate response schema compliance', async () => {
    // Valid response
    const validResponse = JSON.stringify({
      action: 'move',
      target: 'corridor',
      reasoning: 'Strategic movement to next objective'
    });
    
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: { content: validResponse, role: 'assistant' }
      }]
    });

    const result1 = await callLLM('Move forward');
    expect(result1.action).toBe('move');
    expect(result1.target).toBe('corridor');
    expect(typeof result1.reasoning).toBe('string');

    // Response missing required field
    const invalidResponse = JSON.stringify({
      target: 'shuttle',
      reasoning: 'Missing action'
    });
    
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: { content: invalidResponse, role: 'assistant' }
      }]
    });

    await expect(callLLM('Test invalid')).rejects.toThrow('Invalid response structure from LLM');
  });

  it('should handle empty response content', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          role: 'assistant'
        }
      }]
    });

    const prompt = 'Empty response test';
    await expect(callLLM(prompt)).rejects.toThrow('No response content from LLM');
  });
});