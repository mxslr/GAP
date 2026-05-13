import { GoogleGenerativeAI, GenerativeModel, SchemaType } from '@google/generative-ai'

let geminiClient: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')
    geminiClient = new GoogleGenerativeAI(apiKey)
  }
  return geminiClient
}

export function getModel(modelName: string = 'gemini-2.0-flash'): GenerativeModel {
  return getClient().getGenerativeModel({ model: modelName })
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate limit') || err.message.toLowerCase().includes('quota'))

      if (!isRateLimit || attempt === maxRetries) {
        throw err
      }

      const delayMs = Math.pow(2, attempt) * 2000 // 2s, 4s, 8s, 16s
      console.log(`[gemini] rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}

export async function generateJSON<T>(
  prompt: string,
  schema: object,
  modelName?: string
): Promise<T> {
  const model = getModel(modelName)

  return withRetry(async () => {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema as { type: SchemaType },
      },
    })

    const text = result.response.text()
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`)
    }
  })
}
