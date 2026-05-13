import { generateJSON } from '../ai-provider'
import type { FileEntry, FileTreeEntry, MonorepoLayout } from '../types'

// ── Constants ──────────────────────────────────────────────────────────────

const BACKEND_FOLDER_NAMES = new Set([
  'backend', 'server', 'api', 'service', 'services',
  'srv', 'app_server', 'be',
])

const FRONTEND_FOLDER_NAMES = new Set([
  'frontend', 'client', 'web', 'ui', 'fe',
  'app_client', 'portal', 'spa',
])

const BACKEND_INDICATOR_FILES = new Set([
  'requirements.txt', 'pyproject.toml', 'setup.py',
  'composer.json', 'artisan',
])

const FRONTEND_INDICATOR_FILES = new Set([
  'index.html', 'vite.config.ts', 'vite.config.js',
  'vue.config.js', 'svelte.config.js', 'angular.json',
])

const BACKEND_NPM_DEPS = [
  'express', 'koa', 'fastify', '@nestjs/core', 'hapi',
  'restify', 'sails', 'feathers',
]

const FRONTEND_NPM_DEPS = [
  'react', 'react-dom', 'vue', '@vue/core', 'next', 'nuxt',
  'svelte', '@sveltejs/kit', 'gatsby', 'astro', 'remix',
  '@remix-run/react',
]

const WRAPPER_FOLDER_NAMES = new Set(['apps', 'packages'])

// ── FileEntry[] helpers ───────────────────────────────────────────────────

/**
 * Parse a combined code string (produced by filesToCode) back into FileEntry[].
 * Format expected: "// === FILE: path ===\n<content>"
 */
export function parseCodeToFileEntries(combinedCode: string): FileEntry[] {
  const FILE_SEP_RE = /^\/\/ === FILE: (.+?) ===$/gm
  const files: FileEntry[] = []
  let prevPath = ''
  let prevEnd = 0

  FILE_SEP_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FILE_SEP_RE.exec(combinedCode)) !== null) {
    if (prevPath) {
      const content = combinedCode.slice(prevEnd, match.index).trim()
      files.push({ path: prevPath, content, size: content.length })
    }
    prevPath = match[1].trim()
    prevEnd = match.index + match[0].length
  }
  if (prevPath) {
    const content = combinedCode.slice(prevEnd).trim()
    files.push({ path: prevPath, content, size: content.length })
  }
  return files
}

/**
 * Convert FileEntry[] (real repo files) into FileTreeEntry[] for heuristic analysis.
 * Derives directory entries from file paths.
 */
function fileEntriesToTree(files: FileEntry[]): FileTreeEntry[] {
  const entries: FileTreeEntry[] = []
  const dirs = new Set<string>()

  for (const file of files) {
    entries.push({ path: file.path, type: 'file', content: file.content })
    const parts = file.path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/')
      if (!dirs.has(dirPath)) {
        dirs.add(dirPath)
        entries.push({ path: dirPath, type: 'dir' })
      }
    }
  }
  return entries
}

// ── Text tree parser (tasks 2.1–2.3) ─────────────────────────────────────

export function parseTextTree(raw: string): FileTreeEntry[] {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0)
  const entries: FileTreeEntry[] = []

  for (const line of lines) {
    // Strip tree drawing characters and leading/trailing whitespace
    const cleaned = line
      .replace(/[├└─│]/g, '')
      .replace(/^\s*/, '')
      .trim()

    if (!cleaned || cleaned === '.') continue

    // Determine type: no extension → dir, has extension → file
    // Trailing slash is an explicit dir marker
    const isDir = cleaned.endsWith('/') || !cleaned.includes('.')
    const path = cleaned.replace(/\/$/, '')

    entries.push({ path, type: isDir ? 'dir' : 'file' })
  }

  return entries
}

// ── Apps wrapper detection (task 3.5) ────────────────────────────────────

export function detectAppsWrapper(entries: FileTreeEntry[]): FileTreeEntry[] {
  const topDirs = entries.filter((e) => e.type === 'dir' && !e.path.includes('/'))

  for (const dir of topDirs) {
    if (WRAPPER_FOLDER_NAMES.has(dir.path.toLowerCase())) {
      // Return children of this wrapper (one level deep)
      return entries.filter(
        (e) => e.path.startsWith(dir.path + '/') && e.path.split('/').length === 2
      )
    }
  }

  return entries
}

// ── Package.json dep inspection ──────────────────────────────────────────

function hasNpmDeps(content: string, deps: string[]): boolean {
  try {
    const pkg = JSON.parse(content) as Record<string, unknown>
    const allDeps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
      ...(pkg.peerDependencies as Record<string, string> | undefined),
    }
    return deps.some((dep) => dep in allDeps)
  } catch {
    return false
  }
}

// ── Heuristic: folder names (task 3.3) ──────────────────────────────────

