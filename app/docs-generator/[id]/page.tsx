'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ApiDocPanel } from '../../../components/ApiDocPanel'
import { Spinner } from '../../../components/Spinner'

interface DocDetail {
  id: string
  mode: string
  createdAt: string
  apiDoc: {
    markdownDoc: string
    openapiJson: string | null
  } | null
}

export default function DocsDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [detail, setDetail] = useState<DocDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copyLabel, setCopyLabel] = useState('copy markdown')

  useEffect(() => {
    if (!id) return
    fetch(`/api/analyses/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return }
        const data = await res.json()
        if (data.mode !== 'backend-only') {
          router.replace(`/analyze/${id}`)
          return
        }
        setDetail(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, router])

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopyMarkdown() {
    if (!detail?.apiDoc?.markdownDoc) return
    try {
      await navigator.clipboard.writeText(detail.apiDoc.markdownDoc)
      setCopyLabel('copied!')
      setTimeout(() => setCopyLabel('copy markdown'), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-primary pt-24 flex items-center justify-center">
        <Spinner size={32} />
      </main>
    )
  }

  if (notFound || !detail) {
    return (
      <main className="min-h-screen bg-bg-primary pt-24 px-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <p className="font-mono text-sm text-fg-tertiary lowercase" style={{ letterSpacing: '0.08em' }}>
            documentation not found.
          </p>
          <Link
            href="/docs-generator"
            className="font-mono text-xs border border-border-default text-fg-secondary px-4 py-2 self-start hover:border-border-hover hover:text-fg-primary transition-all duration-200"
            style={{ borderRadius: 0, letterSpacing: '0.08em' }}
          >
            ← new generation
          </Link>
        </div>
      </main>
    )
  }

  const markdown = detail.apiDoc?.markdownDoc ?? ''
  const openapi = detail.apiDoc?.openapiJson
    ? (() => { try { return JSON.parse(detail.apiDoc!.openapiJson!) } catch { return null } })()
    : null

  return (
    <main className="min-h-screen bg-bg-primary">
      {/* Header */}
      <section className="pt-28 pb-6 px-8 border-b border-border-default">
        <p className="font-mono text-xs text-fg-tertiary uppercase tracking-widest mb-2">
          mode 3 / backend-only
        </p>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1
              className="font-display text-4xl font-bold text-fg-primary leading-tight"
              style={{ letterSpacing: '-0.02em' }}
            >
              API DOCUMENTATION
            </h1>
            <p className="font-mono text-xs text-fg-tertiary mt-1" style={{ letterSpacing: '0.06em' }}>
              generated {new Date(detail.createdAt).toLocaleString()}
            </p>
          </div>
          <Link
            href="/docs-generator"
            className="font-mono text-xs border border-border-default text-fg-secondary px-4 py-2 hover:border-border-hover hover:text-fg-primary transition-all duration-200 whitespace-nowrap mt-1"
            style={{ borderRadius: 0, letterSpacing: '0.08em' }}
          >
            + new generation
          </Link>
        </div>
      </section>

      {/* Export bar */}
      <div className="sticky top-0 z-20 flex items-center justify-end px-8 py-3 border-b border-border-default bg-bg-primary backdrop-blur-sm gap-2">
        <button
          onClick={handleCopyMarkdown}
          className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-all duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
          style={{ borderRadius: 0 }}
        >
          {copyLabel}
        </button>
        <button
          onClick={() => downloadBlob(markdown, 'api-docs.md', 'text/markdown')}
          className="font-mono text-xs text-fg-secondary hover:text-fg-primary transition-all duration-200 border border-border-default px-3 py-1.5 hover:border-fg-primary"
          style={{ borderRadius: 0 }}
        >
          download .md
        </button>
        <button
          onClick={() => openapi && downloadBlob(JSON.stringify(openapi, null, 2), 'openapi.json', 'application/json')}
          disabled={!openapi}
          className="font-mono text-xs transition-all duration-200 border px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed border-border-default text-fg-secondary hover:border-fg-primary hover:text-fg-primary disabled:hover:border-border-default disabled:hover:text-fg-secondary"
          style={{ borderRadius: 0 }}
        >
          download openapi.json
        </button>
      </div>

      {/* Doc content */}
      <div className="animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <ApiDocPanel markdown={markdown} openapi={openapi} />
      </div>
    </main>
  )
}
