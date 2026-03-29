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

    // Get invoice IDs linked to this shipment
    const { data: links, error: linksError } = await supabase
      .from("shipment_invoices")
      .select("invoice_id")
      .eq("shipment_id", id)

    if (linksError) throw linksError

    const invoiceIds = (links ?? []).map((r: any) => r.invoice_id)

    if (invoiceIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch invoice details separately
    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoice")
      .select("invoice_id, supplier, invoice_date, invoice_number")
      .in("invoice_id", invoiceIds)

    if (invoicesError) throw invoicesError

    // Format response
    const invoices = (invoicesData ?? []).map((inv: any) => ({
      invoice_id: inv.invoice_id,
      supplier: inv.supplier ?? null,
      date: inv.invoice_date ?? null,
      number: inv.invoice_number ?? null,
    }))

    return NextResponse.json(invoices)
  } catch (e: any) {
    console.error("SHIPMENT INVOICES ERROR:", e)
    return NextResponse.json(
      { error: e?.message || "Failed to fetch shipment invoices" },
      { status: 500 }
    )
  }
}
