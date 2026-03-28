import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const invoice_id = searchParams.get("invoice_id")

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from("invoice")
      .select(
        [
          "invoice_id",
          "transport_company",
          "transport_type",
          "transport_invoice_number",
          "transport_date",
          "received_date",
          "shipping_total_cost",
          "shipping_total_weight",
          "shipping_total_volume",
          "shipping_density",
          "packages_count",
          "shipping_comment",
          "goods_total_value",
          "goods_value_per_kg",
        ].join(",")
      )
      .eq("invoice_id", invoice_id)
      .maybeSingle()

    if (error) {
      console.error("Supabase select error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "invoice not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("Unhandled error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}