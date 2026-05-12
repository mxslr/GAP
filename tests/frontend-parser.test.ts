import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseFrontendCalls, hasFetchSignals } from '../lib/parsers/frontend'

// Mock lib/gemini.ts so tests never hit the network
vi.mock('../lib/gemini', () => ({
  generateJSON: vi.fn().mockResolvedValue([]),
}))

// ─── Axios pattern ────────────────────────────────────────────────────────────

describe('parseFrontendCalls — axios pattern', () => {
  // 1. axios.get with static string URL
  it('extracts axios.get with single-quoted URL', async () => {
    const code = "axios.get('/api/users')"
    const calls = await parseFrontendCalls(code)
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/api/users')
    expect(calls[0].pattern).toBe('axios')
  })

  // 2. axios.post with data argument
  it('extracts axios.post with body argument', async () => {
    const code = "axios.post('/api/users', { name: 'Alice' })"
    const calls = await parseFrontendCalls(code)
    const post = calls.find((c) => c.method === 'POST')
    expect(post).toBeDefined()
    expect(post!.path).toBe('/api/users')
    expect(post!.pattern).toBe('axios')
  })

  // 3. axios.put
  it('extracts axios.put', async () => {
    const code = "axios.put('/api/users/1', payload)"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].path).toBe('/api/users/1')
    expect(calls[0].pattern).toBe('axios')
  })

  // 4. axios.delete
  it('extracts axios.delete', async () => {
    const code = "axios.delete('/api/posts/5')"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].path).toBe('/api/posts/5')
    expect(calls[0].pattern).toBe('axios')
  })

  // 5. axios.patch
  it('extracts axios.patch', async () => {
    const code = "axios.patch('/api/profile', updates)"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].path).toBe('/api/profile')
    expect(calls[0].pattern).toBe('axios')
  })

  // 6. Named axios instance (api.get)
  it('extracts named axios instance api.get', async () => {
    const code = "api.get('/api/me')"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/api/me')
    expect(calls[0].pattern).toBe('axios')
  })

  // 7. Template literal URL on axios instance
  it('normalizes template literal URL on axios instance', async () => {
    const code = 'api.get(`/api/users/${userId}`)'
    const calls = await parseFrontendCalls(code)
    expect(calls[0].path).toBe('/api/users/:param0')
    expect(calls[0].isDynamic).toBe(true)
    expect(calls[0].pattern).toBe('axios')
  })

  // 8. Multiple axios calls in one file
  it('returns all axios calls in a file', async () => {
    const code = [
      "axios.get('/api/users')",
      "axios.post('/api/users', data)",
      "axios.delete('/api/users/1')",
    ].join('\n')
    const calls = await parseFrontendCalls(code)
    expect(calls.length).toBeGreaterThanOrEqual(3)
    const methods = calls.map((c) => c.method)
    expect(methods).toContain('GET')
    expect(methods).toContain('POST')
    expect(methods).toContain('DELETE')
  })
})

// ─── Fetch pattern ────────────────────────────────────────────────────────────

describe('parseFrontendCalls — fetch pattern', () => {
  // 1. fetch with no options → GET
  it('defaults to GET when no options provided', async () => {
    const code = "fetch('/api/users')"
    const calls = await parseFrontendCalls(code)
    const match = calls.find((c) => c.path === '/api/users')
    expect(match).toBeDefined()
    expect(match!.method).toBe('GET')
    expect(match!.pattern).toBe('fetch')
  })

  // 2. fetch with explicit POST
  it('extracts POST from method option', async () => {
    const code = "fetch('/api/users', { method: 'POST', body: JSON.stringify(data) })"
    const calls = await parseFrontendCalls(code)
    const match = calls.find((c) => c.path === '/api/users' && c.method === 'POST')
    expect(match).toBeDefined()
    expect(match!.pattern).toBe('fetch')
  })

  // 3. fetch with DELETE
  it('extracts DELETE from method option', async () => {
    const code = "fetch('/api/posts/3', { method: 'DELETE' })"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].path).toBe('/api/posts/3')
    expect(calls[0].pattern).toBe('fetch')
  })

  // 4. fetch with PUT
  it('extracts PUT from method option', async () => {
    const code = "fetch('/api/users/1', { method: 'PUT', body: JSON.stringify(payload) })"
    const calls = await parseFrontendCalls(code)
    const match = calls.find((c) => c.method === 'PUT')
    expect(match).toBeDefined()
    expect(match!.path).toBe('/api/users/1')
  })

  // 5. fetch with template literal URL
  it('normalizes template literal URL in fetch', async () => {
    const code = 'fetch(`/api/items/${itemId}`)'
    const calls = await parseFrontendCalls(code)
    const match = calls.find((c) => c.pattern === 'fetch')
    expect(match).toBeDefined()
    expect(match!.path).toBe('/api/items/:param0')
    expect(match!.isDynamic).toBe(true)
  })

  // 6. fetch with await and variable assignment
  it('extracts fetch from await assignment form', async () => {
    const code = "const res = await fetch('/api/health')"
    const calls = await parseFrontendCalls(code)
    const match = calls.find((c) => c.path === '/api/health')
    expect(match).toBeDefined()
    expect(match!.method).toBe('GET')
    expect(match!.pattern).toBe('fetch')
  })

  // 7. fetch with PATCH
  it('extracts PATCH from method option', async () => {
    const code = "fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' } })"
    const calls = await parseFrontendCalls(code)
    const match = calls.find((c) => c.method === 'PATCH')
    expect(match).toBeDefined()
    expect(match!.path).toBe('/api/settings')
    expect(match!.pattern).toBe('fetch')
  })
})

