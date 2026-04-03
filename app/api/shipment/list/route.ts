import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to get all invoices grouped by shipment_id
async function getShipmentInvoices(): Promise<Map<string, { invoice_id: string; supplier: string | null; date: string | null; amount: number | null }[]>> {
  const { data } = await supabase
    .from("shipment_invoices")
    .select("shipment_id, invoice_id")
  
  const invoiceMap = new Map<string, { invoice_id: string; supplier: string | null; date: string | null; amount: number | null }[]>()
  
  if (data) {
    // Get unique invoice IDs
    const invoiceIds = [...new Set(data.map(r => r.invoice_id))]
    
    // Fetch invoice details
    let invoiceDetails = new Map<string, { supplier: string | null; date: string | null; amount: number | null }>()
    if (invoiceIds.length > 0) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("invoice_id, supplier, date, total_purchase")
        .in("invoice_id", invoiceIds)
      
      if (invoices) {
        for (const inv of invoices) {
          invoiceDetails.set(inv.invoice_id, {
            supplier: inv.supplier,
            date: inv.date,
            amount: inv.total_purchase
          })
        }
      }
    }
    
    // Group by shipment
    for (const row of data) {
      const shipId = row.shipment_id
      const details = invoiceDetails.get(row.invoice_id) || { supplier: null, date: null, amount: null }
      
      if (!invoiceMap.has(shipId)) {
        invoiceMap.set(shipId, [])
      }
      invoiceMap.get(shipId)!.push({
        invoice_id: row.invoice_id,
        ...details
      })
    }
  }
  return invoiceMap
}

// Helper to enrich shipments with invoices array
function enrichWithInvoices(shipments: any[], invoiceMap: Map<string, any[]>): any[] {
  return shipments.map(ship => ({
    ...ship,
    invoice_count: invoiceMap.get(ship.shipment_id)?.length ?? 0,
    invoices: invoiceMap.get(ship.shipment_id) ?? []
  }))
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const filter = url.searchParams.get("filter") || "all"

    // Get all invoices grouped by shipment (single batch query)
    const invoiceMap = await getShipmentInvoices()
    const linkedIds = [...invoiceMap.keys()]

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

    // Enrich with invoices array
    const enrichedData = enrichWithInvoices(data, invoiceMap)

    return NextResponse.json(enrichedData)
  } catch (e: any) {
    console.error("SHIPMENT LIST ERROR:", e)
    return NextResponse.json(
      { error: e?.message || "Failed to fetch shipments" },
      { status: 500 }
    )
  }
}
