import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const filter = url.searchParams.get("filter") || "all"

    let data: any[] = []
    let error: any = null

    if (filter === "unlinked") {
      // Get all shipment IDs that have linked invoices
      const { data: linkedShipments } = await supabase
        .from("shipment_invoices")
        .select("shipment_id")
      
      const linkedIds = [...new Set((linkedShipments ?? []).map((r: any) => r.shipment_id))]

      // Get shipments NOT in linkedIds
      if (linkedIds.length > 0) {
        const result = await supabase
          .from("shipment")
          .select("shipment_id, transport_company, transport_invoice_number, transport_date, transport_type")
          .not("shipment_id", "in", `(${linkedIds.join(",")})`)
          .order("transport_date", { ascending: false })
        data = result.data ?? []
        error = result.error
      } else {
        // No linked shipments, return all
        const result = await supabase
          .from("shipment")
          .select("shipment_id, transport_company, transport_invoice_number, transport_date, transport_type")
          .order("transport_date", { ascending: false })
        data = result.data ?? []
        error = result.error
      }
    } else if (filter === "recent") {
      const result = await supabase
        .from("shipment")
        .select("shipment_id, transport_company, transport_invoice_number, transport_date, transport_type")
        .order("created_at", { ascending: false })
        .limit(20)
      data = result.data ?? []
      error = result.error
    } else {
      // "all" - default
      const result = await supabase
        .from("shipment")
        .select("shipment_id, transport_company, transport_invoice_number, transport_date, transport_type")
        .order("transport_date", { ascending: false })
      data = result.data ?? []
      error = result.error
    }

    if (error) throw error

    return NextResponse.json(data)
  } catch (e: any) {
    console.error("SHIPMENT LIST ERROR:", e)
    return NextResponse.json(
      { error: e?.message || "Failed to fetch shipments" },
      { status: 500 }
    )
  }
}
