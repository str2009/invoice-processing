import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to get invoice counts for all shipments in a single query
async function getInvoiceCounts(): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("shipment_invoices")
    .select("shipment_id")
  
  const counts = new Map<string, number>()
  if (data) {
    for (const row of data) {
      const id = row.shipment_id
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

// Helper to enrich shipments with invoice_count
function enrichWithInvoiceCounts(shipments: any[], counts: Map<string, number>): any[] {
  return shipments.map(ship => ({
    ...ship,
    invoice_count: counts.get(ship.shipment_id) ?? 0
  }))
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const filter = url.searchParams.get("filter") || "all"

    // Get invoice counts for all shipments (single query)
    const invoiceCounts = await getInvoiceCounts()
    const linkedIds = [...invoiceCounts.keys()]

    let data: any[] = []
    let error: any = null

    if (filter === "unlinked") {
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

    // Enrich with invoice counts
    const enrichedData = enrichWithInvoiceCounts(data, invoiceCounts)

    return NextResponse.json(enrichedData)
  } catch (e: any) {
    console.error("SHIPMENT LIST ERROR:", e)
    return NextResponse.json(
      { error: e?.message || "Failed to fetch shipments" },
      { status: 500 }
    )
  }
}
