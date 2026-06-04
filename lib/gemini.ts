import Groq from 'groq-sdk';

const groq1 = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const groq2 = new Groq({ apiKey: process.env.GROQ_API_KEY_2! });

let callCount = 0;

function getClient() {
  callCount++;
  return callCount % 2 === 0 ? groq2 : groq1;
}

export async function callGemini(
  prompt: string,
  retries = 2,
  temperature = 0.2,
  maxTokens = 4096
): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const client = getClient();
      const completion = await client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      });

      const text = completion.choices[0]?.message?.content || '';
      return cleanJsonResponse(text);
    } catch (err: any) {
      if (i === retries) throw err;
      await sleep(3000 * (i + 1));
    }
  }
  throw new Error('Groq API failed after retries');
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart > 0) cleaned = cleaned.substring(jsonStart);
  
  // Try to fix truncated JSON by finding last valid closing bracket
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Try to fix truncated JSON
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const lastValid = Math.max(lastBrace, lastBracket);
    if (lastValid > 0) {
      cleaned = cleaned.substring(0, lastValid + 1);
      // Count unclosed braces and close them
      let opens = 0;
      let arrOpens = 0;
      for (const ch of cleaned) {
        if (ch === '{') opens++;
        else if (ch === '}') opens--;
        else if (ch === '[') arrOpens++;
        else if (ch === ']') arrOpens--;
      }
      cleaned += '}'.repeat(Math.max(0, opens));
      cleaned += ']'.repeat(Math.max(0, arrOpens));
    }
    return cleaned;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
