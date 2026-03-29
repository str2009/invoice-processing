import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("shipment")
      .select("shipment_id, transport_company, transport_invoice_number, transport_date")
      .order("transport_date", { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (e: any) {
    console.error("SHIPMENT LIST ERROR:", e)
    return NextResponse.json(
      { error: e?.message || "Failed to fetch shipments" },
      { status: 500 }
    )
  }
}
