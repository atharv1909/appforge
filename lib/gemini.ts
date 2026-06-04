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

  // If valid JSON, return immediately
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Truncated JSON — try to repair by slicing at last valid position
    // and closing any open braces/brackets
    try {
      const repaired = repairJson(cleaned);
      JSON.parse(repaired); // verify repair worked
      return repaired;
    } catch {
      // Return as-is and let Zod .catch() fallbacks handle it
      return cleaned;
    }
  }
}

function repairJson(str: string): string {
  let inString = false;
  let escape = false;
  let opens: string[] = [];
  let lastValidIdx = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      opens.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      if (opens.length > 0) opens.pop();
      lastValidIdx = i;
    }
  }

  // Slice to last valid closing char and close remaining opens
  let repaired = str.substring(0, lastValidIdx + 1);
  repaired += opens.reverse().join('');
  return repaired;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
