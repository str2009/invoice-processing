import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const res = await fetch('https://max24vin.ru/webhook/analytics-599effdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const text = await res.text()

    console.log('RAW RESPONSE TEXT:', text.substring(0, 500))

    let data = []

    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('JSON parse error:', e)
      return NextResponse.json([])
    }

    console.log('PARSED DATA TYPE:', typeof data, Array.isArray(data), 'length:', Array.isArray(data) ? data.length : 'N/A')

    if (Array.isArray(data)) {
      return NextResponse.json(data)
    }

    if (data?.data && Array.isArray(data.data)) {
      return NextResponse.json(data.data)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('API ERROR:', error)
    return NextResponse.json([])
  }
}