// ─── Api-client pattern ───────────────────────────────────────────────────────

describe('parseFrontendCalls — api-client pattern', () => {
  // 1. apiClient.get
  it('extracts apiClient.get', async () => {
    const code = "apiClient.get('/api/products')"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/api/products')
    expect(calls[0].pattern).toBe('api-client')
  })

  // 2. httpClient.post
  it('extracts httpClient.post', async () => {
    const code = "httpClient.post('/api/orders', orderData)"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].path).toBe('/api/orders')
    expect(calls[0].pattern).toBe('api-client')
  })

  // 3. userService.delete
  it('extracts userService.delete', async () => {
    const code = "userService.delete('/api/users/7')"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].path).toBe('/api/users/7')
    expect(calls[0].pattern).toBe('api-client')
  })

  // 4. http.put (standalone short name)
  it('extracts http.put', async () => {
    const code = "http.put('/api/config', config)"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].path).toBe('/api/config')
    expect(calls[0].pattern).toBe('api-client')
  })

  // 5. client.patch with template literal
  it('extracts client.patch with template literal URL', async () => {
    const code = 'client.patch(`/api/users/${id}/role`, { role })'
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].path).toBe('/api/users/:param0/role')
    expect(calls[0].isDynamic).toBe(true)
    expect(calls[0].pattern).toBe('api-client')
  })

  // 6. paymentApi.post (suffix-based detection)
  it('extracts paymentApi.post', async () => {
    const code = "paymentApi.post('/api/payments/charge', chargeData)"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].path).toBe('/api/payments/charge')
    expect(calls[0].pattern).toBe('api-client')
  })
})

// ─── React Query pattern ──────────────────────────────────────────────────────

describe('parseFrontendCalls — react-query pattern', () => {
  // 1. useQuery with inline fetch
  it('extracts useQuery with inline fetch call', async () => {
    const code = "useQuery({ queryKey: ['users'], queryFn: () => fetch('/api/users').then(r => r.json()) })"
    const calls = await parseFrontendCalls(code)
    const rq = calls.find((c) => c.pattern === 'react-query')
    expect(rq).toBeDefined()
    expect(rq!.method).toBe('GET')
    expect(rq!.path).toBe('/api/users')
  })

  // 2. useQuery with inline axios.get
  it('extracts useQuery with inline axios.get', async () => {
    const code = "useQuery(['posts'], () => axios.get('/api/posts'))"
    const calls = await parseFrontendCalls(code)
    const rq = calls.find((c) => c.pattern === 'react-query')
    expect(rq).toBeDefined()
    expect(rq!.method).toBe('GET')
    expect(rq!.path).toBe('/api/posts')
  })

  // 3. useMutation with axios.post
  it('extracts useMutation with inline axios.post', async () => {
    const code = "useMutation((data) => axios.post('/api/comments', data))"
    const calls = await parseFrontendCalls(code)
    const rq = calls.find((c) => c.pattern === 'react-query')
    expect(rq).toBeDefined()
    expect(rq!.method).toBe('POST')
    expect(rq!.path).toBe('/api/comments')
  })

  // 4. useQuery with template literal URL
  it('normalizes template literal URL inside useQuery', async () => {
    const code = 'useQuery([`user-${id}`], () => fetch(`/api/users/${id}`))'
    const calls = await parseFrontendCalls(code)
    const rq = calls.find((c) => c.pattern === 'react-query')
    expect(rq).toBeDefined()
    expect(rq!.path).toBe('/api/users/:param0')
    expect(rq!.isDynamic).toBe(true)
  })

  // 5. useMutation with DELETE fetch
  it('extracts useMutation with DELETE fetch', async () => {
    const code = "useMutation((id) => fetch('/api/posts/', { method: 'DELETE' }))"
    const calls = await parseFrontendCalls(code)
    const rq = calls.find((c) => c.pattern === 'react-query')
    expect(rq).toBeDefined()
    expect(rq!.method).toBe('DELETE')
  })

  // 6. Multiple useQuery hooks in one component
  it('extracts two separate calls from two useQuery hooks', async () => {
    const code = [
      "useQuery(['users'], () => axios.get('/api/users'))",
      "useQuery(['products'], () => fetch('/api/products'))",
    ].join('\n')
    const calls = await parseFrontendCalls(code)
    const rqCalls = calls.filter((c) => c.pattern === 'react-query')
    const paths = rqCalls.map((c) => c.path)
    expect(paths).toContain('/api/users')
    expect(paths).toContain('/api/products')
  })
})

