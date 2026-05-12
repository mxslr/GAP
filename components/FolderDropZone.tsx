'use client'

import { useState, useRef } from 'react'
import type { RepoContent } from '../lib/types'
import { readDroppedFolder, readSelectedFolder } from '../lib/repo/folder-reader'

interface FolderDropZoneProps {
  onFilesRead: (content: RepoContent) => void
  label?: string
  disabled?: boolean
  fileCount?: number
  skippedCount?: number
}

export function FolderDropZone({
  onFilesRead,
  label,
  disabled,
  fileCount,
  skippedCount,
}: FolderDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (disabled || reading) return
    setReading(true)
    try {
      const content = await readDroppedFolder(e.dataTransfer.items)
      onFilesRead(content)
    } finally {
      setReading(false)
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return
    setReading(true)
    try {
      const content = await readSelectedFolder(e.target.files)
      onFilesRead(content)
    } finally {
      setReading(false)
    }
  }

  const hasFiles = fileCount !== undefined && fileCount > 0
  const isActive = dragOver && !disabled && !reading

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span
          className="font-mono text-xs text-fg-secondary lowercase"
          style={{ letterSpacing: '0.08em' }}
        >
          {label}
        </span>
      )}

      <div
        onClick={() => !disabled && !reading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center gap-3 py-12 px-6 cursor-pointer transition-all duration-200"
        style={{
          border: isActive ? '1px solid #FFFFFF' : '1px dashed #2A2A2A',
          background: isActive ? '#141414' : 'transparent',
          borderRadius: 0,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {reading ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-5 h-5 border border-fg-primary animate-spin"
              style={{ animationTimingFunction: 'linear', borderRadius: 0 }}
            />
            <p className="font-mono text-xs text-fg-secondary lowercase" style={{ letterSpacing: '0.05em' }}>
              reading files...
            </p>
          </div>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
              className="text-fg-secondary"
            >
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <div className="text-center">
              <p
                className="font-display text-sm font-bold text-fg-primary uppercase"
                style={{ letterSpacing: '-0.01em' }}
              >
                {hasFiles ? 'folder loaded' : 'drop folder here'}
              </p>
              <p
                className="font-mono text-xs text-fg-secondary lowercase mt-1"
                style={{ letterSpacing: '0.05em' }}
              >
                {hasFiles ? `${fileCount} files detected · node_modules excluded` : 'or click to browse'}
              </p>
              {hasFiles && skippedCount !== undefined && skippedCount > 0 && (
                <p
                  className="font-mono text-xs mt-1 lowercase"
                  style={{ color: '#FBBF24', letterSpacing: '0.05em' }}
                >
                  {skippedCount} files skipped (binary or too large)
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in TS types
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  )
}
