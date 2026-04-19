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
    let data = []

    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json([])
    }

    if (Array.isArray(data)) {
      return NextResponse.json(data)
    }

    if (data?.data && Array.isArray(data.data)) {
      return NextResponse.json(data.data)
    }

    return NextResponse.json([])
  } catch {
    return NextResponse.json([])
  }
}
