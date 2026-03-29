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

    const { data, error } = await supabase
      .from("shipment_invoices")
      .select(`
        invoice_id,
        invoice:invoice_id (
          supplier,
          invoice_date,
          invoice_number
        )
      `)
      .eq("shipment_id", id)

    if (error) throw error

    // Flatten the response
    const invoices = (data ?? []).map((row: any) => ({
      invoice_id: row.invoice_id,
      supplier: row.invoice?.supplier ?? null,
      date: row.invoice?.invoice_date ?? null,
      number: row.invoice?.invoice_number ?? null,
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
