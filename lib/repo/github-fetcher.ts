import type { RepoContent, FileEntry } from '../types'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.php'])
const EXCLUDED_SEGMENTS = ['node_modules', '.next', 'dist', 'build', '__pycache__', 'vendor']
const MAX_FILES = 100
const MAX_CONCURRENCY = 10

interface ParsedUrl {
  owner: string
  repo: string
  branch: string
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
}

export function parseGithubUrl(url: string): ParsedUrl {
  const cleaned = url.trim().replace(/\/$/, '')
  const match = cleaned.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(\/.*)?)?$/
  )
  if (!match) {
    throw new Error('Invalid GitHub URL format')
  }
  const [, owner, repo, branch, subfolderRaw] = match
  return {
    owner,
    repo,
    branch: branch ?? 'main',
    subfolder: subfolderRaw ? subfolderRaw.replace(/^\//, '') : undefined,
  }
}

function isExcluded(filePath: string): boolean {
  const parts = filePath.split('/')
  if (parts.some((p) => EXCLUDED_SEGMENTS.includes(p))) return true
  const filename = parts[parts.length - 1]
  if (/\.(test|spec)\.[^.]+$/.test(filename)) return true
  return false
}

function hasSourceExtension(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return false
  return SOURCE_EXTENSIONS.has(filePath.slice(dot))
}

async function fetchWithErrorHandling(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (res.status === 403) {
    throw new Error('GitHub rate limit reached, please paste code directly')
  }
  if (res.status === 404) {
    throw new Error('Private repo — please paste code directly or drop folder')
  }
  if (!res.ok) {
    throw new Error(`GitHub fetch failed: HTTP ${res.status}`)
  }
  return res
}

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
    if (err instanceof Error && (err.message.includes('rate limit') || err.message.includes('Private repo'))) {
      throw err
    }
    throw new Error(`GitHub fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const data = await res.json() as GitTreeResponse
  const items = data.tree ?? []

  return items
    .filter((item) => item.type === 'blob')
    .filter((item) => hasSourceExtension(item.path))
    .filter((item) => !isExcluded(item.path))
    .filter((item) => !subfolder || item.path.startsWith(subfolder + '/') || item.path.startsWith(subfolder))
    .slice(0, MAX_FILES)
}

async function fetchFileContent(item: GitTreeItem): Promise<FileEntry | null> {
  try {
    const res = await fetchWithErrorHandling(item.url)
    const data = await res.json() as { content?: string; size?: number }
    if (!data.content) return null
    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    return {
      path: item.path,
      content,
      size: data.size ?? item.size ?? content.length,
    }
  } catch {
    return null
  }
}

async function fetchInBatches(items: GitTreeItem[]): Promise<FileEntry[]> {
  const results: FileEntry[] = []
  for (let i = 0; i < items.length; i += MAX_CONCURRENCY) {
    const batch = items.slice(i, i + MAX_CONCURRENCY)
    const settled = await Promise.all(batch.map(fetchFileContent))
    for (const entry of settled) {
      if (entry) results.push(entry)
    }
  }
  return results
}

export async function fetchGithubRepo(url: string): Promise<RepoContent> {
  const parsed = parseGithubUrl(url)
  const treeItems = await fetchFileTree(parsed.owner, parsed.repo, parsed.branch, parsed.subfolder)
  const files = await fetchInBatches(treeItems)

  return {
    files,
    repoUrl: url,
    branch: parsed.branch,
    totalFiles: files.length,
    skippedFiles: treeItems.length - files.length,
  }
}
