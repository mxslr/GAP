import Groq from 'groq-sdk'
import { Agent } from 'undici'

export const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',       // snippet gen, feature classification — 14,400 req/day
  quality: 'llama-3.1-8b-instant',    // downgraded for K8s stability (was 70b)
}

// K8s clusters without IPv6 routing cause Node.js Happy Eyeballs to ETIMEDOUT.
// Force IPv4 via undici Agent to bypass the issue.
const ipv4Agent = new Agent({ connect: { family: 4 } })
const ipv4Fetch: typeof globalThis.fetch = (url, init) =>
  fetch(url as string, { ...init, dispatcher: ipv4Agent } as RequestInit)

let client: Groq | null = null

function getClient(): Groq {
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY, fetch: ipv4Fetch })
  }
  return client
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
        (err.message.includes('429') ||
          err.message.toLowerCase().includes('rate limit') ||
          err.message.toLowerCase().includes('quota'))

      if (!isRateLimit || attempt === maxRetries) throw err

      const delayMs = Math.pow(2, attempt) * 2000
      console.log(`[groq] rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastError
}

export async function generateWithGroq(
  prompt: string,
  options?: { maxTokens?: number; systemPrompt?: string; model?: string }
): Promise<string> {
  return withRetry(async () => {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const completion = await getClient().chat.completions.create({
      model: options?.model ?? GROQ_MODELS.fast,
      messages,
      max_tokens: options?.maxTokens ?? 2000,
      temperature: 0.1,
    })
    return completion.choices[0]?.message?.content ?? ''
  })
}

export async function generateJSONWithGroq<T>(prompt: string, model?: string): Promise<T> {
  const targetModel = model ?? GROQ_MODELS.fast
  const systemPrompt =
    'You are a JSON generator. Always respond with valid JSON only. No markdown fences, no explanation, no extra text before or after the JSON.'

  let raw: string
  try {
    // Try with response_format json_object (supported on most models)
    raw = await withRetry(async () => {
      const completion = await getClient().chat.completions.create({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })
      return completion.choices[0]?.message?.content ?? ''
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('json_object') || msg.includes('response_format')) {
      // Model doesn't support json_object mode — fall back to plain text
      raw = await generateWithGroq(prompt, {
        maxTokens: 4000,
        systemPrompt,
        model: targetModel,
      })
    } else {
      throw err
    }
  }

  // Step 1: strip markdown code fences
  let clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // Step 2: find the outermost JSON object or array
  const firstBrace = clean.indexOf('{')
  const firstBracket = clean.indexOf('[')
  let startIdx = -1

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace
  } else if (firstBracket !== -1) {
    startIdx = firstBracket
  }

  if (startIdx > 0) {
    clean = clean.slice(startIdx)
  }

  // Step 3: find matching closing brace/bracket by depth
  if (clean.length > 0 && (clean[0] === '{' || clean[0] === '[')) {
    const opener = clean[0]
    const closer = opener === '{' ? '}' : ']'
    let depth = 0
    let endIdx = -1
    let inString = false
    let escape = false

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i]
      if (escape) { escape = false; continue }
      if (ch === '\\' && inString) { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (!inString) {
        if (ch === opener) depth++
        if (ch === closer) {
          depth--
          if (depth === 0) { endIdx = i; break }
        }
      }
    }

    if (endIdx !== -1) {
      clean = clean.slice(0, endIdx + 1)
    }
  }

  try {
    return JSON.parse(clean) as T
  } catch (parseError) {
    console.error('[groq] JSON parse failed, raw response:', clean.slice(0, 300))
    throw new Error(`Groq returned invalid JSON: ${parseError}`)
  }
}
