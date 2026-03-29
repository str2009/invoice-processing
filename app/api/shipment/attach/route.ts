import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { shipment_id, invoice_ids } = body

    if (!shipment_id) {
      return NextResponse.json(
        { error: "Missing shipment_id" },
        { status: 400 }
      )
    }

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty invoice_ids array" },
        { status: 400 }
      )
    }

    // First, check which invoices are already linked
    const { data: existing } = await supabase
      .from("shipment_invoices")
      .select("invoice_id")
      .eq("shipment_id", shipment_id)
      .in("invoice_id", invoice_ids)

    const existingIds = new Set((existing ?? []).map((r: any) => r.invoice_id))
    
    // Filter out already-linked invoices
    const newInvoiceIds = invoice_ids.filter((id: string) => !existingIds.has(id))

    if (newInvoiceIds.length === 0) {
      return NextResponse.json({
        success: true,
        attached: 0,
        message: "All invoices were already linked",
      })
    }

    // Create new shipment_invoices records
    const records = newInvoiceIds.map((invoice_id: string) => ({
      shipment_id,
      invoice_id,
    }))

    const { data, error } = await supabase
      .from("shipment_invoices")
      .insert(records)
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      attached: newInvoiceIds.length,
      data,
    })
  } catch (err: any) {
    console.error("Error attaching invoices to shipment:", err)
    return NextResponse.json(
      { error: err.message || "Failed to attach invoices" },
      { status: 500 }
    )
  }
}
