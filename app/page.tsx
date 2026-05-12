import { Button } from '@/components/Button'
import { Box } from '@/components/Box'
import { Logo } from '@/components/Logo'
import { DemoStrip } from '@/components/DemoStrip'

const pillars = [
  {
    index: '01',
    title: 'Detect',
    description: 'auto-find routes in any codebase — express, fastapi, laravel',
  },
  {
    index: '02',
    title: 'Connect',
    description: 'match backend ↔ frontend, surface orphans and ghosts',
  },
  {
    index: '03',
    title: 'Organize',
    description: 'group routes by feature with ai — auth, payments, users',
  },
  {
    index: '04',
    title: 'Document',
    description: 'generate full api docs, zero annotation required',
  },
]

const steps = [
  {
    index: '01',
    title: 'paste or upload',
    description: 'backend, frontend, or both — monorepo or separate repos',
  },
  {
    index: '02',
    title: 'ai analyzes',
    description: 'detects routes, matches gaps, classifies by feature',
  },
  {
    index: '03',
    title: 'explore results',
    description: 'flat view, feature view, or generate full api docs',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-bg-primary">
      {/* Hero */}
      <section
        className="stagger-section flex flex-col items-center justify-center min-h-screen px-6 text-center pt-24"
        style={{ animationDelay: '0ms' }}
      >
        <h1
          className="font-display font-bold text-fg-primary leading-none mb-6"
          style={{
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            letterSpacing: '-0.02em',
          }}
        >
          KNOW EVERY ROUTE.
          <br />
          BRIDGE EVERY GAP.
        </h1>
        <p
          className="font-mono text-fg-secondary mb-10 max-w-xl"
          style={{ letterSpacing: '0.08em', fontSize: 'clamp(0.75rem, 1.5vw, 1rem)' }}
        >
          the api intelligence platform for full-stack teams.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="primary" href="/analyze">
            analyze your codebase →
          </Button>
          <Button variant="secondary" href="/docs-generator">
            generate api docs →
          </Button>
        </div>
        <div className="mt-24 w-px h-16 bg-border-default mx-auto" />
      </section>

      {/* Four Pillars */}
      <section
        className="stagger-section px-6 py-24 max-w-7xl mx-auto"
        style={{ animationDelay: '100ms' }}
      >
        <p
          className="font-mono text-fg-tertiary text-xs uppercase mb-8"
          style={{ letterSpacing: '0.18em' }}
        >
          capabilities
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border border-border-default">
          {pillars.map((pillar, i) => (
            <Box
              key={pillar.index}
              className={`p-8 ${i < pillars.length - 1 ? 'border-r-0 border-b border-border-default lg:border-b-0 lg:border-r border-border-default' : ''}`}
            >
              <span
                className="font-mono text-fg-tertiary text-xs block mb-4"
                style={{ letterSpacing: '0.1em' }}
              >
                {pillar.index}
              </span>
              <h2 className="font-display font-bold text-fg-primary text-2xl mb-3 uppercase">
                {pillar.title}
              </h2>
              <p className="font-body text-fg-secondary text-sm leading-relaxed">
                {pillar.description}
              </p>
            </Box>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        className="stagger-section px-6 py-24 max-w-7xl mx-auto border-t border-border-default"
        style={{ animationDelay: '200ms' }}
      >
        <p
          className="font-mono text-fg-tertiary text-xs uppercase mb-12"
          style={{ letterSpacing: '0.18em' }}
        >
          how it works
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.index}
              className={`py-8 px-8 ${i < steps.length - 1 ? 'border-b border-border-default md:border-b-0 md:border-r border-border-default' : ''}`}
            >
              <span
                className="font-mono text-fg-tertiary text-xs block mb-3"
                style={{ letterSpacing: '0.1em' }}
              >
                {step.index} /
              </span>
              <h3
                className="font-mono text-fg-primary text-lg mb-3 lowercase"
                style={{ letterSpacing: '0.05em' }}
              >
                {step.title}
              </h3>
              <p className="font-body text-fg-secondary text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo Strip */}
      <section
        className="stagger-section px-6 py-24 max-w-7xl mx-auto border-t border-border-default"
        style={{ animationDelay: '300ms' }}
      >
        <p
          className="font-mono text-fg-tertiary text-xs uppercase mb-8"
          style={{ letterSpacing: '0.18em' }}
        >
          live preview
        </p>
        <DemoStrip />
      </section>

      {/* Footer */}
      <footer
        className="stagger-section border-t border-border-default px-6 py-16 max-w-7xl mx-auto"
        style={{ animationDelay: '400ms' }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <Logo showTagline size="md" />
          <div className="flex flex-col gap-2 text-right">
            <div className="flex gap-4 justify-end">
              {['next.js', 'prisma', 'gemini', 'kubernetes', 'postgresql'].map((tech) => (
                <span
                  key={tech}
                  className="font-mono text-fg-tertiary text-xs lowercase"
                  style={{ letterSpacing: '0.08em' }}
                >
                  {tech}
                </span>
              ))}
            </div>
            <p
              className="font-mono text-fg-tertiary text-xs lowercase"
              style={{ letterSpacing: '0.06em' }}
            >
              built for engineering productivity x ai hackathon
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
