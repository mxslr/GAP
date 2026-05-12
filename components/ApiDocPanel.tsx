'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { Components } from 'react-markdown'

interface TocEntry {
  level: 2 | 3
  text: string
  slug: string
}

interface ApiDocPanelProps {
  markdown: string
  openapi: object | null
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  const lines = markdown.split('\n')
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    if (h3) {
      const text = h3[1].trim()
      entries.push({ level: 3, text, slug: slugify(text) })
    } else if (h2) {
      const text = h2[1].trim()
      entries.push({ level: 2, text, slug: slugify(text) })
    }
  }
  return entries
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs font-mono text-fg-secondary border border-border-default bg-bg-secondary hover:border-fg-primary hover:text-fg-primary transition-all duration-200"
      aria-label="copy code"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  )
}

export function ApiDocPanel({ markdown, openapi }: ApiDocPanelProps) {
  const [search, setSearch] = useState('')
  const [activeSlug, setActiveSlug] = useState('')
  const rightPanelRef = useRef<HTMLDivElement>(null)

  const toc = extractToc(markdown)
  const filteredToc = search
    ? toc.filter((e) => e.text.toLowerCase().includes(search.toLowerCase()))
    : toc

  // IntersectionObserver for active TOC highlight
  useEffect(() => {
    const headings = rightPanelRef.current?.querySelectorAll('h2[id], h3[id]')
    if (!headings || headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 }
    )

    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [markdown])

  if (!markdown) {
    return (
      <div className="flex items-center justify-center h-64 border border-border-default">
        <span className="font-mono text-fg-tertiary text-sm">no documentation to display</span>
      </div>
    )
  }

  const markdownComponents: Components = {
    h2({ children, ...props }) {
      const text = String(children)
      const id = slugify(text)
      return (
        <h2 id={id} {...props}>
          {children}
        </h2>
      )
    },
    h3({ children, ...props }) {
      const text = String(children)
      const id = slugify(text)
      return (
        <h3 id={id} {...props}>
          {children}
        </h3>
      )
    },
    code({ className, children, ...props }) {
      const isBlock = className?.startsWith('language-')
      const codeText = String(children).replace(/\n$/, '')

      if (!isBlock) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      }

      return (
        <div className="relative hljs-wrap my-3">
          <code className={className} {...props}>
            {children}
          </code>
          <CopyButton text={codeText} />
        </div>
      )
    },
  }

  return (
    <div className="flex gap-0 w-full min-h-screen">
      {/* Left sidebar — TOC */}
      <aside className="w-[30%] shrink-0 border-r border-border-default">
        <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="filter routes..."
              className="w-full bg-bg-secondary border border-border-default px-3 py-2 text-xs font-mono text-fg-primary placeholder-fg-tertiary focus:outline-none focus:border-fg-primary transition-colors duration-200"
            />
          </div>

          <nav>
            <p className="text-xs font-mono text-fg-tertiary uppercase tracking-widest mb-3">
              contents
            </p>
            <ul className="space-y-0.5">
              {filteredToc.map((entry) => (
                <li key={entry.slug}>
                  <a
                    href={`#${entry.slug}`}
                    className={[
                      'block font-mono text-xs py-1 transition-colors duration-200',
                      entry.level === 2
                        ? 'pl-0 text-fg-secondary hover:text-fg-primary'
                        : 'pl-3 text-fg-tertiary hover:text-fg-secondary',
                      activeSlug === entry.slug ? 'text-fg-primary' : '',
                    ].join(' ')}
                  >
                    {entry.level === 3 && (
                      <span className="text-fg-tertiary mr-1">›</span>
                    )}
                    {entry.text}
                  </a>
                </li>
              ))}
              {filteredToc.length === 0 && (
                <li className="text-xs font-mono text-fg-tertiary py-1">no matches</li>
              )}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Right panel — rendered Markdown */}
      <div
        ref={rightPanelRef}
        className="w-[70%] p-8 overflow-y-auto doc-prose hljs-wrap"
      >
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  )
}
