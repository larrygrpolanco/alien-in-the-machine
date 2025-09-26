import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.OPENROUTER_API_KEY;
const defaultModel = process.env.DEFAULT_LLM_MODEL || 'deepseek/deepseek-chat-v3.1:free';

// Mock mode flag (default to true for UI development)
const isMockMode = process.env.MOCK_LLM !== 'false';

let openai: OpenAI | null = null;
if (apiKey && !isMockMode) {
  openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}

// Load mock data
const MOCKS_PATH = path.resolve('src/lib/mocks/llm-mocks.json');
const loadMockData = (): Record<string, any> => {
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

// Response schema for JSON mode
const responseSchema = {
  name: 'agent_action',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action the agent should take (move, search, interact, attack, cover, report)'
      },
      target: {
        type: 'string',
        description: 'Optional target for the action (zone name, item name, or agent ID)',
        nullable: true
      },
      reasoning: {
        type: 'string',
        description: 'The agent\'s reasoning for choosing this action'
      }
    },
    required: ['action', 'reasoning'],
    additionalProperties: false
  }
};

interface LLMResponse {
  action: string;
  target?: string | null;
  reasoning: string;
}

const callLLM = async (prompt: string, model: string = defaultModel): Promise<LLMResponse> => {
  // Mock mode: Return static responses from mocks file
  if (isMockMode) {
    console.log('[MOCK LLM SERVER] Using mock response for UI development');
    
    // Determine agent type from prompt keywords
    const lowerPrompt = prompt.toLowerCase();
    let agentType: 'marine' | 'alien' | 'director' = 'marine';
    
    if (lowerPrompt.includes('alien') || lowerPrompt.includes('xenomorph')) {
      agentType = 'alien';
    } else if (lowerPrompt.includes('director') || lowerPrompt.includes('narrative')) {
      agentType = 'director';
    }
    
    const responses = mockData[agentType] || mockData.marine || [];
    if (responses.length > 0) {
      // Select random mock response
      const mockIndex = Math.floor(Math.random() * responses.length);
      const mockResponse = responses[mockIndex];
      
      console.log(`[MOCK LLM SERVER] Selected ${agentType} response: ${mockResponse.action}`);
      return mockResponse;
    }
    
    // Fallback mock response
    return {
      action: 'report',
      reasoning: 'Mock server response: System operational for UI testing'
    };
  }

  // Real API mode (guarded behind MOCK_LLM=false)
  if (!apiKey) {
    throw new Error('OpenRouter API key required for real LLM mode (MOCK_LLM=false)');
  }

  if (!openai) {
    throw new Error('OpenAI client not initialized - missing API key');
  }

  const controller = new AbortController();
  
  // 5 second timeout
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an AI agent in a tactical game. Respond ONLY with valid JSON in the following format:
{
  "action": "move|search|interact|attack|cover|report",
  "target": "optional target (zone, item, or agent ID)",
  "reasoning": "brief explanation of your decision"
}

Choose only valid actions based on the game context provided in the user message. Do not include any other text outside the JSON.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_schema', json_schema: responseSchema },
      temperature: 0.7,
      max_tokens: 150,
      stream: false
    }, {
      signal: controller.signal,
      headers: {
        'HTTP-Referer': 'http://localhost:5173', // Optional: for OpenRouter leaderboards
        'X-Title': 'Alien in the Machine' // Optional: for OpenRouter leaderboards
      }
    });

    clearTimeout(timeoutId);

    const response = completion.choices[0];
    if (!response.message.content) {
      throw new Error('No response content from LLM');
    }

    // Parse JSON response
    let parsedResponse: LLMResponse;
    try {
      parsedResponse = JSON.parse(response.message.content);
    } catch (parseError) {
      // Fallback parsing if JSON mode fails
      const content = response.message.content.trim();
      const jsonMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from LLM');
      }
    }

    // Validate response structure
    if (!parsedResponse.action || typeof parsedResponse.reasoning !== 'string') {
      throw new Error('Invalid response structure from LLM');
    }

    return {
      action: parsedResponse.action,
      target: parsedResponse.target || undefined,
      reasoning: parsedResponse.reasoning
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('LLM request timed out after 5 seconds');
    }
    
    if (error.status === 401) {
      throw new Error('Invalid OpenRouter API key');
    }
    
    if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please wait before retrying.');
    }
    
    // Generic error handling
    console.error('LLM API Error:', error);
    throw new Error(`LLM request failed: ${error.message}`);
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { prompt, model } = await request.json();
    
    if (!prompt) {
      return json({ error: 'Prompt is required' }, { status: 400 });
    }

    const response = await callLLM(prompt, model);
    
    return json(response);
  } catch (error: any) {
    console.error('LLM endpoint error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};

export const _checkLLMConnection = async (): Promise<boolean> => {
  try {
    await callLLM('Say "connection successful"', defaultModel);
    return true;
  } catch {
    return false;
  }
};