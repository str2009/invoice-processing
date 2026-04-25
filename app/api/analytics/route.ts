import { NextResponse } from 'next/server'

// Webhook URLs for different modes
const WEBHOOK_URLS = {
  INVOICE_LIST: 'https://max24vin.ru/webhook/analytics-invoice-list-03ae810caa3f',
  DEFAULT: 'https://max24vin.ru/webhook/analytics-599effdf'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    console.log("[v0] Analytics API received:", JSON.stringify(body))
    
    // Route to appropriate webhook based on mode
    const webhookUrl = body.mode === 'INVOICE_LIST' 
      ? WEBHOOK_URLS.INVOICE_LIST 
      : WEBHOOK_URLS.DEFAULT
    
    console.log("[v0] Routing to webhook:", webhookUrl)
    
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const text = await res.text()
    console.log("[v0] Webhook response status:", res.status)
    console.log("[v0] Webhook response length:", text.length, "chars")
    console.log("[v0] Webhook response preview:", text.slice(0, 500))
    
    let data = []

    try {
      data = JSON.parse(text)
    } catch {
      console.log("[v0] Failed to parse JSON response")
      return NextResponse.json([])
    }

    console.log("[v0] Parsed data type:", Array.isArray(data) ? "array" : typeof data, "length:", Array.isArray(data) ? data.length : "n/a")

    if (Array.isArray(data)) {
      return NextResponse.json(data)
    }

    if (data?.data && Array.isArray(data.data)) {
      console.log("[v0] Using data.data array, length:", data.data.length)
      return NextResponse.json(data.data)
    }

    console.log("[v0] Returning empty array - no matching format")
    return NextResponse.json([])
  } catch {
    return NextResponse.json([])
  }
}
