require('dotenv').config();
const { OPENROUTER_API_KEY } = process.env;

const callOpenRouterAPI = async (apiKey, model, systemPrompt, userPrompt, { maxTokens = 1024, timeout = 55000 } = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
    
    // Moved clearTimeout to AFTER body parsing to properly timeout the whole request
    const body = await response.text();
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Model ${model} failed with HTTP ${response.status}: ${body}`);
    }
    return JSON.parse(body);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

(async () => {
  try {
    const data = await callOpenRouterAPI(OPENROUTER_API_KEY, 'google/gemma-2-9b-it:free', 'Reply nicely', 'Hello', { maxTokens: 8192, timeout: 55000 });
    console.log("Success! gemma-2-9b-it:free Tokens used:", data.usage);
  } catch (err) {
    console.error("Error gemma:", err.message);
  }
  
  try {
    const data = await callOpenRouterAPI(OPENROUTER_API_KEY, 'qwen/qwen-2.5-coder-32b-instruct:free', 'Reply nicely', 'Hello', { maxTokens: 8192, timeout: 55000 });
    console.log("Success! qwen Tokens used:", data.usage);
  } catch (err) {
    console.error("Error qwen:", err.message);
  }
})();