function classifyByFolderName(entries: FileTreeEntry[]): {
  backendPaths: string[]
  frontendPaths: string[]
  confidence: 'high' | 'medium' | 'low'
} {
  const topDirs = entries.filter((e) => e.type === 'dir' && !e.path.includes('/'))

  const backendPaths: string[] = []
  const frontendPaths: string[] = []

  for (const dir of topDirs) {
    const name = dir.path.split('/').pop()?.toLowerCase() ?? ''
    if (BACKEND_FOLDER_NAMES.has(name)) backendPaths.push(dir.path + '/')
    if (FRONTEND_FOLDER_NAMES.has(name)) frontendPaths.push(dir.path + '/')
  }

  const hasBoth = backendPaths.length > 0 && frontendPaths.length > 0
  const confidence = hasBoth ? 'medium' : 'low'

  return { backendPaths, frontendPaths, confidence }
}

// ── Heuristic: indicator files (task 3.4) ────────────────────────────────

function classifyByIndicatorFiles(entries: FileTreeEntry[]): {
  backendPaths: string[]
  frontendPaths: string[]
  confidence: 'high' | 'medium' | 'low'
} {
  const backendPaths: string[] = []
  const frontendPaths: string[] = []

  // Group files by their parent folder (or '' for root)
  const filesByParent = new Map<string, FileTreeEntry[]>()
  for (const entry of entries) {
    if (entry.type !== 'file') continue
    const parts = entry.path.split('/')
    const parent = parts.length > 1 ? parts[0] : ''
    const bucket = filesByParent.get(parent) ?? []
    bucket.push(entry)
    filesByParent.set(parent, bucket)
  }

  for (const [parent, files] of Array.from(filesByParent)) {
    const prefix = parent ? parent + '/' : ''

    for (const file of files) {
      const filename = file.path.split('/').pop() ?? ''

      // Non-npm indicator files
      if (BACKEND_INDICATOR_FILES.has(filename)) {
        const target = prefix || '/'
        if (!backendPaths.includes(target)) backendPaths.push(target)
        continue
      }

      if (FRONTEND_INDICATOR_FILES.has(filename)) {
        const target = prefix || '/'
        if (!frontendPaths.includes(target)) frontendPaths.push(target)
        continue
      }

      // package.json with content → inspect deps
      if (filename === 'package.json' && file.content) {
        const target = prefix || '/'
        if (hasNpmDeps(file.content, BACKEND_NPM_DEPS) && !backendPaths.includes(target)) {
          backendPaths.push(target)
        }
        if (hasNpmDeps(file.content, FRONTEND_NPM_DEPS) && !frontendPaths.includes(target)) {
          frontendPaths.push(target)
        }
      }
    }
  }

  const hasBoth = backendPaths.length > 0 && frontendPaths.length > 0
  const confidence: 'high' | 'medium' | 'low' = hasBoth ? 'high' : backendPaths.length > 0 || frontendPaths.length > 0 ? 'medium' : 'low'

  return { backendPaths, frontendPaths, confidence }
}

// ── Merge heuristic results (task 3.6) ───────────────────────────────────

function mergeHeuristics(
  byName: ReturnType<typeof classifyByFolderName>,
  byFile: ReturnType<typeof classifyByIndicatorFiles>
): { backendPaths: string[]; frontendPaths: string[]; confidence: 'high' | 'medium' | 'low' } {
  const backendSet = new Set([...byName.backendPaths, ...byFile.backendPaths])
  const frontendSet = new Set([...byName.frontendPaths, ...byFile.frontendPaths])

  const backendPaths = Array.from(backendSet)
  const frontendPaths = Array.from(frontendSet)

  // Any indicator file evidence → 'high'; folder name only → 'medium'; nothing → 'low'
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (byFile.backendPaths.length > 0 || byFile.frontendPaths.length > 0) {
    confidence = 'high'
  } else if (byName.backendPaths.length > 0 || byName.frontendPaths.length > 0) {
    confidence = 'medium'
  }

  return { backendPaths, frontendPaths, confidence }
}

// ── Gemini LLM fallback (tasks 4.1–4.3) ──────────────────────────────────

interface GeminiFolderClassification {
  folders: Array<{
    name: string
    role: 'backend' | 'frontend' | 'shared' | 'other'
    reasoning: string
  }>
}

const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    folders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: ['backend', 'frontend', 'shared', 'other'] },
          reasoning: { type: 'string' },
        },
        required: ['name', 'role', 'reasoning'],
      },
    },
  },
  required: ['folders'],
}

