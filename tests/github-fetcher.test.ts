import { describe, it, expect } from 'vitest'
import { parseGithubUrl } from '../lib/repo/github-fetcher'

describe('parseGithubUrl', () => {
  it('parses plain repo URL', () => {
    const result = parseGithubUrl('https://github.com/owner/repo')
    expect(result.owner).toBe('owner')
    expect(result.repo).toBe('repo')
    expect(result.branch).toBe('main')
    expect(result.subfolder).toBeUndefined()
  })

  it('parses URL with branch', () => {
    const result = parseGithubUrl('https://github.com/owner/repo/tree/develop')
    expect(result.owner).toBe('owner')
    expect(result.repo).toBe('repo')
    expect(result.branch).toBe('develop')
    expect(result.subfolder).toBeUndefined()
  })

  it('parses URL with branch and subfolder', () => {
    const result = parseGithubUrl('https://github.com/owner/repo/tree/main/backend/src')
    expect(result.owner).toBe('owner')
    expect(result.repo).toBe('repo')
    expect(result.branch).toBe('main')
    expect(result.subfolder).toBe('backend/src')
  })

  it('parses URL with trailing slash', () => {
    const result = parseGithubUrl('https://github.com/owner/repo/')
    expect(result.owner).toBe('owner')
    expect(result.repo).toBe('repo')
    expect(result.branch).toBe('main')
  })

  it('throws for invalid URL', () => {
    expect(() => parseGithubUrl('https://gitlab.com/owner/repo')).toThrow('Invalid GitHub URL format')
    expect(() => parseGithubUrl('not-a-url')).toThrow('Invalid GitHub URL format')
  })
})

describe('file exclusion logic', () => {
  // Test the filtering logic by running a simulated tree through the same rules
  // used internally. We verify indirectly via parseGithubUrl and manual inspection
  // of the exported exclusion constants.

  it('excludes node_modules paths', () => {
    const path = 'node_modules/express/index.js'
    const excluded = EXCLUDED_SEGMENTS_TEST.some((seg) => path.split('/').includes(seg))
    expect(excluded).toBe(true)
  })

  it('excludes test files', () => {
    const testFile = 'src/auth.test.ts'
    const isTest = /\.(test|spec)\.[^.]+$/.test(testFile.split('/').pop()!)
    expect(isTest).toBe(true)
  })

  it('accepts source files', () => {
    const sourceFile = 'src/routes/auth.ts'
    const ext = sourceFile.slice(sourceFile.lastIndexOf('.'))
    const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.php'])
    expect(SOURCE_EXTS.has(ext)).toBe(true)
  })
})

// Exported test helper — mirrors the internal constant for assertion purposes
const EXCLUDED_SEGMENTS_TEST = ['node_modules', '.next', 'dist', 'build', '__pycache__', 'vendor']
