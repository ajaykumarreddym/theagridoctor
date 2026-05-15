import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/market?commodity=...&state=...&market=...
// Uses the data.gov.in mandi price API (resource id 9ef84268-d588-465a-a308-a864a43d0070).
// If DATAGOV_API_KEY is missing, returns a friendly not_configured response.
const DATA_GOV_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070'

export async function GET(req: NextRequest) {
  const { user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DATAGOV_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'not_configured', message: 'DATAGOV_API_KEY is not set in environment.' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(req.url)
  const commodity = searchParams.get('commodity') || ''
  const state = searchParams.get('state') || ''
  const market = searchParams.get('market') || ''
  const limit = searchParams.get('limit') || '50'

  const url = new URL(`https://api.data.gov.in/resource/${DATA_GOV_RESOURCE}`)
  url.searchParams.set('api-key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', limit)
  if (commodity) url.searchParams.set('filters[commodity]', commodity)
  if (state) url.searchParams.set('filters[state.keyword]', state)
  if (market) url.searchParams.set('filters[market]', market)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Market API error (${res.status})`, detail: txt }, { status: res.status })
    }
    const json = await res.json()
    return NextResponse.json({
      total: json.total ?? (json.records?.length ?? 0),
      count: json.count ?? (json.records?.length ?? 0),
      records: json.records ?? [],
      updated: json.updated ?? null,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
