'use client'

import { useState } from 'react'
import { RouteCard } from './RouteCard'
import type { FeatureGroup as FeatureGroupType, AnalyzedRoute } from '../lib/types'

interface FeatureGroupProps {
  feature: FeatureGroupType
  routes: AnalyzedRoute[]
}

export function FeatureGroup({ feature, routes }: FeatureGroupProps) {
  const [open, setOpen] = useState(false)
  const featureRoutes = routes.filter((r) => feature.routeIds.includes(r.id))

  return (
    <div className="border border-border-default" style={{ borderRadius: 0 }}>
      {/* Accordion header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-tertiary transition-colors duration-200 cursor-pointer"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold text-fg-primary uppercase" style={{ letterSpacing: '0.05em' }}>
            {feature.name}
          </span>
          <span
            className="font-mono text-xs text-fg-tertiary border border-border-default px-2 py-0.5"
            style={{ borderRadius: 0, letterSpacing: '0.05em' }}
          >
            {featureRoutes.length} routes
          </span>
        </div>

        {/* Chevron — rotates 90° when open */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="text-fg-tertiary transition-transform duration-200"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {/* Accordion body */}
      <div
        style={{
          maxHeight: open ? `${featureRoutes.length * 200 + 200}px` : '0',
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
        }}
      >
        <div className="border-t border-border-default flex flex-col gap-px bg-border-default">
          {featureRoutes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      </div>
    </div>
  )
}
