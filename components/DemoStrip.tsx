'use client'

import { useEffect, useState } from 'react'

const examples = [
  {
    label: '// route detected — express',
    code: `app.get('/api/users/:id', getUserById)
→ GET /api/users/:id  [orphan]  handler: getUserById`,
  },
  {
    label: '// feature classification — gemini',
    code: `routes analyzed: 12
→ authentication     4 routes
→ user management   5 routes
→ payments          3 routes`,
  },
  {
    label: '// typescript types generated',
    code: `interface GetUserByIdResponse {
  id: string
  email: string
  createdAt: string
}

async function getUser(id: string): Promise<GetUserByIdResponse>`,
  },
]

export function DemoStrip() {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % examples.length)
        setVisible(true)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const example = examples[current]

  return (
    <div className="border border-border-default bg-bg-secondary">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-default">
        <div className="w-2 h-2 bg-fg-tertiary" />
        <div className="w-2 h-2 bg-fg-tertiary" />
        <div className="w-2 h-2 bg-fg-tertiary" />
        <span
          className="font-mono text-xs text-fg-tertiary ml-2 lowercase"
          style={{ letterSpacing: '0.08em' }}
        >
          gap terminal
        </span>
      </div>
      <pre
        className="font-mono text-sm text-fg-secondary p-6 overflow-x-auto transition-opacity duration-300 whitespace-pre-wrap"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <span className="text-fg-tertiary block mb-2">{example.label}</span>
        <span className="text-fg-primary">{example.code}</span>
      </pre>
    </div>
  )
}
