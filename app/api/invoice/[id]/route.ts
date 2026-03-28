export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  // Берём id из пути вручную
  const segments = request.nextUrl.pathname.split("/")
  const id = segments[segments.length - 1]

  if (!id || id === "invoice") {
    return NextResponse.json(
      { error: "Missing invoice id" },
      { status: 400 }
    )
  }

  const decodedId = decodeURIComponent(id)

  const supabase = getSupabaseServer()

  const { data, error } = await supabase
    .from("invoice_rows")
    .select("*")
    .eq("invoice_id", decodedId)
    .order("id")

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { shipping } = await request.json()

  const { error } = await supabaseServer
    .from("invoice")
    .update({
      transport_company: shipping.company,
      transport_type: shipping.type,
      transport_invoice_number: shipping.invoiceNumber,
      transport_date: shipping.transportDate || null,
      received_date: shipping.receivedDate || null,
      shipping_total_cost: shipping.totalCost || null,
      shipping_total_weight: shipping.weight || null,
      shipping_total_volume: shipping.volume || null,
      shipping_density: shipping.density || null,
      goods_total_value: shipping.goodsTotalValue || null,
      goods_value_per_kg: shipping.goodsValuePerKg || null,
      packages_count: shipping.packages || null,
      shipping_comment: shipping.comment,
    })
    .eq("invoice_id", id)

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // удалить enriched (если есть)
    const e1 = await supabaseServer
      .from("invoice_rows_enriched")
      .delete()
      .eq("invoice_id", id)
    if (e1.error) throw e1.error

    // удалить строки
    const e2 = await supabaseServer
      .from("invoice_rows")
      .delete()
      .eq("invoice_id", id)
    if (e2.error) throw e2.error

    // удалить сам инвойс
    const e3 = await supabaseServer
      .from("invoice")
      .delete()
      .eq("invoice_id", id)
    if (e3.error) throw e3.error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}