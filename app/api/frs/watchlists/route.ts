import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const FRS_BASE_URL = process.env.NEXT_PUBLIC_FRS_BASE_URL
const FRS_TOKEN = process.env.NEXT_PUBLIC_FRS_TOKEN || ''

export async function GET() {
  try {
    const response = await fetch(`${FRS_BASE_URL}/watch-lists/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `token ${FRS_TOKEN}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch watchlists', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
