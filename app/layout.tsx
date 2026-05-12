import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'GAP — API Intelligence Platform',
  description:
    'Auto-detect routes, find frontend/backend gaps, categorize by feature, and generate API docs. Zero annotation required.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-bg-primary min-h-screen text-fg-primary font-body antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  )
}
