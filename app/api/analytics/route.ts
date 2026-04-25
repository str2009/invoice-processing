import { NextResponse } from 'next/server'

// Webhook URLs for different modes
const WEBHOOK_URLS = {
  INVOICE_LIST: 'https://max24vin.ru/webhook/analytics-invoice-list-03ae810caa3f',
  DEFAULT: 'https://max24vin.ru/webhook/analytics-599effdf'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Route to appropriate webhook based on mode
    const webhookUrl = body.mode === 'INVOICE_LIST' 
      ? WEBHOOK_URLS.INVOICE_LIST 
      : WEBHOOK_URLS.DEFAULT
    
    const res = await fetch(webhookUrl, {
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
