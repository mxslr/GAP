import type { RepoContent, FileEntry } from '../types'

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.php',
  '.java', '.go', '.rb', '.cs',
])
const EXCLUDED_SEGMENTS = new Set([
  'node_modules', '.next', 'dist', 'build', '__pycache__', 'vendor', '.git', 'coverage',
  'migrations', 'migration', 'seeds', 'seeders', 'seed',
  'static', 'public', 'assets', 'images', 'icons', 'fonts', 'media',
  '__tests__', '__mocks__', 'tests', 'test', 'spec',
  'storybook', '.storybook', 'stories',
])
const EXCLUDED_EXTENSIONS = new Set([
  '.md', '.json', '.yaml', '.yml', '.lock', '.env', '.txt',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2',
  '.css', '.scss', '.sass', '.less',
  '.sh', '.bash', '.zsh', '.log', '.csv', '.xml', '.toml',
])
const MAX_FILES = 30
const MAX_PRIORITY_FILES = 15
const MAX_CONCURRENCY = 10
const FETCH_TIMEOUT_MS = 15_000

const ROUTE_DIRS = new Set([
  'routes', 'route', 'controllers', 'controller',
  'handlers', 'handler', 'api', 'endpoints', 'endpoint', 'routers',
])
const ROUTE_FILENAME_RE = /^(routes?|router|routers?|index|app|server|main)\.[tj]sx?$/i

function isRouteFile(filePath: string): boolean {
  const parts = filePath.split('/')
  const filename = parts[parts.length - 1].toLowerCase()
  if (ROUTE_FILENAME_RE.test(filename)) return true
  return parts.some((p) => ROUTE_DIRS.has(p.toLowerCase()))
}

function isUtilityOnlyFile(filePath: string): boolean {
  const filename = (filePath.split('/').pop() ?? '').toLowerCase()
  return (
    /\.(config|setup|constants?|utils?|helpers?|mock|d)\.[tj]sx?$/.test(filename) &&
    !filename.includes('route')
  )
}

interface ParsedUrl {
  owner: string
  repo: string
  branch?: string
  subfolder?: string
}

interface GitTreeItem {
  path: string
  type: string
  url: string
  size?: number
}

interface GitTreeResponse {
  tree: GitTreeItem[]
  truncated?: boolean
}

interface RepoInfo {
  default_branch: string
}

export function parseGithubUrl(url: string): ParsedUrl {
  const cleaned = url.trim().replace(/\/$/, '').replace(/\.git$/, '')
  const match = cleaned.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+)(\/.*)?)?$/
  )
  if (!match) {
    throw new Error('Invalid GitHub URL format')
  }
  const [, owner, repo, branch, subfolderRaw] = match
  return {
    owner,
    repo,
    branch: branch ?? undefined,
    subfolder: subfolderRaw ? subfolderRaw.replace(/^\//, '') : undefined,
  }
}

function buildHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN
  // TEMP diagnostic — remove after confirming token is read
  console.log('[github-fetcher] token present:', !!token)
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'GAP-API-Intelligence/1.0',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function isExcluded(filePath: string): boolean {
  const parts = filePath.split('/')
  if (parts.some((p) => EXCLUDED_SEGMENTS.has(p.toLowerCase()))) return true
  const filename = parts[parts.length - 1]
  if (/\.(test|spec)\.[^.]+$/.test(filename)) return true
  const ext = filename.slice(filename.lastIndexOf('.'))
  if (EXCLUDED_EXTENSIONS.has(ext)) return true
  if (isUtilityOnlyFile(filePath)) return true
  return false
}

function hasSourceExtension(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return false
  return SOURCE_EXTENSIONS.has(filePath.slice(dot))
}

async function timedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    console.log('[github-fetcher] fetching:', url)
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } catch (error) {
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause
      console.error('[github-fetcher] fetch error:', {
        message: error.message,
        cause: cause instanceof Error ? cause.message : String(cause ?? ''),
        url,
      })
      if (error.name === 'AbortError') {
        throw new Error(`GitHub request timed out after ${FETCH_TIMEOUT_MS / 1000}s — check your network or paste code directly`)
      }
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchWithErrorHandling(url: string): Promise<Response> {
  const res = await timedFetch(url, { headers: buildHeaders() })
  if (res.status === 403) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    if (body?.message?.toLowerCase().includes('rate limit')) {
      throw new Error('GitHub rate limit reached — add GITHUB_TOKEN to .env or paste code directly')
    }
    throw new Error('GitHub API access denied (403) — check your GITHUB_TOKEN or paste code directly')
  }
  if (res.status === 404) {
    throw new Error('Repository not found — check the URL or paste code directly')
  }
  if (!res.ok) {
    throw new Error(`GitHub fetch failed: HTTP ${res.status}`)
  }
  return res
}

async function resolveDefaultBranch(owner: string, repo: string): Promise<string> {
  try {
    const res = await timedFetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: buildHeaders() }
    )
    if (!res.ok) return 'main'
    const data = await res.json() as RepoInfo
    return data.default_branch ?? 'main'
  } catch {
    return 'main'
  }
}

