import { NextResponse } from "next/server"

const WEBHOOK_URL = "https://max24vin.ru/webhook/invoice-rows-update-03ae810caa3f"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Validate required fields
    if (!body.invoice_id) {
      return NextResponse.json(
        { error: "invoice_id is required" },
        { status: 400 }
      )
    }
    
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json(
        { error: "rows array is required and must not be empty" },
        { status: 400 }
      )
    }

    // Forward full payload to backend webhook
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[invoice-rows/update] Webhook error:", response.status, errorText)
      return NextResponse.json(
        { error: "Backend error", details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({ success: true }))
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("[invoice-rows/update] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
