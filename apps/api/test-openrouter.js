require('dotenv').config();
const { OPENROUTER_API_KEY } = process.env;

const callOpenRouterAPI = async (apiKey, model, systemPrompt, userPrompt, { maxTokens = 1024, timeout = 25000 } = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'TaskForge',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const err = await response.text();
      console.error(`OpenRouter API error (${model}, HTTP ${response.status}):`, err);
      throw new Error(`Model ${model} failed with HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

(async () => {
  console.log("Starting test...");
  try {
    const data = await callOpenRouterAPI(OPENROUTER_API_KEY, 'openrouter/free', 'test', 'Hello', { maxTokens: 8192, timeout: 55000 });
    console.log("Success:", data);
  } catch (err) {
    console.error("Error:", err);
  }
})();
