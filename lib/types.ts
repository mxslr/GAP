export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type RouteStatus = 'connected' | 'orphan' | 'ghost' | 'documented'

export type AnalysisMode = 'monorepo' | 'separate' | 'backend-only'

export type BackendFramework = 'express' | 'fastapi' | 'laravel' | 'unknown'

export type FrontendPattern = 'axios' | 'fetch' | 'api-client' | 'react-query'

export interface BackendRoute {
  method: HttpMethod
  path: string
  handler?: string
  framework: BackendFramework
  rawSnippet: string
  filePath?: string
}

export interface FrontendCall {
  method: HttpMethod
  path: string
  pattern: FrontendPattern
  rawSnippet: string
  isDynamic?: boolean
  filePath?: string
}

export interface FeatureGroup {
  id: string
  name: string
  description?: string
  routeIds: string[]
}

export interface AnalyzedRoute {
  id: string
  method: HttpMethod
  path: string
  status: RouteStatus
  description?: string
  fetchSnippet?: string
  tsTypes?: string
  featureId?: string
  detectedIn: 'backend' | 'frontend' | 'both'
}

export interface GapAnalysisResult {
  mode: AnalysisMode
  routes: AnalyzedRoute[]
  features: FeatureGroup[]
  summary: {
    total: number
    connected: number
    orphan: number
    ghost: number
  }
  apiDoc?: {
    markdown: string
    openapi?: object
  }
}

export interface MonorepoLayout {
  backendPaths: string[]
  frontendPaths: string[]
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
}

export interface FileTreeEntry {
  path: string
  type: 'file' | 'dir'
  content?: string
}

export interface FileEntry {
  path: string
  content: string
  size: number
}

export interface RepoContent {
  files: FileEntry[]
  repoUrl?: string
  branch?: string
  totalFiles: number
  skippedFiles: number
}
