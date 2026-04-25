import { NextResponse } from "next/server"

export async function GET() {
  try {
    const res = await fetch('https://max24vin.ru/webhook/analytics-invoice-list-03ae810caa3f', {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })
    
    if (!res.ok) {
      console.error('[v0] Invoice list API error:', res.status, res.statusText)
      return NextResponse.json([], { status: res.status })
    }
    
    const data = await res.json()
    console.log('[v0] Invoice list fetched:', data?.length || 0, 'items')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] Failed to fetch invoice list:', error)
    return NextResponse.json([], { status: 500 })
  }
}
