import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to convert empty strings to null
const safe = (v: any) => (v === "" || v === undefined ? null : v)
const safeNum = (v: any) => {
  if (v === "" || v === undefined || v === null) return null
  const num = Number(v)
  return isNaN(num) ? null : num
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log("FULL BODY:", body)

    const { invoiceIds, shippingData } = body

    console.log("shippingData:", shippingData)

    // Validate input
    if (!shippingData) {
      return NextResponse.json({ error: "Missing shippingData" }, { status: 400 })
    }

    // 1. создаём shipment - include all columns
    const insertData = {
      transport_company: shippingData.transport_company ?? null,
      transport_type: shippingData.transport_type ?? null,
      transport_invoice_number: shippingData.transport_invoice_number ?? null,
      transport_date: shippingData.transport_date ?? null,
      received_date: shippingData.received_date ?? null,
      total_shipping_cost: shippingData.total_shipping_cost ?? 0,
      total_weight: shippingData.total_weight ?? 0,
      total_volume: shippingData.total_volume ?? 0,
      density: shippingData.density ?? 0,
      packages_count: shippingData.packages_count ?? 0,
      comment: shippingData.comment ?? null,
      goods_total_value: shippingData.goods_total_value ?? 0,
      goods_value_per_kg: shippingData.goods_value_per_kg ?? null,
      normal_weight: shippingData.normal_weight ?? null,
      bulky_weight: shippingData.bulky_weight ?? null,
      normal_shipping: shippingData.normal_shipping ?? null,
      bulky_shipping: shippingData.bulky_shipping ?? null,
      catalog_weight: shippingData.catalog_weight ?? null,
      bulky_price: shippingData.bulky_price ?? null,
    }

    console.log("INSERTING INTO SHIPMENT:", insertData)

    const { data: shipment, error: shipmentError } = await supabase
      .from("shipment")
      .insert(insertData)
      .select()
      .single()

    console.log("INSERT RESULT:", shipment)

    if (shipmentError) throw shipmentError

    // 2. связываем с invoice
    const links = invoiceIds.map((invoice_id: string) => ({
      shipment_id: shipment.shipment_id,
      invoice_id
    }))

    const { error: linkInsertError } = await supabase
    .from("shipment_invoices")
    .insert(links)
  
  if (linkInsertError) throw linkInsertError

    return NextResponse.json({ success: true })

  } catch (e: any) {
    console.error("SHIPMENT SAVE ERROR FULL:", e)
  
    return NextResponse.json(
      {
        success: false,
        error: e?.message || "Unknown error",
        details: e,
      },
      { status: 500 }
    )
  }
}
