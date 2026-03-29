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

    const {
      invoiceIds,
      shippingData
    } = body

    console.log("BACKEND RECEIVED shippingData:", shippingData)

    // 1. создаём shipment
    const insertData = {
      transport_company: safe(shippingData.transport_company),
      transport_type: safe(shippingData.transport_type),
      transport_invoice_number: safe(shippingData.transport_invoice_number),
      transport_date: safe(shippingData.transport_date),
      received_date: safe(shippingData.received_date),

      total_shipping_cost: safeNum(shippingData.total_shipping_cost),
      total_weight: safeNum(shippingData.total_weight),
      total_volume: safeNum(shippingData.total_volume),
      density: safeNum(shippingData.density),

      goods_total_value: safeNum(shippingData.goods_total_value),
      goods_value_per_kg: safeNum(shippingData.goods_value_per_kg),

      normal_weight: safeNum(shippingData.normal_weight),
      bulky_weight: safeNum(shippingData.bulky_weight),

      normal_shipping: safeNum(shippingData.normal_shipping),
      bulky_shipping: safeNum(shippingData.bulky_shipping),

      catalog_weight: safeNum(shippingData.catalog_weight),
      bulky_price: safeNum(shippingData.bulky_price),
    }

    console.log("INSERTING INTO SHIPMENT:", insertData)

    const { data: shipment, error: shipmentError } = await supabase
      .from("shipment")
      .insert(insertData)
      .select()
      .single()

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
