import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { part_code, brand } = await request.json()

    if (!part_code || !brand) {
      return NextResponse.json(
        { error: "Missing part_code or brand" },
        { status: 400 }
      )
    }

    const response = await fetch(
      "https://max24vin.ru/webhook/web-pricing-c77f52e6926d",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_code, brand }),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch pricing" },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Normalize response format
    const normalized = {
      price: data.price ?? data.Price ?? 0,
      stock: data.stock ?? data.Stock ?? data.quantity ?? 0,
      delivery_days: data.delivery_days ?? data.deliveryDays ?? data.delivery ?? 0,
      supplier: data.supplier ?? data.Supplier ?? data.name ?? "Unknown",
    }

    return NextResponse.json(normalized)
  } catch (error) {
    console.error("Web pricing error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