async function classifyWithGemini(
  topLevelFolders: string[]
): Promise<{ backendPaths: string[]; frontendPaths: string[]; confidence: 'medium'; reasoning: string }> {
  const folderList = topLevelFolders.join(', ')
  const prompt = `You are analyzing a software repository structure. The top-level folders are: ${folderList}.

For each folder, classify its role as one of:
- "backend": server-side code (API handlers, databases, business logic)
- "frontend": client-side code (UI components, pages, assets)
- "shared": shared utilities used by both backend and frontend
- "other": configuration, documentation, tooling, or unrelated folders

Respond with a JSON object classifying every folder with a brief reasoning.`

  const result = await generateJSON<GeminiFolderClassification>(prompt, GEMINI_SCHEMA)

  const backendPaths: string[] = []
  const frontendPaths: string[] = []
  const reasonings: string[] = []

  for (const item of result.folders) {
    if (item.role === 'backend') backendPaths.push(item.name + '/')
    if (item.role === 'frontend') frontendPaths.push(item.name + '/')
    reasonings.push(`${item.name}: ${item.reasoning}`)
  }

  return {
    backendPaths,
    frontendPaths,
    confidence: 'medium',
    reasoning: reasonings.join(' | '),
  }
}

// ── Next.js full-stack detection ─────────────────────────────────────────

function isNextjsFullstack(entries: FileTreeEntry[]): boolean {
  // Root package.json contains 'next' and there are no separate BE/FE named folders
  const rootPkg = entries.find(
    (e) => e.type === 'file' && e.path === 'package.json' && e.content
  )
  if (!rootPkg?.content) return false

  if (!hasNpmDeps(rootPkg.content, ['next'])) return false

  // Check for separate BE/FE folders — if present, this is NOT a pure Next.js monolith
  const topDirs = entries.filter((e) => e.type === 'dir' && !e.path.includes('/'))
  const hasSeparateFolders = topDirs.some((d) => {
    const name = d.path.toLowerCase()
    return BACKEND_FOLDER_NAMES.has(name) || FRONTEND_FOLDER_NAMES.has(name)
  })

  return !hasSeparateFolders
}

// ── Main exported function (tasks 5.1–5.5) ───────────────────────────────

function normalizeToTreeEntries(input: FileEntry[] | FileTreeEntry[]): FileTreeEntry[] {
  if (input.length === 0) return []
  // Distinguish by presence of 'size' (FileEntry) vs 'type' (FileTreeEntry)
  if ('size' in input[0]) {
    return fileEntriesToTree(input as FileEntry[])
  }
  return input as FileTreeEntry[]
}

export async function detectMonorepoLayout(
  input: FileEntry[] | FileTreeEntry[]
): Promise<MonorepoLayout> {
  const entries = normalizeToTreeEntries(input)

  // Next.js full-stack shortcut — BE and FE share root
  if (isNextjsFullstack(entries)) {
    return {
      backendPaths: ['/'],
      frontendPaths: ['/'],
      confidence: 'high',
      reasoning: 'Root package.json contains Next.js — backend and frontend share the same directory.',
    }
  }

  // Apply apps/packages wrapper unwrapping (Nx/Turborepo)
  const rawEffective = detectAppsWrapper(entries)
  const usedWrapper = rawEffective !== entries

  // If wrapper found, determine prefix and normalize paths for heuristics
  let wrapperPrefix = ''
  let effectiveEntries = rawEffective
  if (usedWrapper && rawEffective.length > 0) {
    const sample = rawEffective[0].path
    wrapperPrefix = sample.includes('/') ? sample.split('/')[0] + '/' : ''
    effectiveEntries = rawEffective.map((e) => ({
      ...e,
      path: e.path.startsWith(wrapperPrefix) ? e.path.slice(wrapperPrefix.length) : e.path,
    }))
  }

  // Heuristic passes (on normalized paths)
  const byName = classifyByFolderName(effectiveEntries)
  const byFile = classifyByIndicatorFiles(effectiveEntries)
  const merged = mergeHeuristics(byName, byFile)

  // Re-add wrapper prefix to result paths
  const addPrefix = (paths: string[]) =>
    paths.map((p) => (wrapperPrefix && p !== '/' ? wrapperPrefix + p : p))

  const backendPaths = addPrefix(merged.backendPaths)
  const frontendPaths = addPrefix(merged.frontendPaths)

  if (merged.confidence !== 'low') {
    return {
      backendPaths,
      frontendPaths,
      confidence: merged.confidence,
    }
  }

  // LLM fallback — heuristics were insufficient
  const topDirs = effectiveEntries
    .filter((e) => e.type === 'dir' && !e.path.includes('/'))
    .map((e) => e.path)

  if (topDirs.length === 0) {
    return { backendPaths: [], frontendPaths: [], confidence: 'low' }
  }

  try {
    const geminiResult = await classifyWithGemini(topDirs)
    return {
      backendPaths: addPrefix(geminiResult.backendPaths),
      frontendPaths: addPrefix(geminiResult.frontendPaths),
      confidence: geminiResult.confidence,
      reasoning: geminiResult.reasoning,
    }
  } catch {
    // LLM failed — return what we have with low confidence
    return {
      backendPaths,
      frontendPaths,
      confidence: 'low',
      reasoning: 'Heuristics inconclusive and LLM fallback failed.',
    }
  }
}
