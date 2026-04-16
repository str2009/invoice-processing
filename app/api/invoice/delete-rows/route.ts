export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const { invoice_id } = await request.json()

    if (!invoice_id) {
      return NextResponse.json(
        { error: "Missing invoice_id" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    // Delete enriched rows first (if any)
    const { error: enrichedError } = await supabase
      .from("invoice_rows_enriched")
      .delete()
      .eq("invoice_id", invoice_id)

    if (enrichedError) {
      console.error("[delete-rows] Error deleting enriched rows:", enrichedError)
    }

    // Delete raw rows and get count
    const { data: deletedData, error: rowsError } = await supabase
      .from("invoice_rows")
      .delete()
      .eq("invoice_id", invoice_id)
      .select("id")

    if (rowsError) {
      return NextResponse.json(
        { error: rowsError.message },
        { status: 500 }
      )
    }

    const deletedCount = deletedData?.length ?? 0

    return NextResponse.json({ 
      success: true, 
      deletedCount,
      invoice_id 
    })
  } catch (error: any) {
    console.error("[delete-rows] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
