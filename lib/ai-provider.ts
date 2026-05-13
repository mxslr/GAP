import { generateJSONWithGroq, generateWithGroq } from './groq'
import { generateJSON as generateJSONWithGemini } from './gemini'

/**
 * Unified AI entry point — try Groq first (14,400 req/day free),
 * fall back to Gemini (1,500 req/day free).
 *
 * schema param is forwarded to Gemini for structured output; Groq uses
 * prompt-based JSON extraction instead.
 */
export async function generateJSON<T>(
  prompt: string,
  schema?: object,
  modelName?: string
): Promise<T> {
  if (process.env.GROQ_API_KEY) {
    try {
      const result = await generateJSONWithGroq<T>(prompt, modelName)
      return result
    } catch (err) {
      console.warn(
        '[ai] Groq failed, falling back to Gemini:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  if (process.env.GEMINI_API_KEY) {
    return generateJSONWithGemini<T>(prompt, schema ?? {}, modelName)
  }

  throw new Error('No AI provider available — set GROQ_API_KEY or GEMINI_API_KEY in .env')
}

export async function generateText(prompt: string): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    try {
      return await generateWithGroq(prompt)
    } catch (err) {
      console.warn(
        '[ai] Groq failed, falling back to Gemini:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const result = await generateJSONWithGemini<{ text: string }>(
      `${prompt}\n\nRespond with JSON: {"text": "your response here"}`,
      { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
    )
    return result.text
  }

  throw new Error('No AI provider available — set GROQ_API_KEY or GEMINI_API_KEY in .env')
}
