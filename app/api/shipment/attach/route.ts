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

    // Create shipment_invoices records
    const records = invoice_ids.map((invoice_id: string) => ({
      shipment_id,
      invoice_id,
    }))

    // Upsert to handle duplicates gracefully
    const { data, error } = await supabase
      .from("shipment_invoices")
      .upsert(records, { 
        onConflict: "shipment_id,invoice_id",
        ignoreDuplicates: true 
      })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      attached: invoice_ids.length,
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
