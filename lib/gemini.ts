import { GoogleGenerativeAI, GenerativeModel, SchemaType } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is not set')
}

const gemini = new GoogleGenerativeAI(apiKey)

export function getModel(modelName: string = 'gemini-2.0-flash'): GenerativeModel {
  return gemini.getGenerativeModel({ model: modelName })
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'))

      if (!isRateLimit || attempt === maxRetries) {
        throw err
      }

      const delayMs = (attempt + 1) * 1000
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
