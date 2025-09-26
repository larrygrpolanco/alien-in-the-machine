export interface LLMResponse {
  action: string;
  target?: string | null;
  reasoning: string;
}

export const callLLM = async (
  prompt: string,
  model: string = 'deepseek/deepseek-chat-v3.1:free'
): Promise<LLMResponse> => {
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