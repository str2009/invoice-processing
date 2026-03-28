import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      invoiceIds,
      shippingData
    } = body

    // 1. создаём shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipment")
      .insert({
        transport_company: shippingData.transport_company,
        transport_type: shippingData.transport_type,
        transport_invoice_number: shippingData.transport_invoice_number,
        transport_date: shippingData.transport_date,
        received_date: shippingData.received_date,

        total_shipping_cost: shippingData.total_shipping_cost,
        total_weight: shippingData.total_weight,
        total_volume: shippingData.total_volume,
        density: shippingData.density,

        goods_total_value: shippingData.goods_total_value,
        goods_value_per_kg: shippingData.goods_value_per_kg,

        normal_weight: shippingData.normal_weight,
        bulky_weight: shippingData.bulky_weight,

        normal_shipping: shippingData.normal_shipping,
        bulky_shipping: shippingData.bulky_shipping,

        catalog_weight: shippingData.catalog_weight,
        bulky_price: shippingData.bulky_price,
      })
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