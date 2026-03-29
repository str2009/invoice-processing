import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log("[v0] Fetching invoices for shipment_id:", id)

    // Get invoice IDs linked to this shipment
    const { data: links, error: linksError } = await supabase
      .from("shipment_invoices")
      .select("invoice_id")
      .eq("shipment_id", id)

    console.log("[v0] shipment_invoices query result:", { links, linksError })

    if (linksError) throw linksError

    const invoiceIds = (links ?? []).map((r: any) => r.invoice_id)
    console.log("[v0] invoiceIds extracted:", invoiceIds)

    if (invoiceIds.length === 0) {
      console.log("[v0] No invoices found, returning empty array")
      return NextResponse.json([])
    }

    // Fetch invoice details separately - use correct column names
    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoice")
      .select("invoice_id, supplier, created_at, total_amount_document")
      .in("invoice_id", invoiceIds)

    if (invoicesError) throw invoicesError

    // Format response
    const invoices = (invoicesData ?? []).map((inv: any) => ({
      invoice_id: inv.invoice_id,
      supplier: inv.supplier ?? null,
      date: inv.created_at ?? null,
      amount: inv.total_amount_document ?? null,
    }))

    console.log("[v0] Returning invoices:", invoices)
    return NextResponse.json(invoices)
  } catch (e: any) {
    console.error("SHIPMENT INVOICES ERROR:", e)
    return NextResponse.json(
      { error: e?.message || "Failed to fetch shipment invoices" },
      { status: 500 }
    )
  }
}
