import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readSelectedFolder } from '../lib/repo/folder-reader'

// Mock FileReader (browser API not available in Node test environment)
beforeAll(() => {
  vi.stubGlobal('FileReader', class MockFileReader {
    result: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    readAsText(file: File) {
      file.text().then((text) => {
        this.result = text
        this.onload?.()
      }).catch(() => {
        this.onerror?.()
      })
    }
  })
})

function makeFile(name: string, content: string, webkitRelativePath?: string): File {
  const file = new File([content], name, { type: 'text/plain' })
  Object.defineProperty(file, 'webkitRelativePath', {
    value: webkitRelativePath ?? name,
    writable: false,
  })
  return file
}

function makeFileList(files: File[]): FileList {
  const list: Record<string | number | symbol, unknown> = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () { yield* files },
  }
  for (let i = 0; i < files.length; i++) {
    list[i] = files[i]
  }
  return list as unknown as FileList
}

describe('readSelectedFolder', () => {
  it('reads source files and returns correct paths', async () => {
    const files = [
      makeFile('auth.ts', 'export const login = () => {}', 'myproject/src/auth.ts'),
      makeFile('users.ts', 'export const getUsers = () => {}', 'myproject/src/users.ts'),
    ]
    const result = await readSelectedFolder(makeFileList(files))
    expect(result.files).toHaveLength(2)
    expect(result.files[0].path).toBe('src/auth.ts')
    expect(result.totalFiles).toBe(2)
    expect(result.skippedFiles).toBe(0)
    expect(result.repoUrl).toBeUndefined()
    expect(result.branch).toBeUndefined()
  })

  it('excludes files in node_modules', async () => {
    const files = [
      makeFile('index.js', 'module.exports = {}', 'myproject/node_modules/express/index.js'),
      makeFile('app.ts', 'const app = express()', 'myproject/src/app.ts'),
    ]
    const result = await readSelectedFolder(makeFileList(files))
    expect(result.files).toHaveLength(1)
    expect(result.files[0].path).toBe('src/app.ts')
  })

  it('skips binary files (null bytes)', async () => {
    const binaryContent = 'normal text\x00binary data'
    const files = [
      makeFile('image.ts', binaryContent, 'myproject/image.ts'),
      makeFile('clean.ts', 'export const x = 1', 'myproject/clean.ts'),
    ]
    const result = await readSelectedFolder(makeFileList(files))
    expect(result.files).toHaveLength(1)
    expect(result.skippedFiles).toBe(1)
  })

  it('caps result at 200 files', async () => {
    const files = Array.from({ length: 220 }, (_, i) =>
      makeFile(`file${i}.ts`, `export const f${i} = ${i}`, `myproject/src/file${i}.ts`)
    )
    const result = await readSelectedFolder(makeFileList(files))
    expect(result.files.length).toBeLessThanOrEqual(200)
    expect(result.skippedFiles).toBeGreaterThan(0)
  })

  it('skips files larger than 500KB', async () => {
    const largeContent = 'x'.repeat(600 * 1024)
    const largeFile = new File([largeContent], 'large.ts', { type: 'text/plain' })
    Object.defineProperty(largeFile, 'webkitRelativePath', { value: 'myproject/large.ts' })
    const smallFile = makeFile('small.ts', 'const x = 1', 'myproject/small.ts')

    const result = await readSelectedFolder(makeFileList([largeFile, smallFile]))
    const small = result.files.find((f) => f.path === 'small.ts')
    const large = result.files.find((f) => f.path === 'large.ts')
    expect(small).toBeDefined()
    expect(large).toBeUndefined()
    expect(result.skippedFiles).toBe(1)
  })

  it('ignores non-source files', async () => {
    const files = [
      makeFile('README.md', '# readme', 'myproject/README.md'),
      makeFile('routes.ts', 'export const r = () => {}', 'myproject/routes.ts'),
    ]
    const result = await readSelectedFolder(makeFileList(files))
    expect(result.files).toHaveLength(1)
    expect(result.files[0].path).toBe('routes.ts')
  })
})
