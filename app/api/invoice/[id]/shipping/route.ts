import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

function toNum(v: unknown) {
  if (v === "" || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { shipping } = await request.json()

  const { error } = await supabase
    .from("invoice")
    .update({
      transport_company: shipping.company ?? null,
      transport_type: shipping.type ?? null,
      transport_invoice_number: shipping.invoiceNumber ?? null,
      transport_date: shipping.transportDate || null,
      received_date: shipping.receivedDate || null,
      shipping_total_cost: toNum(shipping.totalCost),
      packages_count: shipping.packages ? Number(shipping.packages) : null,
      shipping_total_weight: toNum(shipping.weight),
      shipping_total_volume: toNum(shipping.volume),
      shipping_density: toNum(shipping.density),
      goods_total_value: toNum(shipping.goodsTotalValue),
      goods_value_per_kg: toNum(shipping.goodsValuePerKg),
      shipping_comment: shipping.comment ?? null,
    })
    .eq("invoice_id", id)

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