// Primary: GitHub Trees API (recursive, one request for full tree)
async function fetchFileTree(
  owner: string,
  repo: string,
  branch: string,
  subfolder?: string
): Promise<GitTreeItem[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  let res: Response
  try {
    res = await fetchWithErrorHandling(url)
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('rate limit') ||
      err.message.includes('access denied') ||
      err.message.includes('not found') ||
      err.message.includes('timed out')
    )) {
      throw err
    }
    throw new Error(`GitHub fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const data = await res.json() as GitTreeResponse
  const items = data.tree ?? []
  const blobs = items.filter((item) => item.type === 'blob')

  const folderFilter = (item: GitTreeItem) =>
    !subfolder || item.path.startsWith(subfolder + '/') || item.path.startsWith(subfolder)

  let filtered = blobs
    .filter((item) => hasSourceExtension(item.path))
    .filter((item) => !isExcluded(item.path))
    .filter(folderFilter)

  if (filtered.length === 0) {
    filtered = blobs
      .filter((item) => !isExcluded(item.path))
      .filter((item) => !item.size || item.size < 500_000)
      .filter(folderFilter)
  }

  // Priority 1: route/controller/handler files (up to MAX_PRIORITY_FILES)
  const priority1 = filtered.filter((item) => isRouteFile(item.path)).slice(0, MAX_PRIORITY_FILES)
  // Priority 2: remaining source files to fill up to MAX_FILES
  const priority1Paths = new Set(priority1.map((i) => i.path))
  const priority2 = filtered
    .filter((item) => !priority1Paths.has(item.path))
    .slice(0, MAX_FILES - priority1.length)

  const result = [...priority1, ...priority2]
  console.log(
    `[github-fetcher] total tree: ${blobs.length} blobs, filtered: ${filtered.length}, selected: ${result.length} (${priority1.length} route files + ${priority2.length} other)`
  )
  return result
}

// Fallback: GitHub Contents API (directory listing, then fetch each file via raw URL)
async function fetchFileTreeViaContents(
  owner: string,
  repo: string,
  branch: string,
  subfolder?: string
): Promise<GitTreeItem[]> {
  const basePath = subfolder ?? ''
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${basePath}?ref=${branch}`

  interface ContentsItem {
    path: string
    type: string
    url: string
    size?: number
    download_url?: string | null
  }

  let res: Response
  try {
    res = await fetchWithErrorHandling(url)
  } catch {
    return []
  }

  const raw = await res.json() as ContentsItem | ContentsItem[]
  const items: ContentsItem[] = Array.isArray(raw) ? raw : [raw]

  // Only files (not dirs) at root level — no deep recursion in fallback to stay within rate limit
  const blobs: GitTreeItem[] = items
    .filter((item) => item.type === 'file')
    .filter((item) => hasSourceExtension(item.path))
    .filter((item) => !isExcluded(item.path))
    .map((item) => ({
      path: item.path,
      type: 'blob',
      url: item.download_url ?? item.url,
      size: item.size,
    }))

  return blobs.slice(0, MAX_FILES)
}

// Fetch file via blob API; fall back to raw.githubusercontent.com
async function fetchFileContent(
  item: GitTreeItem,
  owner: string,
  repo: string,
  branch: string
): Promise<FileEntry | null> {
  // Try blob API first
  try {
    const res = await timedFetch(item.url, { headers: buildHeaders() })
    if (res.ok) {
      const data = await res.json() as { content?: string; size?: number }
      if (data.content) {
        const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
        return { path: item.path, content, size: data.size ?? item.size ?? content.length }
      }
    }
  } catch {
    // fall through to raw URL
  }

  // Fallback: raw.githubusercontent.com (no API rate limit, no auth needed)
  try {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`
    const res = await timedFetch(rawUrl)
    if (res.ok) {
      const content = await res.text()
      return { path: item.path, content, size: content.length }
    }
  } catch {
    // give up on this file
  }

  return null
}

async function fetchInBatches(
  items: GitTreeItem[],
  owner: string,
  repo: string,
  branch: string
): Promise<FileEntry[]> {
  const results: FileEntry[] = []
  for (let i = 0; i < items.length; i += MAX_CONCURRENCY) {
    const batch = items.slice(i, i + MAX_CONCURRENCY)
    const settled = await Promise.all(batch.map((item) => fetchFileContent(item, owner, repo, branch)))
    for (const entry of settled) {
      if (entry) results.push(entry)
    }
  }
  return results
}

export async function fetchGithubRepo(url: string): Promise<RepoContent> {
  const parsed = parseGithubUrl(url)

  let branch = parsed.branch
  if (!branch) {
    branch = await resolveDefaultBranch(parsed.owner, parsed.repo)
  } else {
    try {
      const probeUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`
      const probe = await timedFetch(probeUrl, { headers: buildHeaders() })
      if (probe.status === 404) {
        const masterProbe = await timedFetch(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/master?recursive=1`,
          { headers: buildHeaders() }
        )
        branch = masterProbe.ok ? 'master' : await resolveDefaultBranch(parsed.owner, parsed.repo)
      }
    } catch {
      // keep original branch
    }
  }

  // Primary: trees API
  let treeItems = await fetchFileTree(parsed.owner, parsed.repo, branch, parsed.subfolder).catch(() => [] as GitTreeItem[])

  // Fallback: contents API if trees API returned nothing
  if (treeItems.length === 0) {
    console.log('[github-fetcher] trees API returned 0 items — trying contents API fallback')
    treeItems = await fetchFileTreeViaContents(parsed.owner, parsed.repo, branch, parsed.subfolder)
  }

  const files = await fetchInBatches(treeItems, parsed.owner, parsed.repo, branch)

  if (files.length === 0) {
    throw new Error('No source files found in this repository. Try pasting the code directly instead.')
  }

  return {
    files,
    repoUrl: url,
    branch,
    totalFiles: files.length,
    skippedFiles: treeItems.length - files.length,
  }
}