// ─── URL normalization ────────────────────────────────────────────────────────

describe('parseFrontendCalls — URL normalization', () => {
  it('replaces single ${...} interpolation with :param0', async () => {
    const code = 'axios.get(`/api/users/${id}`)'
    const calls = await parseFrontendCalls(code)
    expect(calls[0].path).toBe('/api/users/:param0')
    expect(calls[0].isDynamic).toBe(true)
  })

  it('replaces multiple interpolations with :param0, :param1', async () => {
    const code = 'axios.get(`/api/users/${userId}/posts/${postId}`)'
    const calls = await parseFrontendCalls(code)
    expect(calls[0].path).toBe('/api/users/:param0/posts/:param1')
    expect(calls[0].isDynamic).toBe(true)
  })

  it('leaves static URLs unchanged with isDynamic falsy', async () => {
    const code = "axios.get('/api/users')"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].path).toBe('/api/users')
    expect(calls[0].isDynamic).toBeUndefined()
  })

  it('adds leading slash to path without one', async () => {
    const code = "axios.get('api/users')"
    const calls = await parseFrontendCalls(code)
    expect(calls[0].path.startsWith('/')).toBe(true)
  })
})

// ─── Deduplication ────────────────────────────────────────────────────────────

describe('parseFrontendCalls — deduplication', () => {
  it('deduplicates identical axios calls', async () => {
    const code = [
      "axios.get('/api/users')",
      "axios.get('/api/users')",
    ].join('\n')
    const calls = await parseFrontendCalls(code)
    const matches = calls.filter((c) => c.method === 'GET' && c.path === '/api/users')
    expect(matches).toHaveLength(1)
  })

  it('keeps GET and POST to same path as separate calls', async () => {
    const code = [
      "axios.get('/api/users')",
      "axios.post('/api/users', data)",
    ].join('\n')
    const calls = await parseFrontendCalls(code)
    expect(calls.filter((c) => c.path === '/api/users').length).toBeGreaterThanOrEqual(2)
  })
})

// ─── filePath propagation ─────────────────────────────────────────────────────

describe('parseFrontendCalls — filePath', () => {
  it('attaches filePath to all calls when provided', async () => {
    const code = [
      "axios.get('/api/users')",
      "fetch('/api/products')",
    ].join('\n')
    const calls = await parseFrontendCalls(code, { filePath: 'src/api/client.ts' })
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => c.filePath === 'src/api/client.ts')).toBe(true)
  })

  it('leaves filePath undefined when not provided', async () => {
    const code = "axios.get('/api/users')"
    const calls = await parseFrontendCalls(code)
    expect(calls.every((c) => c.filePath === undefined)).toBe(true)
  })
})

// ─── hasFetchSignals ──────────────────────────────────────────────────────────

describe('hasFetchSignals', () => {
  it('returns true for code containing fetch(', () => {
    expect(hasFetchSignals("fetch('/api/users')")).toBe(true)
  })

  it('returns true for code containing axios', () => {
    expect(hasFetchSignals("import axios from 'axios'")).toBe(true)
  })

  it('returns true for code containing useQuery', () => {
    expect(hasFetchSignals("useQuery(['key'], fetcher)")).toBe(true)
  })

  it('returns false for plain code with no fetch signals', () => {
    expect(hasFetchSignals('const x = 1 + 2')).toBe(false)
  })
})
