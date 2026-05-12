import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 100)

    const analyses = await prisma.analysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        mode: true,
        totalRoutes: true,
        connectedCount: true,
        orphanCount: true,
        ghostCount: true,
        createdAt: true,
      },
    })

    return NextResponse.json(analyses)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 })
  }
}
