import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import type { RequestHandler } from './$types';

const apiKey = process.env.OPENROUTER_API_KEY;

let openai: OpenAI | null = null;
if (apiKey) {
  openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}

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

const callLLM = async (prompt: string, model: string = 'gpt-4o-mini'): Promise<LLMResponse> => {
  // Mock mode for tests (no API key)
  if (!apiKey) {
    console.log('Using mock LLM mode (no API key)');
    // Simple scripted response based on prompt keywords
    if (prompt.includes('search') || prompt.includes('Storage')) {
      return { action: 'search', target: 'storage', reasoning: 'Mock: Searching per orders' };
    } else if (prompt.includes('move')) {
      return { action: 'move', target: 'shuttleBay', reasoning: 'Mock: Moving to adjacent zone' };
    } else if (prompt.includes('report') || prompt.includes('status')) {
      return { action: 'report', reasoning: 'Mock: Status report - all clear' };
    } else {
      return { action: 'cover', reasoning: 'Mock: Taking defensive position' };
    }
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
      signal: controller.signal
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

export const checkLLMConnection = async (): Promise<boolean> => {
  try {
    await callLLM('Say "connection successful"', 'gpt-4o-mini');
    return true;
  } catch {
    return false;
  }
};