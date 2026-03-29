import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Create shipment only - NO invoice attachment
    const insertData = {
      transport_company: body.transport_company ?? null,
      transport_type: body.transport_type ?? null,
      transport_invoice_number: body.transport_invoice_number ?? null,
      transport_date: body.transport_date ?? null,
      received_date: body.received_date ?? null,
      total_shipping_cost: body.total_shipping_cost ?? 0,
      total_weight: body.total_weight ?? 0,
      total_volume: body.total_volume ?? 0,
      density: body.density ?? 0,
      packages_count: body.packages_count ?? 0,
      comment: body.comment ?? null,
      goods_total_value: body.goods_total_value ?? 0,
      goods_value_per_kg: body.goods_value_per_kg ?? null,
      normal_weight: body.normal_weight ?? null,
      bulky_weight: body.bulky_weight ?? null,
      normal_shipping: body.normal_shipping ?? null,
      bulky_shipping: body.bulky_shipping ?? null,
      catalog_weight: body.catalog_weight ?? null,
      bulky_price: body.bulky_price ?? null,
    }

    const { data: shipment, error } = await supabase
      .from("shipment")
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      shipment,
    })
  } catch (e: any) {
    console.error("SHIPMENT CREATE ERROR:", e)
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to create shipment" },
      { status: 500 }
    )
  }
}
