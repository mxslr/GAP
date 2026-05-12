import type { RepoContent, FileEntry } from '../types'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.php'])
const EXCLUDED_SEGMENTS = ['node_modules', '.next', 'dist', 'build', '__pycache__', 'vendor']
const MAX_FILES = 200
const MAX_FILE_SIZE = 500 * 1024 // 500KB

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

function isBinaryContent(content: string): boolean {
  return content.includes('\0')
}

async function readFileAsText(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}

async function traverseDirectory(
  entry: FileSystemDirectoryEntry,
  basePath: string,
  collected: Array<{ path: string; file: File }>,
  limit: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = entry.createReader()
    const readEntries = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve()
          return
        }
        for (const child of entries) {
          if (collected.length >= limit * 2) break // over-collect then trim later
          const childPath = basePath ? `${basePath}/${child.name}` : child.name
          if (isExcluded(childPath)) continue
          if (child.isFile) {
            if (hasSourceExtension(child.name)) {
              await new Promise<void>((res) => {
                ;(child as FileSystemFileEntry).file(
                  (f) => { collected.push({ path: childPath, file: f }); res() },
                  (_err) => res()
                )
              })
            }
          } else if (child.isDirectory) {
            await traverseDirectory(child as FileSystemDirectoryEntry, childPath, collected, limit)
          }
        }
        readEntries()
      }, reject)
    }
    readEntries()
  })
}

async function processFiles(
  raw: Array<{ path: string; file: File }>
): Promise<{ files: FileEntry[]; skipped: number }> {
  const files: FileEntry[] = []
  let skipped = 0

  for (const { path, file } of raw) {
    if (files.length >= MAX_FILES) {
      skipped++
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      skipped++
      continue
    }
    const content = await readFileAsText(file)
    if (content === null || isBinaryContent(content)) {
      skipped++
      continue
    }
    files.push({ path, content, size: file.size })
  }

  return { files, skipped }
}

export async function readDroppedFolder(items: DataTransferItemList): Promise<RepoContent> {
  const raw: Array<{ path: string; file: File }> = []

  const entries: FileSystemEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const entry = item.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      await traverseDirectory(entry as FileSystemDirectoryEntry, '', raw, MAX_FILES)
    } else if (entry.isFile && hasSourceExtension(entry.name) && !isExcluded(entry.name)) {
      await new Promise<void>((resolve) => {
        ;(entry as FileSystemFileEntry).file(
          (f) => { raw.push({ path: entry.name, file: f }); resolve() },
          (_err) => resolve()
        )
      })
    }
  }

  const { files, skipped } = await processFiles(raw)
  return {
    files,
    repoUrl: undefined,
    branch: undefined,
    totalFiles: files.length,
    skippedFiles: skipped,
  }
}

export async function readSelectedFolder(fileList: FileList): Promise<RepoContent> {
  const raw: Array<{ path: string; file: File }> = []

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    // Strip the root folder prefix (first segment) to normalize paths
    const parts = relativePath.split('/')
    const normalizedPath = parts.length > 1 ? parts.slice(1).join('/') : relativePath

    if (!hasSourceExtension(file.name)) continue
    if (isExcluded(normalizedPath)) continue
    raw.push({ path: normalizedPath, file })
  }

  const { files, skipped } = await processFiles(raw)
  return {
    files,
    repoUrl: undefined,
    branch: undefined,
    totalFiles: files.length,
    skippedFiles: skipped,
  }
}
